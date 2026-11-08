# Plukakang 2.0 — Hybrid Publishing Starter

Paket ini mempertahankan `index.html`, `admin.html`, dan `data.json` di root agar path lama tetap bekerja.

## Isi yang sudah diterapkan

- Tombol **Terbitkan langsung** pada Admin.
- Validasi dasar sebelum publish.
- Vercel Function `/api/publish` yang menerbitkan `data.json` dan `version.json` dalam satu commit GitHub.
- Token GitHub dan kunci publikasi berada di environment variables server, bukan di frontend.
- Jalur unduh manual tetap dipertahankan.

## Setup

1. Salin isi paket ini ke repository Plukakang.
2. Hubungkan repository dan branch produksi ke Vercel.
3. Atur environment variables seperti di `.env.example` dan ikuti `docs/publishing-hybrid.md`.
4. Redeploy project Vercel.
5. Buka Admin. Uji jalur manual terlebih dahulu, lalu uji **Terbitkan langsung** dengan perubahan kecil.

## Catatan

- Jangan commit file `.env` atau token asli.
- Admin gate lama bukan sistem autentikasi server-side. Aktifkan Vercel Deployment Protection atau pembatasan akses lain untuk melindungi halaman Admin.
- PWA/offline/update notification belum diaktifkan pada paket ini; itu tahap berikutnya setelah pipeline data stabil.
