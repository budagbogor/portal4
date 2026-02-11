# Panduan Migrasi ke VPS Dewaweb

Panduan ini mencakup dua skenario:
1.  **Hybrid (Rekomendasi)**: Aplikasi di VPS, Database tetap di Supabase Cloud.
2.  **Full Self-Hosted**: Aplikasi & Database (Supabase Stack) di VPS.

---

## Prasyarat Umum
- **VPS Dewaweb**:
    - **Hybrid**: Minimal 1GB RAM, 1 vCPU (Ubuntu 20.04/22.04 LTS).
    - **Full Self-Hosted**: Minimal **4GB RAM**, **2 vCPU** (Ubuntu 20.04/22.04 LTS). *PENTING: Supabase membutuhkan banyak resource.*
- **Domain**: Sebuah domain aktif (misal: `portal-mobeng.com`).
- **Akses SSH**: Kemampuan untuk masuk ke terminal VPS (PuTTY/Terminal).

---

## SKENARIO A: Hybrid (Aplikasi Saja)
*Paling mudah, minim error, database tetap aman di cloud.*

### 1. Persiapan Aplikasi (Lokal)
1.  Buka project di VS Code.
2.  Buat file `.env` (jika belum ada) dan isi dengan kredensial Supabase Cloud Anda:
    ```env
    VITE_SUPABASE_URL=https://ogaxelnnaxojzrbrewaf.supabase.co
    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (kunci anon Anda)
    ```
3.  Jalankan build:
    ```bash
    npm run build
    ```
4.  Hasilnya adalah folder `dist`. Folder inilah yang akan kita upload.

### 2. Setup VPS (Web Server)
Masuk ke VPS via SSH dan install Nginx:
```bash
sudo apt update
sudo apt install nginx -y
```

### 3. Upload File
Gunakan SCP atau FileZilla untuk upload isi folder `dist` (dari komputer Anda) ke folder `/var/www/html` di VPS.

### 4. Konfigurasi Nginx
Buat file konfigurasi:
```bash
sudo nano /etc/nginx/sites-available/portal
```
Isi dengan:
```nginx
server {
    listen 80;
    server_name portal-mobeng.com; # Ganti dengan domain Anda
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
Aktifkan konfigurasi:
```bash
sudo ln -s /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## SKENARIO B: Full Self-Hosted (Aplikasi + Database)
*Kompleks. Anda menjadi admin database sendiri. Pastikan VPS cukup kuat.*

### 1. Install Docker di VPS
Supabase berjalan di atas Docker.
```bash
# Install Docker
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Tambahkan repositori
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 2. Setup Supabase Self-Hosted
1.  Clone repo Supabase Docker di VPS:
    ```bash
    git clone --depth 1 https://github.com/supabase/supabase
    cd supabase/docker
    cp .env.example .env
    ```
2.  Edit `.env` di VPS:
    - `POSTGRES_PASSWORD`: Buat password database yang kuat.
    - `JWT_SECRET`: Generate string acak panjang.
    - `ANON_KEY` & `SERVICE_ROLE_KEY`: Anda harus men-generate JWT token baru menggunakan `JWT_SECRET` (bisa pakai tool online jwt.io atau script nodejs).
    - `API_EXTERNAL_URL`: `https://portal-mobeng.com` (domain Anda).

3.  Jalankan Supabase:
    ```bash
    docker compose pull
    docker compose up -d
    ```
    *Tunggu beberapa menit hingga semua container berjalan.*

### 3. Migrasi Data (Cloud -> VPS)
1.  **Backup Cloud**: Di dashboard Supabase Cloud, masuk ke Database > Backups > Download dump (`roles.sql` dan `data.sql` atau satu file `dump.sql`).
2.  **Restore ke VPS**:
    Gunakan `pg_restore` atau jalankan script SQL melalui container database di VPS.
    ```bash
    cat dump.sql | docker exec -i supabase-db psql -U postgres
    ```

### 4. Update Aplikasi Frontend
Karena backend pindah, Anda harus update aplikasi React Anda **di komputer lokal**:
1.  Buka `services/supabaseClient.ts`.
2.  Ganti `PROJECT_REF` atau nilai fallback dengan URL VPS Anda.
3.  Update `.env` lokal:
    ```env
    VITE_SUPABASE_URL=https://portal-mobeng.com
    VITE_SUPABASE_ANON_KEY=... (kunci ANON baru dari langkah 2.2)
    ```
4.  Build ulang: `npm run build`.
5.  Upload folder `dist` baru ke VPS (seperti Skenario A).

### 5. Konfigurasi Nginx untuk Proxy
Karena Supabase berjalan di port lokal (biasanya 8000/3000/5432), Anda perlu mengatur Nginx untuk meneruskan traffic:
- Traffic `/` -> file statis React (`/var/www/html`).
- Traffic `/rest`, `/auth`, `/storage` -> Proxy ke `localhost:8000` (Kong API Gateway Supabase).

Ini memerlukan konfigurasi Nginx tingkat lanjut.

---

## Kesimpulan
Jika Anda tidak memiliki tim DevOps dedicated, **pilih Skenario A**.
Mengelola database sendiri berarti Anda bertanggung jawab atas:
- Backup berkala (jika server rusak, data hilang).
- Security patching.
- Scaling jika user bertambah.

Supabase Cloud menangani semua itu untuk Anda secara gratis/murah.
