-- SQL untuk Konfirmasi Email User secara Manual
-- Gunakan ini jika Anda tidak ingin setup SMTP server untuk kirim email verifikasi.

-- 1. Konfirmasi user spesifik (Ganti email sesuai kebutuhan)
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email = 'hendrawan@mobeng.co.id';

-- 2. (Opsional) Verifikasi bahwa status sudah berubah
SELECT email, email_confirmed_at FROM auth.users WHERE email = 'hendrawan@mobeng.co.id';
