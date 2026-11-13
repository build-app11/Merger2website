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
2. Buka `index-builder.html` (memuat `data/index.json` dari situs otomatis), pilih file JSON pelajaran yang baru (`language.json` dan `card.json` dilewati), lalu unduh `index.json` dan ganti `data/index.json`. Upload file pelajaran barunya ke `data/`.
3. Buka lewat kartu, atau `player-reading.html?q=slug`.

## Buku (banyak bab)

Satu file JSON `read` = satu bab. Di `reading-generator.html` isi kolom **Buku** dan **Nomor bab** (nama buku diingat, nomor bab berikutnya disarankan otomatis, nama file jadi `nama-buku-bab-N.json`). Atau tambahkan dua field ini langsung di JSON:

    "book": "English Grammar Basics",
    "chapter": 1

Bab dengan `book` yang sama otomatis dikelompokkan: Beranda menampilkan satu kartu "Buku · N bab" (membuka bab terakhir dibaca), dan `player-reading.html` menampilkan bilah bab (← pilih bab →) serta tombol "Bab berikutnya" di akhir bacaan. Jalankan `index-builder.html` agar `book` dan `chapter` masuk ke `data/index.json`.

### Pisah bab otomatis

Di `reading-generator.html`, setelah memuat EPUB, PDF, DOCX, TXT, atau teks panjang, bagian **Pisah per bab** mendeteksi judul bab ("Chapter 1", "Bab 2", "Part III", atau nomor berurutan "1. Judul"), lalu **Unduh ZIP** menghasilkan satu JSON per bab (`nama-buku-bab-N.json`) lengkap dengan `book` dan `chapter`. Ekstrak ke `data/` dan jalankan `index-builder.html`. Bagian yang kurang dari 30 kata (biasanya daftar isi) diabaikan. Bila tidak ada judul bab yang dikenali, teks tetap diperlakukan sebagai satu bacaan.

## Bahasa penutur dan bahasa yang dipelajari

Pengunjung baru melihat popup dua langkah di `index.html`: (1) bahasa tampilan situs (dari `data/language.json`), (2) bahasa yang ingin dipelajari. Pilihan disimpan di browser (`lf:lang`, `lf:learn`), dan Beranda hanya menampilkan pelajaran berbahasa itu. Tombol "Belajar: ..." di atas daftar membuka popup lagi.

Bahasa pelajaran dibaca dari field `lang` di `data/index.json` (kode dua huruf: `en`, `es`, `ja`, ...). Pelajaran tanpa `lang` dianggap `en`. Ketiga generator menulis `lang` dari dropdown bahasa teks/transkrip, dan `index-builder.html` membacanya otomatis. Kolom "Bahasa (kode)" di builder hanya muncul untuk file lama yang belum punya `lang`. Bahasa yang belum punya pelajaran tampil "Segera hadir" dan belum bisa dipilih.

Pilihan bahasa hanya ada di Beranda (popup dan tombol "Belajar: ..."). Halaman lain tidak punya menu bahasa: `path.html`, `playphrase.html`, dan `kosakata.html` otomatis mengikuti pilihan itu lewat `window.LFL` dari `i18n.js` (`LFL.code`, `LFL.name`, `LFL.match(pelajaran)`, `LFL.tts`). Di Kosa Kata, bahasa terjemahan = bahasa tampilan, sumber terjemahan dan suara = bahasa yang dipelajari. Daftar kata umum (stopword) di Kosa Kata masih khusus English. Popup hanya menampilkan bahasa yang sudah punya pelajaran, ditambah satu kartu "Segera hadir".

## Baris tersimpan (pin) ke deck

Di `player-video.html`, buka **Practice → Tersimpan**, lalu tekan tombol **★ Simpan N baris ke deck…** di bawah daftar baris. Tombol itu mengirim semua baris yang di-pin ke deck di Kosa Kata (Kata Berbintang atau deck buatan sendiri). Tiap baris menjadi satu kartu: depan = kalimat + IPA, belakang = terjemahan (dari subtitle kedua bila ada, bila tidak diterjemahkan otomatis ke bahasa kamus yang dipilih). Baris yang sudah ada di deck yang sama dilewati. Datanya memakai `lf:starred` dan `lf:decks`, sama dengan fitur bintang kata.
