# Pesanin

Sistem pemesanan restoran berbasis **QR code**. Pelanggan scan QR meja → pilih menu → checkout (cash/QRIS) → pantau pesanan realtime. Staf (admin, kasir, dapur) kelola pesanan lewat dashboard masing-masing.

## Fitur Utama

**Pelanggan**
- Scan QR meja → buka menu (`/menu?t={token}`)
- Pilih produk + opsi/varian (level pedas, ice/no ice, dll.)
- Keranjang, edit item, catatan
- Checkout: bayar di kasir (cash) atau QRIS + upload bukti transfer
- Tracking status pesanan realtime (SSE + polling fallback)

**Staf**
- **Admin** (`/admin`) — dashboard, produk, kategori, opsi produk, meja & QR, staf, laporan penjualan, audit log, riwayat stok, pengaturan
- **Kasir** (`/cashier`) — kelola pesanan, verifikasi pembayaran, meja, laporan
- **Dapur** (`/kitchen`) — papan KDS 3 kolom: NEW → PREPARING → READY

## Tech Stack

| Bagian | Teknologi |
|--------|-----------|
| Backend | Laravel 12, PHP 8.2+, Laravel Sanctum, MySQL/SQLite |
| Frontend | React 19, Vite 8, React Router 7, Framer Motion, SweetAlert2 |
| Realtime | SSE + polling fallback (tabel `realtime_events`) |
| PDF/QR | barryvdh/laravel-dompdf, simplesoftwareio/simple-qrcode |
| Video promo | Remotion (folder `video/` — toolchain lokal, tidak di-deploy) |

## Struktur Monorepo

```
pkk/
├── backend/     # API Laravel 12
├── frontend/    # SPA React 19 + Vite
├── video/       # Project Remotion (video promosi) — lokal, di-gitignore
└── README.md
```

## Prasyarat

- PHP 8.2+, Composer
- Node.js 20+, npm
- MySQL (produksi) atau SQLite (testing)

## Setup Cepat

### 1. Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan storage:link
php artisan migrate --force
php artisan db:seed --force
php artisan serve            # http://localhost:8000
```

Env penting (`.env`):

```env
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
DB_CONNECTION=mysql
DB_DATABASE=Pesanin
SEED_ADMIN_PASSWORD=Admin123!
SEED_CASHIER_PASSWORD=Cashier123!
SEED_KITCHEN_PASSWORD=Kitchen123!
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # set VITE_API_BASE_URL
npm run dev                  # http://localhost:5173
```

Env (`.env`):

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## Akun Demo (hasil seeder)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `Admin123!` |
| Kasir | `cashier@example.com` | `Cashier123!` |
| Dapur | `kitchen@example.com` | `Kitchen123!` |

## Alur Pesanan

```
pending ──(kasir terima)──▶ confirmed ──(dapur)──▶ preparing ──▶ served ──(kasir)──▶ completed
   │
   └──▶ cancelled
```

Status pembayaran tidak otomatis mengubah status pesanan.

**Pembayaran QRIS:** checkout → `unpaid` → customer upload bukti (`POST /orders/track/{token}/proof`, maks 2MB) → kasir konfirmasi/tolak via `PATCH /orders/{id}/payment`.

## Testing

```bash
cd backend
php artisan test
php artisan test --filter=KitchenAndPaymentTest
php artisan test --filter=RegressionP0Test
```

Testing pakai SQLite `:memory:` (lihat `phpunit.xml`).

## Build & Deploy

**Backend (server):**

```bash
composer install --no-dev --optimize-autoloader
cp .env.example .env         # isi kredensial produksi
php artisan key:generate
php artisan migrate --force
php artisan storage:link
php artisan config:cache && php artisan route:cache
```

**Frontend (server):**

```bash
npm ci
npm run build                # output ke dist/
```

Catatan:
- `backend/vendor/`, `frontend/node_modules/`, `frontend/dist/`, dan `.env` **sudah di-gitignore** — install/build di server.
- `video/` juga di-gitignore (toolchain lokal, tidak ikut deploy).

## Endpoint API Utama

**Public / Pelanggan**
- `GET /products`, `GET /products/{id}`, `GET /categories`
- `GET /tables/resolve/{token}`, `GET /restaurant-tables/{id}/qr`
- `POST /checkout`
- `GET /orders/track/{token}`, `POST /orders/track/{token}/proof`
- `GET /health`

**Staf**
- `POST /login`, `POST /logout`, `GET /me`
- `GET /orders`, `PATCH /orders/{id}/status`, `PATCH /orders/{id}/payment`
- `GET /dashboard/stats`, `GET /reports/sales`
- Admin: `products`, `categories`, `restaurant-tables`, `users`, `settings/*`, `audit-logs`, `stock-mutations`

Kontrak lengkap: [`backend/docs/api.md`](backend/docs/api.md), [`backend/docs/openapi.yaml`](backend/docs/openapi.yaml), [`backend/docs/roles-matrix.md`](backend/docs/roles-matrix.md).

## Role & Izin

- `admin` — akses penuh + semua transisi status
- `cashier` — terima `pending→confirmed`, selesaikan `served→completed`, cancel, verifikasi pembayaran + laporan
- `kitchen` — `confirmed→preparing→served→completed` via papan `/kitchen` saja

## Lisensi

Internal / belum ditentukan.
