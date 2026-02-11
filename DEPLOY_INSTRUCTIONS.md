# Instruksi Deployment (Skenario A)

File `setup_vps.sh` dan folder `dist` sudah siap. Ikuti langkah ini untuk menaikkan website Anda.

## 1. Edit Domain
Buka file `setup_vps.sh` dan ganti baris ini dengan domain asli Anda:
```bash
DOMAIN="portal-mobeng.com" 
```

## 2. Upload ke VPS
Gunakan aplikasi seperti **FileZilla** atau **WinSCP**.
Login ke VPS Anda (IP, Username: root, Password).

1. Upload file `setup_vps.sh` ke folder `/root/`.
2. Upload **isi** dari folder `dist` (index.html, assets, dll) ke folder `/var/www/html/` di VPS.
   *(Jika folder html belum ada, buat dulu atau biarkan script membuatnya nanti, tapi lebih aman upload setelah menjalankan script atau buat folder manual).*

## 3. Jalankan Script Setup
Login ke VPS via Terminal / PuTTY, lalu jalankan:
```bash
# Beri izin eksekusi
chmod +x setup_vps.sh

# Jalankan script
./setup_vps.sh
```

## 4. Selesai
Buka domain Anda di browser. Website seharusnya sudah muncul.

---
**Catatan HTTPS (SSL):**
Untuk mengaktifkan HTTPS (gembok hijau), setelah domain terhubung ke VPS, jalankan perintah ini di VPS:
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d domain-anda.com
```
