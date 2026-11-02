<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionGroup;
use App\Models\RestaurantTable;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;

class CheckoutService
{
    /**
     * Proses checkout / append order dalam transaksi.
     * @return array{order: Order, is_new: bool}
     */
    public function handle(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $table = RestaurantTable::lockForUpdate()->find($data['restaurant_table_id']);
            if (!$table) {
                throw new \InvalidArgumentException('Meja restoran tidak ditemukan.');
            }
            if (!$table->is_available || $table->status === 'maintenance') {
                throw new \InvalidArgumentException('Meja restoran sedang tidak tersedia.');
            }

            $existingOrder = null;
            $lookupToken = $data['tracking_token'] ?? null;

            if (!empty($lookupToken)) {
                $existingOrder = Order::where('tracking_token', $lookupToken)->lockForUpdate()->first();
                if (!$existingOrder) {
                    throw new \InvalidArgumentException('Pesanan tidak ditemukan.');
                }
            }

            if ($existingOrder) {
                if ($existingOrder->restaurant_table_id !== (int) $data['restaurant_table_id']) {
                    throw new \InvalidArgumentException('Pesanan tidak terkait dengan meja ini.');
                }
                if (!in_array($existingOrder->status, Order::APPENDABLE_STATUSES, true)) {
                    throw new \InvalidArgumentException('Pesanan tidak dapat ditambah lagi pada status saat ini.');
                }
            }

            $subtotal = $existingOrder ? (float) $existingOrder->subtotal : 0;
            $lineItems = [];

            // Urutkan by product_id agar urutan lock konsisten dan bebas deadlock.
            $sortedItems = collect($data['items'])
                ->sortBy('product_id')
                ->values()
                ->all();

            foreach ($sortedItems as $item) {
                $product = Product::lockForUpdate()->find($item['product_id']);
                if (!$product) {
                    throw new \InvalidArgumentException('Product not found.');
                }
                if (!$product->is_active) {
                    throw new \InvalidArgumentException("Produk {$product->name} sedang tidak tersedia.");
                }
                if ((int) $product->stock < (int) $item['quantity']) {
                    throw new \InvalidArgumentException("Stock produk {$product->name} tidak mencukupi.");
                }

                // Hitung harga satuan = harga dasar + tambahan ops/varian
                $optionTotal = $this->resolveAndAccumulateOptions(
                    $product,
                    $item['selected_options'] ?? [],
                    $item['quantity']
                );
                $unitPrice = (float) $product->price + $optionTotal;
                $subtotal += $unitPrice * (int) $item['quantity'];

                $lineItems[] = [
                    'product' => $product,
                    'quantity' => (int) $item['quantity'],
                    'notes' => $item['notes'] ?? null,
                    'selected_options' => $optionTotal > 0 ? $this->snapshotSelectedOptions($item['selected_options'] ?? []) : null,
                    'unit_price' => $unitPrice,
                ];
            }

            $pricing = $this->calculatePricing($subtotal);

            if ($existingOrder) {
                foreach ($lineItems as $line) {
                    OrderItem::create([
                        'order_id' => $existingOrder->id,
                        'product_id' => $line['product']->id,
                        'quantity' => $line['quantity'],
                        'price' => $line['unit_price'],
                        'subtotal' => round($line['unit_price'] * $line['quantity'], 2),
                        'notes' => $line['notes'],
                        'selected_options' => $line['selected_options'],
                    ]);
                    $this->decrementOrFail($line['product'], $line['quantity'], 'append', $existingOrder->id);
                }

                $existingOrder->subtotal = round($subtotal, 2);
                $existingOrder->service_charge = $pricing['service_charge'];
                $existingOrder->tax = $pricing['tax'];
                $existingOrder->total_price = $pricing['total'];
                if (!empty($data['notes'])) {
                    $existingOrder->notes = trim($data['notes']);
                }
                $existingOrder->save();

                return ['order' => $existingOrder->fresh(['table', 'orderItems.product']), 'is_new' => false];
            }

            $order = null;
            $attempts = 0;
            do {
                $orderNumber = Order::generateOrderNumber();
                $trackingToken = Order::generateTrackingToken();
                try {
                    $order = Order::create([
                        'restaurant_table_id' => $data['restaurant_table_id'],
                        'order_number' => $orderNumber,
                        'tracking_token' => $trackingToken,
                        'customer_name' => $data['customer_name'],
                        'subtotal' => round($subtotal, 2),
                        'service_charge' => $pricing['service_charge'],
                        'tax' => $pricing['tax'],
                        'notes' => $data['notes'] ?? null,
                        'total_price' => $pricing['total'],
                        'status' => 'pending',
                        'payment_method' => $data['payment_method'],
                    ]);
                    break;
                } catch (\Illuminate\Database\QueryException $e) {
                    if (str_contains($e->getMessage(), 'order_number') || str_contains($e->getMessage(), 'tracking_token')) {
                        $attempts++;
                        if ($attempts >= 5) {
                            throw $e;
                        }
                        continue;
                    }
                    throw $e;
                }
            } while ($attempts < 5);

            foreach ($lineItems as $line) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $line['product']->id,
                    'quantity' => $line['quantity'],
                    'price' => $line['unit_price'],
                    'subtotal' => round($line['unit_price'] * $line['quantity'], 2),
                    'notes' => $line['notes'],
                    'selected_options' => $line['selected_options'],
                ]);
                $this->decrementOrFail($line['product'], $line['quantity'], 'checkout', $order->id);
            }

            return ['order' => $order->fresh(['table', 'orderItems.product']), 'is_new' => true];
        });
    }

    /**
     * Validasi bahwa semua opsi milik produk yang dimaksud.
     * Kembalikan total harga tambahan sesuai jumlah item yang dipesan.
     */
    private function resolveAndAccumulateOptions(
        Product $product,
        array $selectedOptions,
        int $quantity
    ): float {
        $groupIdMap = $product->optionGroups()->pluck('id')->mapWithKeys(fn ($id) => [$id => $id])->toArray();

        if (empty($selectedOptions) || !is_array($selectedOptions)) {
            return 0.0;
        }

        $total = 0.0;
        foreach ($selectedOptions as $sel) {
            if (!isset($sel['option_group_id']) || !isset($sel['option_id'])) {
                continue;
            }

            if (!isset($groupIdMap[(int) $sel['option_group_id']])) {
                throw new \InvalidArgumentException(
                    "Opsi option_group_id={$sel['option_group_id']} tidak dimiliki produk {$product->name}."
                );
            }

            // Ambil langsung dari database untuk efisiensi
            $optRecord = DB::table('product_options')
                ->join('product_option_groups', 'product_options.option_group_id', '=', 'product_option_groups.id')
                ->where('product_option_groups.product_id', $product->id)
                ->where('product_options.id', (int) $sel['option_id'])
                ->first();

            if (!$optRecord) {
                throw new \InvalidArgumentException(
                    "Opsi option_id={$sel['option_id']} tidak ditemukan atau tidak milik produk {$product->name}."
                );
            }

            $total += (float) $optRecord->additional_price;
        }

        return $total * $quantity;
    }

    /**
     * Snapshot pilihan varian yang dipilih pelanggan (immutable per order).
     * Format: [{option_group_id, option_id, option_label, additional_price}, ...]
     */
    private function snapshotSelectedOptions(array $selectedOptions): ?array
    {
        if (empty($selectedOptions) || !is_array($selectedOptions)) {
            return null;
        }

        $snapshot = [];
        foreach ($selectedOptions as $sel) {
            $snapshot[] = [
                'option_group_id' => (int) ($sel['option_group_id'] ?? 0),
                'option_id' => (int) ($sel['option_id'] ?? 0),
                'option_label' => $sel['label'] ?? '',
                'additional_price' => (float) ($sel['additional_price'] ?? 0),
            ];
        }

        return $snapshot;
    }

    private function decrementOrFail(Product $product, int $quantity, string $reason, int $orderId): void
    {
        try {
            StockMutationService::recordDecrement($product, $quantity, $reason, $orderId);
        } catch (\InvalidArgumentException $e) {
            throw $e;
        } catch (\Exception $e) {
            // Race condition: stok habis di antara cek dan decrement atomik.
            throw new \InvalidArgumentException("Stock produk {$product->name} tidak mencukupi.");
        }
    }

    private function calculatePricing(float $subtotal): array
    {
        $serviceChargePercent = (float) Setting::get('service_charge_percent', 0);
        $taxPercent = (float) Setting::get('tax_percent', 0);
        $serviceCharge = round($subtotal * $serviceChargePercent / 100, 2);
        $tax = round($subtotal * $taxPercent / 100, 2);
        $total = round($subtotal + $serviceCharge + $tax, 2);

        return [
            'service_charge' => $serviceCharge,
            'tax' => $tax,
            'total' => $total,
        ];
    }
}
