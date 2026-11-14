PLUKAKANG 2.1 — TAHAP 1 (MIGRASI DATA + KOMPATIBILITAS KATALOG/API)

ISI:
- data.json: hasil migrasi V2 -> V3 dari backup live 2026-11-08.
- index.html: katalog yang dapat membaca V2 dan V3. Data V3 dinormalisasi menjadi relasi katalog agar UI/kalkulator lama tetap berjalan.
- api/publish.js: endpoint publish menerima V2 dan V3; version.json mencatat item_count (jumlah relasi brand), product_count (jumlah Master Product), dan brand_count.
- MIGRATION-REPORT.json: ringkasan pemeriksaan migrasi.

HASIL MIGRASI:
- 9 brand
- 1.331 Master Product
- 1.331 relasi brand
- 0 penggabungan otomatis
- semua baris sumber dipertahankan sebagai Master Product terpisah
- ID Master Product dibuat deterministik dari posisi dan isi baris sumber

PENTING:
JANGAN deploy paket ini ke production dulu. admin.html yang saat ini sudah teruji masih editor V2; editor Master Product V3 dan UI kurasi manual belum selesai. Mengganti data.json sekarang akan membuat admin lama tidak bisa mengelola/publish struktur V3 dengan aman.

Tahap berikutnya adalah membangun admin V3 yang mempertahankan fitur lama (Excel import, backup/restore, draft, pengurutan, publish key yang sudah ada) serta menambah Master Product, relasi multi-brand, merge/split manual, dan riwayat kurasi. Tidak perlu mengganti token atau environment variables Vercel.
