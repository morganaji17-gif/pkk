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
                $resolvedOptions = $this->resolveAndAccumulateOptions(
                    $product,
                    $item['selected_options'] ?? []
                );
                $unitPrice = (float) $product->price + $resolvedOptions['total'];
                $subtotal += $unitPrice * (int) $item['quantity'];

                $lineItems[] = [
                    'product' => $product,
                    'quantity' => (int) $item['quantity'],
                    'notes' => $item['notes'] ?? null,
                    'selected_options' => $resolvedOptions['snapshot'],
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
     * Validasi opsi milik produk, hitung total harga tambahan per-unit, dan buat
     * snapshot immutable dari data di database (bukan dari payload client).
     * CATATAN: Nilai `total` adalah tambahan PER ITEM (bukan dikali quantity).
     *         Pengalian dengan quantity sudah dilakukan di caller (handle).
     *
     * @return array{total: float, snapshot: array|null}
     */
    private function resolveAndAccumulateOptions(Product $product, array $selectedOptions): array
    {
        $groupIdMap = $product->optionGroups()
            ->pluck('id')
            ->mapWithKeys(fn ($id) => [(int) $id => (int) $id])
            ->toArray();

        $groupDetails = $product->optionGroups()
            ->select(['id', 'name', 'selection_type', 'required', 'min_selections', 'max_selections'])
            ->get()
            ->keyBy->id;

        // Grup tanpa opsi tidak mungkin dipilih. Abaikan grup seperti ini
        // supaya produk tidak terkunci gara-gara grup kosong yang (mungkin
        // tidak sengaja) ditandai wajib.
        $groupsWithOptions = $product->optionGroups()
            ->whereHas('options')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        // Jika tidak ada selected_options, cek apakah ada grup wajib yang kosong
        if (empty($selectedOptions) || !is_array($selectedOptions)) {
            foreach ($groupDetails as $groupId => $group) {
                if (!$group->required || !in_array((int) $groupId, $groupsWithOptions, true)) {
                    continue;
                }
                if (isset($groupIdMap[$groupId])) {
                    $min = max(1, (int) ($group->min_selections ?? 1));
                    throw new \InvalidArgumentException(
                        "Pilih minimal {$min} opsi untuk '{$group->name}'."
                    );
                }
            }
            return ['total' => 0.0, 'snapshot' => null];
        }

        $total = 0.0;
        $snapshot = [];
        $seen = [];
        $countPerGroup = [];

        foreach ($selectedOptions as $sel) {
            if (!isset($sel['option_group_id']) || !isset($sel['option_id'])) {
                continue;
            }

            $groupId = (int) $sel['option_group_id'];
            $optionId = (int) $sel['option_id'];

            if (!isset($groupIdMap[$groupId])) {
                throw new \InvalidArgumentException(
                    "Opsi option_group_id={$groupId} tidak dimiliki produk {$product->name}."
                );
            }

            $pairKey = $groupId . ':' . $optionId;
            if (isset($seen[$pairKey])) {
                continue;
            }
            $seen[$pairKey] = true;

            $optRecord = DB::table('product_options')
                ->join('product_option_groups', 'product_options.option_group_id', '=', 'product_option_groups.id')
                ->where('product_option_groups.product_id', $product->id)
                ->where('product_option_groups.id', $groupId)
                ->where('product_options.id', $optionId)
                ->select(
                    'product_options.id',
                    'product_options.label',
                    'product_options.additional_price',
                    'product_option_groups.name as group_name',
                    'product_option_groups.selection_type'
                )
                ->first();

            if (!$optRecord) {
                throw new \InvalidArgumentException(
                    "Opsi option_id={$optionId} tidak ditemukan atau tidak milik produk {$product->name}."
                );
            }

            $countPerGroup[$groupId] = ($countPerGroup[$groupId] ?? 0) + 1;
            if ($optRecord->selection_type === 'single' && $countPerGroup[$groupId] > 1) {
                throw new \InvalidArgumentException(
                    "Grup opsi {$optRecord->group_name} hanya boleh memilih satu opsi."
                );
            }

            $total += (float) $optRecord->additional_price;
            $snapshot[] = [
                'option_group_id' => $groupId,
                'option_group_label' => $optRecord->group_name,
                'option_id' => $optionId,
                'option_label' => $optRecord->label,
                'additional_price' => (float) $optRecord->additional_price,
            ];
        }

        // Validasi min/max. Grup tanpa opsi dilewati (tidak bisa dipilih).
        foreach ($groupDetails as $groupId => $group) {
            $groupId = (int) $groupId;
            if (!in_array($groupId, $groupsWithOptions, true)) {
                continue;
            }

            $count = $countPerGroup[$groupId] ?? 0;
            $min = $group->required
                ? max(1, (int) ($group->min_selections ?? 1))
                : max(0, (int) ($group->min_selections ?? 0));
            $max = $group->max_selections !== null
                ? (int) $group->max_selections
                : ($group->selection_type === 'single' ? 1 : PHP_INT_MAX);

            if ($count < $min) {
                throw new \InvalidArgumentException(
                    "Pilih minimal {$min} opsi untuk '{$group->name}'."
                );
            }
            if ($count > $max) {
                throw new \InvalidArgumentException(
                    "Pilih maksimal {$max} opsi untuk '{$group->name}'."
                );
            }
        }

        return [
            'total' => $total,
            'snapshot' => empty($snapshot) ? null : $snapshot,
        ];
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
