# Plukakang 2.0 — Hybrid Publishing

## Alur

- Manual: Admin → **Unduh data.json** → commit/upload `data.json` ke repository. Jalur ini tetap menjadi fallback.
- Direct: Admin → **Terbitkan langsung** → masukkan `PLUKAKANG_PUBLISH_KEY` → API Vercel memvalidasi payload → membuat satu commit GitHub yang memperbarui `data.json` dan `version.json` secara atomik.
- Jika repository terhubung ke Vercel, commit pada branch yang dipilih akan memicu deployment sesuai pengaturan project Vercel.

## Konfigurasi Vercel

Tambahkan Environment Variables berikut di Project Settings → Environment Variables:

- `PLUKAKANG_PUBLISH_KEY`: rahasia acak panjang, minimal 32 karakter. Gunakan nilai yang sama saat diminta oleh Admin.
- `GITHUB_TOKEN`: GitHub fine-grained personal access token dengan akses **Contents: Read and write** hanya ke repository Plukakang.
- `GITHUB_OWNER`: username atau organisasi pemilik repository.
- `GITHUB_REPO`: nama repository.
- `GITHUB_BRANCH`: branch produksi, biasanya `main`.

Setelah mengatur environment variables, lakukan redeploy. Jangan menaruh GitHub token atau publish key di `admin.html`, `index.html`, `data.json`, atau repository.

## Keamanan

- API hanya menerima POST dan memeriksa same-origin ketika header Origin tersedia.
- Kunci publikasi diverifikasi di server dengan perbandingan waktu-konstan.
- GitHub token hanya dibaca dari environment server.
- Admin lama masih memiliki password gate berbasis JavaScript. Gate itu hanya penghalang tampilan, bukan autentikasi yang kuat. Batasi akses URL admin dengan Vercel Deployment Protection / autentikasi hosting bila admin tidak boleh diakses publik.
- Jangan membagikan `PLUKAKANG_PUBLISH_KEY` kepada pengguna aplikasi.

## Validasi dan konflik

API memeriksa identitas aplikasi, versi skema, daftar brand, ID brand unik, dan kelengkapan item serta referensi brand. Bila branch berubah saat proses publikasi, API mengembalikan konflik; muat ulang data live dan ulangi setelah memeriksa perubahan.

## Batasan implementasi tahap ini

API membuat commit ke GitHub. Deployment Vercel tidak dipaksakan oleh API; deployment berjalan bila repository/branch tersebut memang terhubung sebagai sumber project Vercel. Tombol direct publish menandai data terkirim ke GitHub, bukan mengklaim deployment sudah selesai.
