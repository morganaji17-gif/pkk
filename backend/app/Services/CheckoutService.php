<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
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
                $subtotal += (float) $product->price * (int) $item['quantity'];
                $lineItems[] = [
                    'product' => $product,
                    'quantity' => (int) $item['quantity'],
                    'notes' => $item['notes'] ?? null,
                ];
            }

            $pricing = $this->calculatePricing($subtotal);

            if ($existingOrder) {
                foreach ($lineItems as $line) {
                    OrderItem::create([
                        'order_id' => $existingOrder->id,
                        'product_id' => $line['product']->id,
                        'quantity' => $line['quantity'],
                        'price' => $line['product']->price,
                        'subtotal' => (float) $line['product']->price * $line['quantity'],
                        'notes' => $line['notes'],
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
                    'price' => $line['product']->price,
                    'subtotal' => (float) $line['product']->price * $line['quantity'],
                    'notes' => $line['notes'],
                ]);
                $this->decrementOrFail($line['product'], $line['quantity'], 'checkout', $order->id);
            }

            return ['order' => $order->fresh(['table', 'orderItems.product']), 'is_new' => true];
        });
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
