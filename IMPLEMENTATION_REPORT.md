# Laporan Implementasi Product Options / Customization

## 1. File Backend yang Dibuat/Diubah

### Migrasi Baru
- `backend/database/migrations/2026_11_04_000001_add_option_group_fields_to_product_option_groups_table.php`
  - Menambahkan kolom: `required`, `min_selections`, `max_selections`, `sort_order`
- `backend/database/migrations/2026_11_04_000002_add_sort_order_to_product_options_table.php`
  - Menambahkan kolom: `sort_order`

### Model
- `backend/app/Models/ProductOptionGroup.php` — update fillable & casts
- `backend/app/Models/ProductOption.php` — update fillable & casts

### Controller
- `backend/app/Http/Controllers/Api/ProductOptionsController.php`
  - `store()`: menerima field `required`, `min_selections`, `max_selections`, `sort_order`
  - `update()`: menerima field yang sama
  - `addOption()`: menerima field `sort_order`
  - `updateOption()`: menerima field `sort_order`

### Service
- `backend/app/Services/CheckoutService.php`
  - `resolveAndAccumulateOptions()`: validasi required groups, min/max selections
  - Snapshot opsi disimpan immutable (label, harga dari DB, bukan dari payload)
  - Harga dihitung ulang dari database (tidak mempercayai frontend)

### Seeder
- `backend/database/seeders/ProductOptionSeeder.php` — default opsi untuk semua produk
- `backend/database/seeders/DatabaseSeeder.php` — register seeder baru
- `backend/app/Services/ProductOptionDefaults.php` — helper apply default options

## 2. File Frontend yang Dibuat/Diubah

### Komponen Baru
- `frontend/src/staff/views/admin/ProductOptionDefaultsModal.jsx`
  - Modal konfigurasi opsi default (tersimpan di localStorage)
  - Bisa edit nama grup, tipe pilihan, harga tambahan
  - Reset ke default
  
- `frontend/src/staff/views/admin/ProductOptionsEditor.jsx`
  - Panel mengelola opsi per produk di halaman Admin → Produk
  - Tambah/edit/hapus grup opsi
  - Tambah/edit/hapus opsi dalam grup
  - Support field: required, min_selections, max_selections, sort_order

### Komponen yang Diubah
- `frontend/src/components/ProductDetailSheet.jsx`
  - Validasi wajib pilih semua opsi sebelum bisa masuk keranjang
  - Badge "Wajib pilih" untuk grup required
  - keterangan min/max selections
  - Tombol disabled sampai semua opsi wajib dipilih

- `frontend/src/staff/views/admin/ProductsPage.jsx`
  - Tombol "Kelola Opsi" di setiap baris produk
  - Panel opsi expandable di bawah baris produk

- `frontend/src/api/client.js`
  - `normalizeProduct()`: normalisasi `option_groups` → `optionGroups`
  - `peekProductCache()` & `getProduct()` menggunakan normalize

## 3. Struktur Database

### product_option_groups
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | bigint | PK |
| product_id | bigint | FK → products |
| name | string(100) | Nama grup (mis. Level Pedas) |
| selection_type | enum | single / multiple |
| required | boolean | Apakah wajib dipilih |
| min_selections | tinyint | Minimum pilihan (default 1) |
| max_selections | tinyint nullable | Maximum pilihan (null = unlimited) |
| sort_order | int | Urutan tampilkan (default 0) |
| timestamps | - | created_at, updated_at |

### product_options
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | bigint | PK |
| option_group_id | bigint | FK → product_option_groups |
| label | string(100) | Nama opsi (mis. Pedas) |
| additional_price | decimal | Harga tambahan (default 0) |
| sort_order | int | Urutan tampilkan |
| timestamps | - | created_at, updated_at |

## 4. Struktur Opsi Default

```json
[
  {
    "name": "Level Kepedasan",
    "selection_type": "single",
    "required": true,
    "min_selections": 1,
    "max_selections": 1,
    "options": [
      { "label": "Tidak Pedas", "additional_price": 0 },
      { "label": "Level 1", "additional_price": 0 },
      { "label": "Level 2", "additional_price": 0 },
      { "label": "Level 3", "additional_price": 0 },
      { "label": "Level 4", "additional_price": 0 },
      { "label": "Level 5", "additional_price": 0 }
    ]
  },
  {
    "name": "Ice / No Ice",
    "selection_type": "single",
    "required": true,
    "min_selections": 1,
    "max_selections": 1,
    "options": [
      { "label": "Ice", "additional_price": 0 },
      { "label": "No Ice", "additional_price": 0 }
    ]
  },
  {
    "name": "Level Gula",
    "selection_type": "single",
    "required": true,
    "min_selections": 1,
    "max_selections": 1,
    "options": [
      { "label": "Less Sugar", "additional_price": 0 },
      { "label": "Normal Sugar", "additional_price": 0 },
      { "label": "High Sugar", "additional_price": 0 }
    ]
  }
]
```

## 5. Endpoint API yang Digunakan

