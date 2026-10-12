# Pesanin — Backend (Laravel 12)

Sistem pemesanan restoran via QR: customer scan meja, checkout cash/QRIS, tracking realtime. Staf: admin, kasir, dapur (kitchen).

## Syarat

- PHP 8.2+, Composer, MySQL (produksi) / SQLite (testing otomatis)
- Node tidak diperlukan untuk backend

## Setup cepat (lokal/Laragon)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan storage:link
php artisan migrate --force
php artisan db:seed --force
php artisan serve
```

Env penting (`.env`):

```
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
DB_CONNECTION=mysql
DB_DATABASE=Pesanin
SEED_ADMIN_PASSWORD=Admin123!
SEED_CASHIER_PASSWORD=Cashier123!
SEED_KITCHEN_PASSWORD=Kitchen123!
```

Akun seeder: `admin@example.com`, `cashier@example.com`, `kitchen@example.com`.

## Peran & izin (ringkas)

Lihat `docs/roles-matrix.md`. Intinya (KDS):

- `admin`: full + semua transisi valid
- `cashier`: terima `pending→confirmed`, selesaikan `served→completed`, cancel, verifikasi pembayaran + laporan. Tanpa aksi dapur.
- `kitchen`: `confirmed→preparing→served(READY)→completed` via papan `/kitchen`, tanpa payment/laporan/cancel

Alur: customer `pending` → kasir terima `confirmed` (kolom NEW dapur) → dapur masak → `served` siap → `completed`. Payment tidak auto-mengubah status.

## Alur pembayaran QRIS + bukti

1. Customer checkout `payment_method=qris` → order `unpaid`, tanpa bukti.
2. Customer upload: `POST /orders/track/{token}/proof` (`proof` image max 2MB).
3. Kasir/admin lihat `proof_url` di `GET /orders/{id}` → `PATCH /orders/{id}/payment`:
   - `{"action":"confirm"}` → `paid` (QRIS wajib ada bukti, cash bebas bukti)
   - `{"action":"reject","reject_note":"..."}` → hapus bukti, customer unggah ulang.

## Testing

```bash
php artisan test
php artisan test --filter=KitchenAndPaymentTest
php artisan test --filter=RegressionP0Test
```

Testing pakai SQLite `:memory:` (lihat `phpunit.xml`). Migrasi MySQL-spesifik sudah dibuat aman untuk SQLite.

## Endpoint utama

Lihat `docs/api.md` dan `docs/openapi.yaml` untuk kontrak minimal.

- Public: `GET /products`, `POST /checkout`, `GET /orders/track/{token}`, `POST /orders/track/{token}/proof`
- Staff: `POST /login`, `GET /orders`, `PATCH /orders/{id}/status`, `PATCH /orders/{id}/payment`, `GET /dashboard/stats`, `GET /reports/sales`

## Catatan operasional

- File bukti tersimpan di disk `public/proofs` → butuh `storage:link`.
- Stok dikunci via `lockForUpdate` + decrement atomik (`where stock >= qty`), urutan lock by `product_id` cegah deadlock.
- Realtime via tabel `realtime_events` (SSE + polling fallback), bukan Websocket.
- Throttle: `login`, `public`, `checkout`, `tracking` (lihat `routes/api.php`, `bootstrap/app.php`).
