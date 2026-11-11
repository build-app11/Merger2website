# Learning Fun (Generate-transcript-english)

Halaman belajar bahasa (statis) digabung dengan server Node untuk ekstraksi teks, transkripsi podcast, suara (TTS), IPA/romanisasi, dan terjemahan.

## Menjalankan

    npm install
    npm start          # http://localhost:3000  (di Codespaces: tab Ports, port 3000)

Server menyajikan halaman proyek ini (hanya `*.html`, `i18n.js`, `lf-api.js`, dan `data/*.json`; kode server dan `models/` tidak bisa diunduh) dan API di `/api/*`. `index.html` yang ada di folder ini adalah beranda; antarmuka Library lama dari Codespacegit sudah dihapus.

Paket opsional (ffmpeg, Whisper, kuromoji, pinyin-pro, phonemizer, dsb.) boleh gagal terpasang: fitur lain tetap jalan. Mesin suara butuh Python: `pip install supertonic`, `pip install piper-tts`, `pip install pocket-tts` (pilih yang dipakai). Detail mesin, model, dan variabel lingkungan ada di [docs/SERVER-TTS.md](docs/SERVER-TTS.md).

## Halaman

| Halaman | Fungsi | Memakai server untuk |
|---|---|---|
| `reading-generator.html` | Ambil teks bacaan dari teks biasa, file (PDF/EPUB/DOCX/TXT/MD/HTML), scan kamera (OCR di browser), web link, berita (RSS), dan podcast (RSS) lalu unduh JSON bertipe `read` | `/api/file`, `/api/extract`, `/api/news/*`, `/api/podcast/*` (Whisper di server) |
| `player-reading.html` | Pembaca: sorotan kalimat/kata, suara, terjemahan, romanisasi, IPA, popup arti | `/api/tts/engine` (Supertonic, Piper, Pocket), `/api/tts` (Google), `/api/phon`, `/api/translate`, `/api/word` |
| `index.html`, `index-builder.html`, `path.html`, `player-audio.html`, `player-video.html`, generator lain | Seperti sebelumnya. Pelajaran bertipe `read` tampil sebagai kartu "Read" dan dibuka di `player-reading.html` | tidak |

## Server tersambung atau tidak

`lf-api.js` memeriksa `/api/health`. Bila halaman dibuka dari server ini, fitur server aktif otomatis. Bila tidak ada server, kedua halaman memakai cadangan di browser (proxy CORS publik, pustaka dari CDN, Whisper di browser, suara bawaan perangkat, kamus online). Panel **Server** di kedua halaman menampilkan statusnya.

Halaman statis tetap bisa di-host di GitHub Pages sementara server berjalan di tempat lain: isi alamat server di panel **Server**, dan jalankan server dengan `CORS_ORIGIN=https://nama-akun.github.io npm start` (pisahkan koma untuk beberapa origin, `*` untuk semua).

## Alur kerja

1. `reading-generator.html`: pilih sumber di dropdown, ambil teks, edit, isi info, lalu **Buka di Player** (pratinjau), **Unduh JSON**, atau **Kirim ke Sync Reader**.
2. Simpan JSON ke folder `data/`, jalankan `index-builder.html` dan ganti `data/index.json`. Pelajaran muncul di beranda.
3. Buka lewat kartu, atau `player-reading.html?q=slug`.