### Admin (memerlukan role admin)
- `GET /api/products/{product}/options` — list semua grup
- `POST /api/products/{product}/options` — buat grup baru
- `PATCH /api/products/{product}/options/{group}` — update grup
- `DELETE /api/products/{product}/options/{group}` — hapus grup
- `GET /api/products/{product}/options/{group}/options` — list opsi
- `POST /api/products/{product}/options/{group}/options` — tambah opsi
- `PATCH /api/products/{product}/options/{group}/options/{option}` — update opsi
- `DELETE /api/products/{product}/options/{group}/options/{option}` — hapus opsi

### Customer
- `GET /api/products` — daftar produk (termasuk optionGroups)
- `GET /api/products/{id}` — detail produk
- `POST /api/checkout` — checkout dengan selected_options

## 6. Cara Admin Membuat Opsi

1. Buka halaman **Admin → Produk**
2. Klik tombol **"Kelola Opsi"** pada baris produk yang diinginkan
3. Panel akan muncul di bawah baris produk
4. Di panel tersebut admin bisa:
   - Tambah grup baru (nama, tipe single/multiple, wajib/tidak, min/max)
   - Edit/hapus grup
   - Tambah opsi di dalam grup (label, harga tambahan)
   - Edit/hapus opsi
5. Untuk mengatur default semua produk baru: klik tombol **"Opsi Default"** di kanan atas halaman produk

## 7. Cara Pelanggan Memilih dan Mengedit Opsi

### Pemilihan Opsi
1. Pelanggan klik salah satu produk di menu
2. Drawer/detail sheet akan terbuka
3. Jika produk memiliki opsi:
   - Setiap grup wajib ditampilkan badge **"Wajib pilih"**
   - Keterangan min/max ditampilkan di samping nama grup
   - Radio button untuk single choice
   - Checkbox untuk multiple choice
4. Tombol **"Tambah ke Keranjang"** disabled sampai semua opsi wajib dipilih
5. Total harga diperbarui otomatis berdasarkan opsi yang dipilih

### Edit Cart Item
1. Di keranjang, klik icon edit pada item
2. Drawer/options modal terbuka kembali
3. Pilihan sebelumnya sudah terpilih
4. Pelanggan bisa mengubah pilihan
5. Simpan untuk memperbarui item di keranjang

## 8. Hasil Pengujian Backend

```
Tests:    59 passed (259 assertions)
Duration: ~3s
```

Test coverage:
- Admin bisa buat grup opsi
- Admin bisa tambah opsi ke grup
- Produk tanpa opsi tetap bisa dipesan
- Checkout menolak jika opsi wajib tidak dipilih
- Checkout menerima seleksi opsi yang valid
- Harga opsi dihitung dari database (bukan payload)
- Opsi dari produk lain ditolak
- Customer tidak bisa akses endpoint admin
- Multiple choice menghormati batas min/max

## 9. Hasil Lint dan Build

### Frontend
- ✅ `npm run lint` bersih (0 errors, 1 warning)
- ✅ `npm run build` sukses

### Backend
- ✅ PHP syntax check bersih
- ✅ Semua test lulus

## 10. Kendala / Keputusan Bisnis

1. **Opsi default untuk semua produk**: Saya buat menggunakan seeder yang menjalankan `ProductOptionDefaults::apply()` untuk setiap produk yang ada. Produk baru juga otomatis mendapat opsi ini saat dibuat.

2. **Konfigurasi global vs per-produk**: Opsi default disimpan di localStorage browser (bukan database) agar admin bisa mengubahnya tanpa deploy ulang. Namun untuk konsistensi, ada juga seeder yang bisa dijalankan ulang.

3. **Validasi required di backend**: Sebelumnya validasi hanya mengecek keberadaan opsi, sekarang juga mengecek apakah semua required group sudah dipilih sesuai min/max.

4. **Struktur snapshot**: Snapshot menyimpan `option_group_id`, `option_group_label`, `option_id`, `option_label`, dan `additional_price`. Label disimpan karena bisa berubah seiring waktu (admin bisa rename opsi), sehingga pesanan lama tetap bisa dibaca dengan benar.

5. **Tidak ada hardcode**: Opsi default (Level Kepedasan, Ice/No Ice, Level Gula) hanya sebagai contoh awal. Admin bisa menghapus, menambah, atau mengedit sesuai kebutuhan restoran.

## Definisi Done ✅

- [x] Admin dapat mengatur grup dan pilihan opsi produk
- [x] Admin dapat mengatur harga tambahan
- [x] Admin dapat menentukan opsi wajib atau opsional
- [x] Admin dapat menentukan single choice atau multiple choice
- [x] Pelanggan memilih opsi sebelum menambahkan produk ke cart
- [x] Opsi wajib divalidasi (frontend + backend)
- [x] Harga dihitung dengan benar (dari database, bukan frontend)
- [x] Cart menyimpan opsi
- [x] Cart item dapat diedit (melalui modal opsi)
- [x] Checkout memvalidasi opsi di backend
- [x] Harga tidak dapat dimanipulasi melalui frontend
- [x] Snapshot opsi tersimpan pada order item
- [x] Opsi tampil pada detail pesanan (kasir, kitchen, tracking)
- [x] Produk lama tanpa opsi tetap berjalan
- [x] Automated tests lulus (59 tests)
- [x] `npm run lint` lulus (0 errors)
- [x] `npm run build` lulus
- [x] Tidak ada commit atau push
