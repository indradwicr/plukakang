# Plukakang V4 — paket pengembangan

Paket ini mempertahankan tampilan Liquid Glass yang ada dan menyederhanakan model data menjadi satu item = satu brand.

## Struktur file
- `index.html` — katalog pengguna, sudah membaca `data.json` V4 melalui `items`.
- `admin.html` — Admin, navigasi Multi-Brand/Relasi dihapus; pengelolaan item dan brand tetap tersedia.
- `data.json` — data V4 hasil migrasi, 1.331 item dan 9 brand.
- `version.json` — metadata draft untuk data V4.
- `api/publish.js` — endpoint Publish V4.
- `vercel.json` — aturan cache dari konfigurasi sebelumnya.

## Model data V4
`{ app: "plukakang", v: 4, brands: [...], items: [...] }`

Setiap item memiliki `id` permanen, `brand`, `nama`, `deskripsi`, `sub`, `kategori`, `raw`, dan `konv`. Tidak ada `products`, `product_id`, atau relasi lintas brand.

## Setup branch development
1. Salin isi paket ke root repository pada branch `plukakang-2.0`.
2. Pastikan endpoint berada di `api/publish.js`.
3. Di environment Preview Vercel, atur `GITHUB_BRANCH=plukakang-2.0`. Jangan isi `main` untuk paket ini; endpoint menolak publish ke `main`.
4. Pertahankan secret server yang sudah ada: `PLUKAKANG_PUBLISH_KEY`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`. Jangan menaruh secret di file frontend.
5. Deploy Preview dan uji katalog/Admin terlebih dahulu. Jangan publish ke produksi sebelum disetujui.

## Catatan migrasi
V3 memiliki ID pada produk induk, tetapi tidak pada setiap relasi brand. Karena V4 menjadikan setiap relasi sebagai item mandiri, ID item baru dibuat satu kali saat migrasi. Simpan `data.json` V4 ini sebagai sumber kanonis; jangan menjalankan ulang migrasi V3 jika ingin mempertahankan ID yang sama.

## Validasi yang sudah dijalankan
- 9 brand, 1.331 item.
- Semua ID item unik dan tidak kosong.
- Semua brand item terdaftar.
- Semua nama terisi dan setiap item memiliki RAW atau KONV.
- Multiset seluruh field sumber (brand, nama, deskripsi, sub, kategori, RAW, KONV) sama persis dengan backup V3.
- Sintaks JavaScript inline pada `index.html` dan `admin.html` serta `api/publish.js` lolos `node --check`.

Catatan: pengujian ini adalah validasi statis/sintaks dan integritas data, bukan pengujian browser end-to-end atau deployment live.
