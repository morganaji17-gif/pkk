# API Minimal — Pesanin

Base URL: `http://localhost:8000/api` (lihat `frontend/.env.development` → `VITE_API_BASE_URL`).

## Auth

### POST /login
Body: `{"email":"admin@example.com","password":"Admin123!"}`
200: `{"token":"...","user":{"id":1,"name":"Admin","email":"...","role":"admin"}}`
401: invalid credentials. Throttle `login`.

### GET /me (Bearer)
200: `{"id":1,"name":"...","email":"...","role":"admin"}`

### POST /logout (Bearer)
Hapus semua token user.

## Customer (public)

### POST /checkout
Throttle `checkout`.
Body baru:
```json
{
  "restaurant_table_id": 1,
  "customer_name": "Budi",
  "payment_method": "qris",
  "notes": "opsional",
  "items": [{"product_id":1,"quantity":2,"notes":"opsional"}]
}
```
Body tambah menu: tambah `"tracking_token":"64-hex"`.
- 201 order baru, 200 append sukses.
- 422: meja maintenance, produk nonaktif, stok kurang, token salah meja, status tidak appendable.

### GET /orders/track/{trackingToken}
Throttle `tracking`. 200 order + `proof_url`, `payment_reject_note`. 404 jika token salah.

### POST /orders/track/{trackingToken}/proof
Throttle `checkout`. Form-data: `proof` (jpg/png/webp, max 2MB).
Syarat: order QRIS, belum lunas, status bukan completed/cancelled.
200: `{"message":"Bukti pembayaran berhasil diunggah...","data":order}`

## Staff (Bearer + role)

Header: `Authorization: Bearer <token>`.

### GET /orders?search=&status=&payment_status=&page=&per_page=
Roles: admin, cashier, kitchen.

### GET /orders/{id}
Roles: admin, cashier, kitchen. Termasuk `proof_url`.

### PATCH /orders/{id}/status
Roles: admin (full), cashier (terbatas), kitchen (terbatas, lihat roles-matrix).
Body: `{"status":"confirmed"}` enum `pending,confirmed,preparing,served,completed,cancelled`.
Alur KDS: `pending→confirmed` (kasir), `confirmed→preparing→served` (dapur, served=READY), `served→completed`.
- 200 sukses, 422 transisi tidak valid / sudah sama, 403 di luar izin peran.

### PATCH /orders/{id}/payment
Roles: admin, cashier.
Body: `{"action":"confirm"}` default, atau `{"action":"reject","reject_note":"..."}`
- confirm QRIS tanpa `proof_image` → 422.
- confirm jika sudah paid → 422.
- reject hapus file bukti, set `payment_reject_note`, order tetap `unpaid`.

### GET /dashboard/stats
Roles: admin, cashier, kitchen.
```json
{
  "pending_orders": 2, "confirmed_orders": 1, "preparing_orders": 1, "ready_orders": 1,
  "unpaid_orders": 3, "pending_proofs": 1,
  "occupied_tables": 2, "low_stock_count": 0, "maintenance_tables": 0,
  "today_revenue": 150000, "today_transactions": 5, "today_paid": 4,
  "today_unpaid": 1, "today_quantity": 10, "today_profit": 40000, "today_average": 37500
}
```

### GET /reports/sales?period=day|week|month&date=YYYY-MM-DD
Roles: admin, cashier. Lihat `SalesReportService` untuk `summary`, `top_products`, `category_breakdown`.
Export: `GET /reports/sales/export?period=&date=[&format=csv]` → PDF default, CSV jika `format=csv`.

## Error umum

- 401: tanpa/expired token.
- 403: role tidak diizinkan (`RoleMiddleware`).
- 422: validasi (`errors` berisi field).
- Response sukses staff: `{"message":"...","data":...}` atau `{"data":[...],"meta":{...}}` untuk list.
