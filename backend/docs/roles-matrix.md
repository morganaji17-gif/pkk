# Matriks Peran — Pesanin (KDS)

Alur: `pending` (menunggu kasir) → `confirmed` (diterima kasir, kolom NEW dapur) → `preparing` → `served` (=READY) → `completed`, plus `cancelled`. Payment `unpaid/paid` terpisah dan tidak auto-mengubah status dapur.

| Kemampuan | admin | cashier | kitchen |
|---|---|---|---|
| Login + `/me` | ya | ya | ya |
| `GET /orders`, `GET /orders/{id}` | ya | ya | ya (tampil nama customer, tanpa tracking token di UI) |
| `PATCH /orders/{id}/status` | ya (semua transisi valid) | terbatas: `pending→confirmed/cancelled`, `confirmed→cancelled`, `preparing→cancelled`, `served→completed/cancelled`. Dilarang aksi dapur `confirmed→preparing`, `preparing→served` (403) | terbatas: `confirmed→preparing`, `preparing→served`, `served→completed`. Dilarang `cancel`/lainnya (403) |
| `PATCH /orders/{id}/payment` confirm/reject | ya | ya | tidak (403) |
| `GET /dashboard/stats` | ya | ya | ya (`confirmed_orders` untuk badge dapur) |
| `GET /realtime/events`, `/poll` | ya | ya | ya (satu koneksi bersama, tanpa SSE khusus) |
| `GET /restaurant-tables` | ya | ya | ya |
| `PATCH /restaurant-tables/{id}/status` | ya | ya | tidak |
| `GET /reports/sales`, `/export` | ya | ya | tidak (403) |
| CRUD products/categories/tables/users/settings/audit/stock | ya (admin only) | tidak | tidak |
| Upload bukti `POST /orders/track/{token}/proof` | — (public via token, hanya QRIS, belum lunas, status bukan completed/cancelled) | — | — |

Frontend:

- `/admin` → admin only, `/admin/orders/:id` reuse detail (admin full).
- `/cashier` → cashier + admin. Tombol Terima (`pending→confirmed`), Selesaikan (`served→completed`), payment. Tanpa tombol dapur.
- `/kitchen` → kitchen + admin. Papan 3 kolom NEW (`confirmed`) / PREPARING / READY (`served`), kartu tanpa harga dan tanpa token, tombol Mulai Proses / Tandai Siap / Selesaikan + loading per kartu. Banner info jika ada `pending` menunggu kasir.
- Login redirect: admin→`/admin`, kitchen→`/kitchen`, cashier→`/cashier`.
