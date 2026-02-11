# Rencana Migrasi ke VPS Dewaweb

Dokumen ini menjelaskan opsi dan langkah-langkah untuk memindahkan aplikasi Portal Recruitment Mobeng ke VPS Dewaweb.

## Analisis Situasi
Aplikasi saat ini menggunakan teknologi berikut:
- **Frontend**: Vite + React (TypeScript)
- **Backend/Database**: Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)

Karena aplikasi sangat bergantung pada ekosistem Supabase (bukan hanya database PostgreSQL biasa), pemindahan "database" tidak sesederhana memindahkan file SQL. Anda memiliki dua opsi utama:

---

## Opsi 1: Hybrid (Rekomendasi)
**Frontend di VPS Dewaweb, Database tetap di Supabase Cloud.**

Ini adalah opsi paling stabil, mudah, dan murah.
- **Kelebihan**: Tidak perlu mengurus server database, fitur Supabase (Auth/Storage) tetap jalan lancar, beban VPS ringan.
- **Kekurangan**: Database tidak 100% di tangan sendiri (masih SaaS).

### Langkah Implementasi:
1. **Build Frontend**: Jalankan `npm run build` untuk menghasilkan folder `dist`.
2. **Setup VPS**: Install Web Server (Nginx/Apache) di Dewaweb.
3. **Deploy**: Upload folder `dist` ke VPS.
4. **Konfigurasi**: Setup domain dan SSL (HTTPS) di VPS, pastikan Environment Variables (VITE_SUPABASE_URL, dll) sesuai.

---

## Opsi 2: Full Self-Hosted Supabase
**Aplikasi dan Seluruh Stack Supabase di VPS Dewaweb.**

Ini adalah opsi jika Anda *wajib* menaruh database di server sendiri.
- **Kelebihan**: Data 100% milik sendiri, tidak bergantung pada layanan cloud pihak ketiga.
- **Kekurangan**: 
    - **Butuh VPS Spesifikasi Tinggi**: Minimal RAM 4GB (disarankan 8GB+) dan 2 vCPU agar Docker Supabase berjalan lancar.
    - **Kompleksitas Tinggi**: Perlu maintenance Docker container, backup manual, update manual.
    - **Fitur Terbatas**: Beberapa fitur cloud mungkin perlu konfigurasi tambahan (SMTP email, S3 storage storage).

### Langkah Implementasi:
1. **Persiapan VPS**: Pastikan Docker dan Docker Compose terinstall.
2. **Install Supabase Self-Hosted**: Clone repositori docker Supabase, konfigurasi `.env`.
3. **Migrasi Data**: Backup data dari Cloud dan restore ke PostgreSQL lokal di VPS.
4. **Update Frontend**: Ubah `VITE_SUPABASE_URL` ke IP/Domain VPS Anda.
5. **Build & Deploy Frontend**: Sama seperti Opsi 1.

---

## Opsi 3: Custom Backend (Tidak Disarankan)
**Frontend di VPS, Database PostgreSQL Biasa di VPS.**

Ini berarti menulis ulang kode backend.
- **Kelebihan**: Hemat resource VPS (tidak perlu Docker berat).
- **Kekurangan**: **Harus menulis ulang semua loigk backend**. Kode `supabase.from('...')` di frontend tidak akan jalan. Anda harus membuat API sendiri (Node.js/Express) untuk menggantikan fitur Supabase. **Sangat memakan waktu.**

---

## Rekomendasi
Saya menyarankan **Opsi 1 (Hybrid)** untuk memulai agar aplikasi segera online di domain sendiri. Jika kepatuhan data mengharuskan server sendiri, pilih **Opsi 2**, namun pastikan VPS Dewaweb Anda memiliki spesifikasi yang memadai (RAM minimal 4GB).

Mohon konfirmasi opsi mana yang ingin Anda pilih?
