<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\AuditLogger;
use App\Services\CheckoutService;
use App\Services\Realtime;
use App\Services\StockMutationService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Http\Requests\Order\StoreOrderRequest;
use App\Http\Requests\Order\UpdateOrderRequest;
use App\Http\Requests\Order\UpdatePaymentRequest;
use App\Http\Requests\Order\UploadProofRequest;
use App\Http\Requests\Order\IndexOrderRequest;
use Illuminate\Support\Facades\Storage;

class OrderController extends Controller
{
    public function checkout(StoreOrderRequest $request, CheckoutService $checkoutService)
    {
        try {
            $result = $checkoutService->handle($request->validated());
            $order = $result['order'];
            $isNew = $result['is_new'];

            if ($isNew) {
                Realtime::push('orders', ['type' => 'order.created', 'order_number' => $order->order_number, 'tracking_token' => $order->tracking_token]);
                Realtime::push('order:' . $order->order_number, ['type' => 'order.created', 'order_number' => $order->order_number]);
                if (!empty($order->tracking_token)) {
                    Realtime::push('order:' . $order->tracking_token, ['type' => 'order.created', 'order_number' => $order->order_number]);
                }
                Realtime::push('dashboard', ['type' => 'orders.changed']);
                AuditLogger::record('order_created', 'order', $order->id, 'Pesanan ' . $order->order_number . ' dibuat di Meja ' . ($order->table?->table_number ?? '-'));

                return response()->json([
                    'message' => 'Order created successfully',
                    'data' => $order,
                ], 201);
            }

            Realtime::push('orders', ['type' => 'order.updated', 'order_number' => $order->order_number, 'tracking_token' => $order->tracking_token]);
            Realtime::push('order:' . $order->order_number, ['type' => 'order.updated', 'order_number' => $order->order_number]);
            if (!empty($order->tracking_token)) {
                Realtime::push('order:' . $order->tracking_token, ['type' => 'order.updated', 'order_number' => $order->order_number]);
            }
            Realtime::push('dashboard', ['type' => 'orders.changed']);
            AuditLogger::record('order_updated', 'order', $order->id, 'Menu ditambahkan ke pesanan ' . $order->order_number);

            return response()->json([
                'message' => 'Order updated successfully',
                'data' => $order,
            ], 200);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Checkout failed', ['exception' => $e->getMessage()]);
            return response()->json(['message' => 'Terjadi kesalahan saat memproses pesanan. Silakan coba lagi.'], 500);
        }
    }
    public function index(IndexOrderRequest $request)
{
    $page = $request->integer('page', 1);
    $perPage = $request->integer('per_page', 15);

    $orders = Order::with([
        'table',
        'orderItems.product'
    ])
        ->when($request->filled('search'), function ($query) use ($request) {
            $search = trim($request->input('search'));

            $query->where(function ($sub) use ($search) {
                $sub->where('order_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%");
            });
        })
        ->when($request->filled('status'), function ($query) use ($request) {
            $query->where('status', $request->input('status'));
        })
        ->when($request->filled('payment_status'), function ($query) use ($request) {
            $query->where('payment_status', $request->input('payment_status'));
        })
        ->latest()
        ->paginate($perPage, ['*'], 'page', $page);

    return response()->json([
        'message' => 'Orders retrieved successfully',
        'data' => $orders->items(),
        'meta' => [
            'current_page' => $orders->currentPage(),
            'last_page' => $orders->lastPage(),
            'per_page' => $orders->perPage(),
            'total' => $orders->total(),
            'has_more' => $orders->hasMorePages(),
        ],
    ]);
}
    public function show(Order $order)
{
    $order->load([
        'table',
        'orderItems.product'
    ]);

    return response()->json([
        'message' => 'Order retrieved successfully',
        'data' => $order,
    ]);
}
public function updateStatus(
    UpdateOrderRequest $request,
    Order $order
) {
    $newStatus = $request->status;
    $oldStatus = $order->status;

    if ($oldStatus === $newStatus) {
        return response()->json([
            'message' => 'Status pesanan sudah ' . $oldStatus . '.',
        ], 422);
    }

    $allowed = Order::STATUS_TRANSITIONS[$oldStatus] ?? [];
    if (!in_array($newStatus, $allowed, true)) {
        return response()->json([
            'message' => "Transisi status dari {$oldStatus} ke {$newStatus} tidak diizinkan.",
        ], 422);
    }

    // Dapur: confirmed -> preparing -> served -> completed.
    // Kasir: pending -> confirmed, served -> completed (+ cancel). Tanpa aksi dapur.
    // Admin: semua transisi valid.
    $role = Auth::user()?->role;
    if ($role === 'kitchen') {
        $kitchenNext = Order::KITCHEN_TRANSITIONS[$oldStatus] ?? [];
        if (!in_array($newStatus, $kitchenNext, true)) {
            return response()->json([
                'message' => 'Akun dapur hanya boleh memproses confirmed menjadi preparing, preparing menjadi served (siap), dan served menjadi completed.',
            ], 403);
        }
    } elseif ($role === 'cashier') {
        $cashierNext = Order::CASHIER_TRANSITIONS[$oldStatus] ?? [];
        if (!in_array($newStatus, $cashierNext, true)) {
            return response()->json([
                'message' => 'Akun kasir hanya boleh menerima pending menjadi confirmed, menyelesaikan served menjadi completed, atau membatalkan. Proses memasak dilakukan dapur.',
            ], 403);
        }
    }

    DB::beginTransaction();

    try {
        if ($newStatus === 'cancelled' && $oldStatus !== 'cancelled') {
            $order->load('orderItems.product');

            foreach ($order->orderItems as $item) {
                if ($item->product) {
                    StockMutationService::recordIncrement(
                        $item->product,
                        (int) $item->quantity,
                        'cancel',
                        $order->id,
                        Auth::id()
                    );
                }
            }
        }

        $order->status = $newStatus;
        $order->save();

        DB::commit();
    } catch (\Exception $e) {
        DB::rollBack();

        return response()->json([
            'message' => 'Gagal memperbarui status pesanan.',
        ], 422);
    }

    Realtime::push('orders', [
        'type' => 'order.status_changed',
        'order_number' => $order->order_number,
        'status' => $newStatus,
    ]);
    Realtime::push('order:' . $order->order_number, [
        'type' => 'order.status_changed',
        'status' => $newStatus,
    ]);
    if (!empty($order->tracking_token)) {
        Realtime::push('order:' . $order->tracking_token, [
            'type' => 'order.status_changed',
            'status' => $newStatus,
        ]);
    }
    Realtime::push('dashboard', ['type' => 'orders.changed']);
    AuditLogger::record(
        'status_changed',
        'order',
        $order->id,
        "Status pesanan {$order->order_number} berubah dari {$oldStatus} menjadi {$newStatus}",
        ['status' => $oldStatus],
        ['status' => $newStatus]
    );

    return response()->json([
        'message' => 'Order status updated successfully',
        'data' => $order->fresh(),
    ]);
}
public function track(string $trackingToken)
{
    $order = Order::with('orderItems.product', 'table')
        ->where('tracking_token', $trackingToken)
        ->first();

    if (!$order) {
        return response()->json([
            'message' => 'Order not found',
        ], 404);
    }

    return response()->json([
        'message' => 'Order retrieved successfully',
        'data' => $order,
    ]);
}
    public function updatePayment(UpdatePaymentRequest $request, Order $order)
{
    $action = $request->input('action', 'confirm');

    if ($action === 'reject') {
        if ($order->payment_status === 'paid') {
            return response()->json([
                'message' => 'Order sudah dibayar, tidak dapat ditolak.',
            ], 422);
        }

        if (empty($order->proof_image)) {
            return response()->json([
                'message' => 'Belum ada bukti pembayaran untuk ditolak.',
            ], 422);
        }

        if ($order->proof_image) {
            Storage::disk('public')->delete($order->proof_image);
        }

        $order->proof_image = null;
        $order->proof_uploaded_at = null;
        $order->payment_reject_note = $request->input('reject_note');
        $order->save();

        $fresh = $order->fresh(['table', 'orderItems.product']);

        Realtime::push('orders', [
            'type' => 'order.payment_rejected',
            'order_number' => $order->order_number,
        ]);
        Realtime::push('order:' . $order->order_number, [
            'type' => 'order.payment_rejected',
        ]);
        if (!empty($order->tracking_token)) {
            Realtime::push('order:' . $order->tracking_token, [
                'type' => 'order.payment_rejected',
            ]);
        }
        Realtime::push('dashboard', ['type' => 'orders.changed']);
        AuditLogger::record(
            'payment_rejected',
            'order',
            $order->id,
            'Bukti pembayaran pesanan ' . $order->order_number . ' ditolak'
            . ($order->payment_reject_note ? ': ' . $order->payment_reject_note : '')
        );

        return response()->json([
            'message' => 'Bukti pembayaran ditolak, pelanggan dapat mengunggah ulang.',
            'data' => $fresh,
        ]);
    }

    if ($order->payment_status === 'paid') {
        return response()->json([
            'message' => 'Order sudah dibayar.',
        ], 422);
    }

    if ($order->payment_method === 'qris' && empty($order->proof_image)) {
        return response()->json([
            'message' => 'Belum ada bukti pembayaran QRIS. Minta pelanggan mengunggah bukti terlebih dahulu.',
        ], 422);
    }

    $order->payment_status = 'paid';
    $order->paid_at = now();
    $order->payment_reject_note = null;
    $order->save();

    Realtime::push('orders', [
        'type' => 'order.payment_changed',
        'order_number' => $order->order_number,
    ]);
    Realtime::push('order:' . $order->order_number, [
        'type' => 'order.payment_changed',
    ]);
    if (!empty($order->tracking_token)) {
        Realtime::push('order:' . $order->tracking_token, [
            'type' => 'order.payment_changed',
        ]);
    }
    Realtime::push('dashboard', ['type' => 'orders.changed']);
    AuditLogger::record(
        'payment_confirmed',
        'order',
        $order->id,
        'Pembayaran pesanan ' . $order->order_number . ' dikonfirmasi'
        . ($order->payment_method === 'qris' ? ' (QRIS, bukti terverifikasi)' : ' (cash)')
    );

    return response()->json([
        'message' => 'Payment updated successfully',
        'data' => $order->fresh(),
    ]);
}

    public function uploadProof(UploadProofRequest $request, string $trackingToken)
{
    $order = Order::where('tracking_token', $trackingToken)->first();

    if (!$order) {
        return response()->json([
            'message' => 'Order not found',
        ], 404);
    }

    if (in_array($order->status, ['completed', 'cancelled'], true)) {
        return response()->json([
            'message' => 'Pesanan sudah selesai atau dibatalkan, tidak dapat mengunggah bukti.',
        ], 422);
    }

    if ($order->payment_status === 'paid') {
        return response()->json([
            'message' => 'Pesanan sudah lunas.',
        ], 422);
    }

    if ($order->payment_method !== 'qris') {
        return response()->json([
            'message' => 'Upload bukti hanya untuk pembayaran QRIS.',
        ], 422);
    }

    $old = $order->proof_image;
    $path = $request->file('proof')->store('proofs', 'public');

    if ($old) {
        Storage::disk('public')->delete($old);
    }

    $order->proof_image = $path;
    $order->proof_uploaded_at = now();
    $order->payment_reject_note = null;
    $order->save();

    $fresh = $order->fresh(['table', 'orderItems.product']);

    Realtime::push('orders', [
        'type' => 'order.proof_uploaded',
        'order_number' => $order->order_number,
    ]);
    Realtime::push('order:' . $order->order_number, [
        'type' => 'order.proof_uploaded',
    ]);
    if (!empty($order->tracking_token)) {
        Realtime::push('order:' . $order->tracking_token, [
            'type' => 'order.proof_uploaded',
        ]);
    }
    Realtime::push('dashboard', ['type' => 'orders.changed']);
    AuditLogger::record(
        'payment_proof_uploaded',
        'order',
        $order->id,
        'Bukti pembayaran pesanan ' . $order->order_number . ' diunggah pelanggan'
    );

    return response()->json([
        'message' => 'Bukti pembayaran berhasil diunggah, menunggu verifikasi kasir.',
        'data' => $fresh,
    ]);
}
}