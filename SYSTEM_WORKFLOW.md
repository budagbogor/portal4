# Mobeng Portal 5 - System Workflow

Dokumen ini menjelaskan alur kerja sistem dari sisi Rekruter dan Kandidat, serta bagaimana AI memproses data.

## 1. Alur Kerja Rekruter (Setup & Monitoring)

```mermaid
graph TD
    A[Login Admin/HC] --> B[Konfigurasi AI]
    B --> C{Pilih Provider}
    C -->|Gemini| D[Input Google Key]
    C -->|OpenRouter| E[Input OR Key & Auto-Switch]
    C -->|SumoPod| F[Input Sumo Key & Model]
    D & E & F --> G[Test Koneksi AI]
    G --> H[Simpan Pengaturan Global]
    H --> I[Generate QR Code Posisi]
    I --> J[Kirim Undangan WA]
    J --> K[Monitor Dashboard Real-time]
```

## 2. Alur Kerja Kandidat (Testing Phase)

```mermaid
graph TD
    L[Scan QR / Klik Link] --> M[Intro & Device Check]
    M --> N{Izin Kamera & Mic}
    N -->|Denied| O[Blokir Akses]
    N -->|Granted| P[Data Entry & Foto Profile]
    P --> Q[Test 1: Logika & SJT]
    Q --> R[Test 2: Simulasi AI Interview]
    R --> S[Proctoring: Deteksi Curang/Tab Switch]
    S --> T[Selesai & Kirim Jawaban]
    T --> U[Final AI Analysis]
```

## 3. Alur Kerja Mesin AI (Processing Engine)

```mermaid
sequenceDiagram
    participant K as Kandidat
    participant S as System (Portal)
    participant A as AI Provider (Preferred)
    participant N as NVIDIA (Fallback)
    participant D as Database

    K->>S: Kirim Jawaban Chat
    S->>A: Request Analysis (JSON Prompt)
    alt Provider Success
        A-->>S: Return Chat Response & Scores
    else Provider Fail
        S->>N: Request Analysis (Fallback)
        N-->>S: Return Chat Response & Scores
    end
    S->>D: Simpan Transcript & Score
    S->>K: Tampilkan Respon Chat
```

## 4. Metodologi Penilaian (Psychometric Framework)

Sistem ini menggunakan framework **Google Hiring Attributes** yang disesuaikan dengan kebutuhan industri otomotif Mobeng:

1.  **GCA (General Cognitive Ability)**: Diukur melalui skor Logika dan struktur jawaban.
2.  **RRK (Role-Related Knowledge)**: Diukur melalui simulasi kasus teknis bengkel/retail.
3.  **Culture Fit**: Penilaian nilai-nilai *Introspeksi, Innovasi, Komitmen, Kolaborasi*.
4.  **Big Five Personality (OCEAN)**: Analisis linguistik terhadap pola komunikasi kandidat.
5.  **STAR Method**: Evaluasi bagaimana kandidat menjelaskan tindakan dan hasil dari sebuah situasi.

---
*Dokumen ini dibuat otomatis oleh Antigravity AI untuk Mobeng Portal 5.*
