<div align="center">

# CatatIn

**Aplikasi pencatatan cerdas berbasis web dengan AI summarization menggunakan IndoBERT**

[![Python](https://img.shields.io/badge/Python-3.9%2B-blue?logo=python&logoColor=white)](https://python.org)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![IndoBERT](https://img.shields.io/badge/IndoBERT-NLP%20Model-orange)](https://huggingface.co/indobenchmark/indobert-base-p1)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

</div>

---

## Deskripsi

**CatatIn** adalah aplikasi web untuk merekam, menyimpan, dan merangkum catatan kuliah/materi secara otomatis menggunakan model NLP berbahasa Indonesia, **IndoBERT**. Dilengkapi sistem autentikasi pengguna, manajemen mata pelajaran, dan fitur AI summarization berbasis TextRank + KMeans clustering.

---

## Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
|  **Perekaman & Transkripsi** | Rekam suara dan simpan transkrip secara otomatis |
|  **AI Summarization** | Rangkum catatan menggunakan IndoBERT + TextRank |
|  **Manajemen Mata Pelajaran** | Kelola subjek dan topik catatan |
|  **Autentikasi Aman** | Login/register dengan verifikasi OTP via email |
|  **Statistik Belajar** | Pantau jumlah rekaman dan kata yang dicatat |
|  **Riwayat Catatan** | Akses kembali semua catatan dan rangkuman |
|  **Profil Pengguna** | Kelola data diri dan institusi |

---

##  Struktur Proyek

```
CatatIn/
│
├── 📁 frontend/                        # Antarmuka pengguna
│   ├── 📁 js/                          # File JavaScript
│   │   ├── app.js                      # Entry point & navigasi halaman
│   │   ├── auth.js                     # Login, register, OTP handling
│   │   ├── auth.min.js                 # Versi minified auth.js
│   │   ├── supabase.js                 # Semua query ke Supabase
│   │   ├── supabase.min.js             # Versi minified supabase.js
│   │   ├── record.js                   # Logika perekaman suara
│   │   ├── summarize.js                # Integrasi AI summarization
│   │   ├── history.js                  # Halaman riwayat catatan
│   │   ├── profile.js                  # Halaman profil pengguna
│   │   ├── supjek.js                   # Manajemen mata pelajaran
│   │   └── supjek.min.js               # Versi minified supjek.js
│   ├── index.html                      # Halaman utama aplikasi
│   └── style.css                       # Stylesheet global
│
├── 📁 indobert_kmeans_v2_model/        # Model IndoBERT + KMeans Clustering
│   ├── config.json
│   ├── tokenizer_config.json
│   └── tokenizer.json
│
├── 📁 indobert_textrank_model/         # Model IndoBERT + TextRank Extractive
│   ├── config.json
│   ├── model.safetensors               # Bobot model (Git LFS)
│   ├── tokenizer_config.json
│   └── tokenizer.json
│
├── main.py                             # Backend API (Python/FastAPI)
├── requirements.txt                    # Dependensi Python
├── cobamic.html                        # Business Model Canvas (web view)
├── .gitignore
├── .gitattributes                      # Konfigurasi Git LFS
└── README.md
```

---

## Teknologi yang Digunakan

### Frontend
- **HTML5 / CSS3 / Vanilla JavaScript** => Antarmuka pengguna tanpa framework
- **Supabase JS Client** => Autentikasi & database realtime
- **EmailJS** => Pengiriman OTP via email

### Backend
- **Python 3.9+** => Server backend
- **FastAPI** => REST API framework
- **Transformers (HuggingFace)** => Inferensi model IndoBERT
- **PyTorch** => Deep learning runtime

### Database & Auth
- **Supabase (PostgreSQL)** => Database cloud + autentikasi
- **Row Level Security (RLS)** => Keamanan data per pengguna

### AI / NLP
- **IndoBERT** => Model bahasa Indonesia pre-trained
- **TextRank** => Extractive summarization
- **KMeans Clustering** => Pengelompokan poin-poin penting

---

## Cara Instalasi & Menjalankan

### Prasyarat
- Python 3.9 atau lebih baru
- Node.js (opsional, untuk tooling)
- Akun [Supabase](https://supabase.com)
- Akun [EmailJS](https://emailjs.com)

---

### 1. Clone Repository

```bash
git clone https://github.com/USERNAME/REPO-NAME.git
cd REPO-NAME
```

### 2. Setup Python Environment

```bash
# Buat virtual environment
python -m venv venv

# Aktifkan (Windows)
venv\Scripts\activate

# Aktifkan (Mac/Linux)
source venv/bin/activate

# Install dependensi
pip install -r requirements.txt
```

### 3. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com)
2. Jalankan SQL berikut di **SQL Editor** Supabase:

```sql
-- Tabel profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'Pelajar',
  institusi TEXT,
  email TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel subjects
CREATE TABLE subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📚',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel topics
CREATE TABLE topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel recordings
CREATE TABLE recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  transcript TEXT,
  duration_seconds INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel ai_points
CREATE TABLE ai_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  point_text TEXT NOT NULL,
  source TEXT DEFAULT 'record',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function cek email (untuk validasi registrasi)
CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE LOWER(email) = LOWER(p_email)
  );
END;
$$;
```

### 4. Konfigurasi Environment

Edit file `frontend/js/supabase.js` dan ganti dengan kredensial Supabase kamu:

```javascript
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY';
```

Edit file `frontend/js/auth.js` dan ganti dengan kredensial EmailJS:

```javascript
const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';
const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
```
Pastikan tambakan file .env anda sendiri 

### 5. Jalankan Backend

```bash
python main.py
```

Server akan berjalan di `http://localhost:8000`

### 6. Jalankan Frontend

Buka `frontend/index.html` di browser, atau gunakan Live Server (VS Code).

---

## Skema Database

```
auth.users (Supabase built-in)
     │
     ├──── profiles (1:1)
     ├──── subjects (1:N)
     │         └──── topics (1:N)
     │                   ├──── recordings (1:N)
     │                   └──── ai_points  (1:N)
```

---

## Alur Kerja AI Summarization

```
Transkrip Rekaman
       │
       ▼
  Preprocessing
  (tokenisasi, cleaning)
       │
       ▼
 IndoBERT Encoding
  (sentence embeddings)
       │
    ┌──┴──┐
    │     │
TextRank  KMeans
Scoring  Clustering
    │     │
    └──┬──┘
       │
       ▼
 Poin-Poin Penting
  (ai_points table)
```

---

##  Tim Pengembang

| Nama | Peran |
|------|-------|
| Joy Eau Dia & Karina Amalia Herferi | Frontend Developer |
| Karina Amalia Herferi & Silvanus Alvan | Model Development & Training |
| Joy Eau Dia | Backend Database|
| Silvanus Alvan, Joy Eau Dia & Fiolita Chresia Putri | data extraction (ekstraksi data) atau web scraping |

> *Proyek ini dikembangkan sebagai Final Project mata kuliah NLP, Kelompok 1*

---

## Lisensi

Proyek ini dilisensikan di bawah [XXX](LICENSE).

---

##  Harapan & Visi Pengembangan

Kami dari tim pengembang **CatatIn** memiliki harapan besar agar proyek ini tidak hanya berhenti sebagai pemenuhan tugas akademik, tetapi dapat bertransformasi menjadi solusi nyata yang bermanfaat bagi masyarakat luas.

Besar keinginan kami agar ke depannya **CatatIn** dapat terus dikembangkan menjadi alat bantu inklusif, khususnya bagi **teman-teman tuna rungu**. Kami berharap fitur transkripsi *real-time* dan ringkasan otomatis ini dapat membantu mereka dalam:
*   **Mengakses Informasi:** Memahami materi kuliah atau diskusi secara langsung melalui teks yang akurat.
*   **Kesetaraan Belajar:** Menghilangkan batasan pendengaran sehingga setiap individu memiliki peluang yang sama untuk berkembang.
*   **Kemandirian:** Menjadi asisten setia yang menjembatani komunikasi di berbagai situasi sosial maupun profesional.

Kami percaya bahwa teknologi terbaik adalah teknologi yang mampu merangkul semua orang. Melalui **CatatIn**, kami berkomitmen untuk memastikan bahwa tidak ada suara yang terabaikan dan tidak ada semangat yang terbatas oleh hambatan aksesibilitas.

<div align="center">
Dibuat dengan ❤️ oleh Tim CatatIn
</div>
