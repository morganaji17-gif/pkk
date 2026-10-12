<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;

class MenuSeeder extends Seeder
{
    /**
     * Seed kategori Makanan & Minuman + 10 produk.
     * Idempoten (updateOrCreate by nama). Tidak menyentuh
     * kategori/produk/meja yang sudah ada.
     * Gambar: hotlink thumbnail Wikimedia Commons (URL kanonis
     * thumb.wikimedia.org dari API imageinfo, sudah terverifikasi).
     */
    public function run(): void
    {
        $makanan = Category::updateOrCreate(
            ['name' => 'Makanan'],
            ['description' => 'Aneka makanan utama khas warung.', 'is_active' => true]
        );

        $minuman = Category::updateOrCreate(
            ['name' => 'Minuman'],
            ['description' => 'Minuman dingin dan hangat penyegar.', 'is_active' => true]
        );

        $items = [
            // [kategori, nama, deskripsi, harga, harga_modal, gambar]
            [$makanan, 'Nasi Goreng', 'Nasi goreng spesial dengan telur dan kerupuk.', 15000, 9000,
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Nasi_goreng_indonesia.jpg/960px-Nasi_goreng_indonesia.jpg'],
            [$makanan, 'Mie Ayam', 'Mie ayam jamur dengan sawi dan kuah gurih.', 12000, 7000,
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Mi_ayam_jamur.JPG/960px-Mi_ayam_jamur.JPG'],
            [$makanan, 'Ayam Geprek + Nasi', 'Ayam crispy digeprek dengan sambal pedas dan nasi hangat.', 13000, 8000,
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Ayam_geprek.jpg/960px-Ayam_geprek.jpg'],
            [$makanan, 'Soto Ayam', 'Soto ayam kuah kuning dengan nasi, telur, dan kerupuk.', 12000, 7000,
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Soto_ayam.JPG/960px-Soto_ayam.JPG'],
            [$makanan, 'Indomie Telur', 'Indomie goreng dengan telur ceplok.', 10000, 6000,
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/14/Indomie_Mie_Goreng_Iga_Penyet_2.JPG/960px-Indomie_Mie_Goreng_Iga_Penyet_2.JPG'],
            [$minuman, 'Es Teh Manis', 'Teh manis dingin pelepas dahaga.', 5000, 2000,
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/ES_TEH_MANIS.jpg/960px-ES_TEH_MANIS.jpg'],
            [$minuman, 'Es Jeruk', 'Jeruk peras segar dengan es batu.', 6000, 3000,
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/67/Orange_juice_1_edit1.jpg/960px-Orange_juice_1_edit1.jpg'],
            [$minuman, 'Kopi Tubruk', 'Kopi tubruk arabika khas warung.', 8000, 4000,
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Kopi_Tubruk_Jakarta.jpg/960px-Kopi_Tubruk_Jakarta.jpg'],
            [$minuman, 'Milo Dingin', 'Susu coklat dingin Milo dengan es.', 10000, 6000,
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Classic_Iced_Chocolate_-_MOGUMOGU_2025-04-16.jpg/960px-Classic_Iced_Chocolate_-_MOGUMOGU_2025-04-16.jpg'],
            [$minuman, 'Jus Alpukat', 'Jus alpukat kental dengan susu coklat.', 12000, 7000,
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/Jus_alpukat_Bandung.JPG/960px-Jus_alpukat_Bandung.JPG'],
        ];

        foreach ($items as [$category, $name, $description, $price, $costPrice, $image]) {
            Product::updateOrCreate(
                ['name' => $name],
                [
                    'category_id' => $category->id,
                    'description' => $description,
                    'price' => $price,
                    'cost_price' => $costPrice,
                    'stock' => 50,
                    'image' => $image,
                    'is_active' => true,
                ]
            );
        }
    }
}
