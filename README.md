# GBIF Biodiversity Trend Analyzer

GBIF Biodiversity Trend Analyzer adalah platform analisis bibliometrik dan spasiotemporal distribusi biodiversitas menggunakan data real-time GBIF (Global Biodiversity Information Facility). Platform ini menyediakan visualisasi peta interaktif, grafik tren statistik otomatis, analisis jaringan spesies (species network), filter taksonomi yang mendalam, serta fitur ekspor laporan komprehensif ke format PDF dan PNG.

---

## Fitur Utama

1. **Analisis Spasial (Peta Interaktif)**
   - Menggunakan **Leaflet** untuk memetakan koordinat temuan spesies secara real-time.
   - Penanda (markers) menggunakan animasi *pulse* SVG dengan warna dinamis yang merepresentasikan **Basis of Record** (misalnya observasi manusia, spesimen museum, observasi mesin, dll.).
   - Dilengkapi detail tooltip/popup untuk setiap titik temuan individu.

2. **Visualisasi Tren Statistik (Charts)**
   - Didukung oleh **Recharts** untuk visualisasi yang bersih dan responsif.
   - **Tren Temporal**: Perkembangan temuan spesies dari tahun ke tahun (1700 - 2026).
   - **Keanekaragaman Taksonomi**: Grafik batang yang merangkum genus, famili, atau kelas yang paling dominan dalam dataset.
   - **Musiman (Seasonality)**: Analisis distribusi temuan berdasarkan bulan (Januari - Desember) untuk mendeteksi pola musim kawin, migrasi, atau pembungaan.
   - **Basis Pencatatan**: Diagram lingkaran (pie chart) distribusi basis pencatatan data.
   - **Analisis Negara**: Distribusi temuan berdasarkan batas administrasi negara.

3. **Jaringan Spesies (Species Network)**
   - Visualisasi grafis hubungan keterkaitan antarspesies yang dibangun menggunakan **D3.js (Force-directed Graph)**.
   - Mengkalkulasi bobot relasi berdasarkan tiga metrik utama:
     - **Bobot Taksonomi**: Kesamaan tingkat takson (Genus, Famili, Ordo, Kelas, Filum).
     - **Bobot Spasial (Sympatry)**: Kesamaan habitat/lokasi berdasarkan pembagian grid koordinat.
     - **Bobot Geografis**: Distribusi wilayah negara yang tumpang tindih.
   - Dilengkapi fitur interaktif seperti zoom in/out, seret node (drag), detail tooltip, dan pengaturan ambang batas bobot relasi minimum.

4. **Unggah Berkas CSV Kustom**
   - Parser CSV client-side yang andal (menangani baris baru, tanda kutip ganda, dan karakter khusus).
   - Pemetaan otomatis kolom (mapping) berbasis sinonim nama kolom (misalnya mendeteksi `gbifid`, `scientificname`, `latitude`, `longitude`, `year` secara otomatis).

5. **Ekspor Laporan Komprehensif**
   - Menghasilkan laporan berformat **PDF** multi-halaman atau gambar **PNG** sekali klik menggunakan `html2canvas` dan `jsPDF`.
   - Menyertakan **Oklch Color Polyfill** khusus untuk mengatasi keterbatasan render warna `oklch()` CSS Tailwind v4 pada elemen Canvas.

6. **Server Proxy GBIF Terintegrasi**
   - Server Node.js/Express lokal menyediakan rute `/api/gbif/*` sebagai *proxy* ke API GBIF pusat untuk memintas CORS, pembatasan iframe sandboxing, dan pencegahan adblocker.

---

## Spesifikasi Teknologi

- **Frontend**: React 19, TypeScript, Vite 6, TailwindCSS v4
- **Visualisasi**: Leaflet 1.9 (Peta), Recharts 3.9 (Grafik), D3 7.9 (Jaringan Relasi)
- **Ekspor & Utilitas**: html2canvas 1.4, jsPDF 4.2, Motion 12, Lucide React
- **Backend / Dev Server**: Express 4, tsx (TypeScript Execute), esbuild

---

## Menjalankan Aplikasi Secara Lokal

### Prasyarat
- **Node.js** (versi 18 ke atas direkomendasikan)
- Koneksi Internet (untuk memuat peta Leaflet dan data GBIF)

### Langkah-langkah
1. **Instalasi Dependensi**
   ```bash
   npm install
   ```

2. **Konfigurasi Variabel Lingkungan**
   Salin berkas `.env.example` menjadi `.env.local` atau `.env`:
   ```bash
   cp .env.example .env.local
   ```
   Atur kunci API Gemini Anda jika diperlukan:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Jalankan Mode Pengembangan**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan pada: **http://localhost:3000**

4. **Membangun untuk Produksi**
   ```bash
   npm run build
   ```
   Hasil build akan diletakkan di direktori `dist/` dan server Express akan dibundel ke `dist/server.cjs`.

5. **Menjalankan Hasil Produksi**
   ```bash
   npm start
   ```

---

## Struktur Direktori Utama

```
gbif-biodiversity-trend-analyzer/
├── .agents/               # Aturan & konteks AI Agent (workspace-scoped)
│   └── AGENTS.md          # Panduan instan bagi AI Agent
├── assets/                # Aset gambar statis
├── src/
│   ├── components/        # Komponen UI Dashboard
│   │   ├── FilterSidebar.tsx    # Panel pencarian & filter taksonomi GBIF
│   │   ├── MapComponent.tsx     # Peta spasial titik temuan (Leaflet)
│   │   ├── OccurrenceCharts.tsx # Visualisasi grafik recharts
│   │   ├── OccurrenceTable.tsx  # Tabel data temuan berhalaman
│   │   └── SpeciesNetwork.tsx   # Graf interaktif D3.js relasi spesies
│   ├── utils/             # Fungsi utilitas helper
│   │   ├── csvParser.ts         # Parser & mapper berkas CSV kustom
│   │   ├── gbifService.ts       # Integrasi API GBIF
│   │   ├── reportExporter.ts    # Mekanisme ekspor laporan PDF/PNG
│   │   └── sampleDatasets.ts    # Data sampel awal (Harimau Sumatra)
│   ├── App.tsx            # Komponen utama pengelola state & tata letak
│   ├── types.ts           # Definisi interface TypeScript
│   ├── index.css          # Desain TailwindCSS & variabel global
│   └── main.tsx           # Entry point aplikasi React
├── ROADMAP.md             # Peta jalan pengembangan aplikasi
├── server.ts              # Server Express.js (GBIF CORS Proxy & Static Host)
├── package.json           # File konfigurasi dependensi & skrip npm
└── tsconfig.json          # Konfigurasi TypeScript compiler
```

---
*Dikembangkan dengan standar kualitas tinggi untuk keandalan analisis keanekaragaman hayati.*
