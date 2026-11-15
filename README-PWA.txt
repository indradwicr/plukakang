# Plukakang PWA — paket Offline Shell

## Isi
- `index.html`: salinan index (2).html dengan metadata PWA + registrasi Service Worker.
- `manifest.json`: identitas, display standalone, warna, dan ikon.
- `service-worker.js`: cache app shell saja; `data.json`, `version.json`, `/api/`, dan request eksternal tidak di-cache.
- `icons/`: ikon PWA 192px, 512px, Apple Touch Icon 180px, serta mark SVG.

## Pasang ke GitHub/Vercel
1. Buat backup branch/commit terlebih dahulu.
2. Di branch Preview (`plukakang-2.0`), ganti `index.html` dengan file dari paket ini.
3. Tambahkan `manifest.json`, `service-worker.js`, dan folder `icons/` ke root repository.
4. Commit dan tunggu Preview selesai deploy.
5. Uji Preview: buka situs, pastikan DevTools/Application menunjukkan manifest dan Service Worker aktif.
6. Uji update data: ubah/publish data melalui alur normal, reload aplikasi dengan internet aktif dan pastikan data terbaru tampil.
7. Setelah lolos uji, baru merge/deploy ke `main` (Production).

## Catatan penting
- Tidak mengubah `admin.html`, `api/`, atau alur publish.
- Offline hanya menyimpan kerangka halaman dan ikon. Data katalog tetap network-only.
- Saat online, navigasi mengutamakan HTML terbaru dari server. Saat offline, fallback ke shell yang tersimpan.
- Pastikan Vercel mengirim `service-worker.js` sebagai JavaScript (MIME `application/javascript`) dan semua file berada di root domain.
- Untuk iPhone: buka domain Production di Safari → Share → Add to Home Screen.
