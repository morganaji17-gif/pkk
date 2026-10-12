# Pesanin — Frontend (React 19 + Vite)

Customer: `/menu?table={id}` → cart → checkout cash/QRIS → tracking + upload bukti QRIS.
Staf: `/login` → `/admin`, `/cashier`, `/kitchen`.

## Setup

```bash
npm install
cp .env.development .env  # atau set VITE_API_BASE_URL
npm run dev      # http://localhost:5173
npm run build    # output dist/
npm run lint
```

Env:

```
VITE_API_BASE_URL=http://localhost:8000/api   # dev
VITE_API_BASE_URL=https://api.pesanin.example/api  # produksi (lihat .env.production.example)
```

## Peran

- admin → `/admin` (full) + bisa buka `/cashier`, `/kitchen`
- cashier → `/cashier` (+ laporan). Terima `pending→confirmed`, selesaikan `served→completed`, payment. Tanpa tombol dapur.
- kitchen → `/kitchen` papan KDS 3 kolom NEW (`confirmed`) / PREPARING / READY (`served`), tombol Mulai Proses / Tandai Siap / Selesaikan.
- Proteksi via `src/staff/components/ProtectedRoute.jsx` (`roles=[...]`).

## Fitur terkait backend baru

- `uploadOrderProof(token, file)` → `POST /orders/track/{token}/proof`
- `confirmOrderPayment(id)` / `rejectOrderPayment(id, note)` → `PATCH /orders/{id}/payment`
- `proof_url` di-resolve via `resolveImageUrl()` di `src/utils/format.js`
- Dashboard pakai `today_revenue/today_average/unpaid_orders/pending_proofs` dari `GET /dashboard/stats`
