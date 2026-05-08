<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Mobeng Portal 5 (VPS Migration)

This is the enhanced version of Mobeng Portal, optimized for VPS deployment with Global AI Key management.

## Key Features
- **Multi-Provider AI**: Supports Google Gemini, SumoPod (Custom Models), and OpenRouter (with Auto-Switch Free Models).
- **Global AI Settings**: Admin can configure AI providers and API keys globally for the entire organization.
- **AI Connection Tester**: Built-in tool to verify AI API health before deployment.
- **QR Code Invitations**: Generate role-specific QR codes for instant candidate registration via smartphone scan.
- **CI/CD Deployment**: Automatic deployment to VPS via GitHub Actions on every push to `main`.
- **System Settings**: Database-backed configuration table (`system_settings`) for all persistent app states.

## Setup & Deployment

### 1. Database Setup
Run the `fix_api_global.sql` script in your Supabase SQL Editor to create the necessary settings table:
```sql
CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT);
```

### 2. Global AI Key Configuration
1. Login to the portal as **Admin**.
2. Go to **Settings** (Gear Icon).
3. Input your Gemini API Key.
4. Click **Connect/Save**.
   - *Note: This key is now stored in the database and accessible to all valid users.*

### 3. Automatic Deployment (CI/CD)
This repository is configured with GitHub Actions.
- **Trigger**: Push to `main` branch.
- **Architecture**: Builds the React app and uploads to VPS (`/var/www/html`) via SSH.
- **Secrets Required**: `HOST`, `USERNAME`, `PASSWORD` (Configured in GitHub Repo Settings).

## Deploy ke Vercel

> [!IMPORTANT]
> **White screen di production** biasanya disebabkan oleh Environment Variables yang belum dikonfigurasi di Vercel. File `.env` ada di `.gitignore` dan **tidak ter-upload ke GitHub**, jadi Vercel perlu dikonfigurasi secara manual.

### Langkah-langkah:

1. Buka **Vercel Dashboard → Project → Settings → Environment Variables**
2. Tambahkan variabel berikut:

   | Name | Keterangan |
   |------|------------|
   | `VITE_SUPABASE_URL` | URL project Supabase Anda |
   | `VITE_SUPABASE_ANON_KEY` | Anon Key dari Supabase |
   | `VITE_NVIDIA_API_KEY` | (Opsional) API Key NVIDIA untuk fallback AI |

3. Pastikan **Environment** dipilih: `Production`, `Preview`, dan `Development`
4. Klik **Save**
5. Klik **Deployments → Redeploy** agar perubahan aktif

---

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```
2. Buat file `.env` di root project (salin dari `.env.example`):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   VITE_NVIDIA_API_KEY=nvapi-...
   ```
3. Jalankan app:
   ```
   npm run dev
   ```
