# Learning Fun (Generate-transcript-english)

Halaman belajar bahasa (statis) digabung dengan server Node untuk ekstraksi teks, transkripsi podcast, suara (TTS), IPA/romanisasi, dan terjemahan.

## Menjalankan

    npm install
    npm start          # http://localhost:3000  (di Codespaces: tab Ports, port 3000)

Server menyajikan halaman proyek ini (hanya `*.html`, `i18n.js`, `lf-api.js`, `lf-stats.js`, dan `data/*.json`; kode server dan `models/` tidak bisa diunduh) dan API di `/api/*`. `index.html` yang ada di folder ini adalah beranda; antarmuka Library lama sudah dihapus.

Paket opsional (ffmpeg, Whisper, kuromoji, pinyin-pro, phonemizer, dsb.) boleh gagal terpasang: fitur lain tetap jalan. Mesin suara butuh Python: `pip install supertonic`, `pip install piper-tts`, `pip install pocket-tts` (pilih yang dipakai). Detail mesin, model, dan variabel lingkungan ada di [docs/SERVER-TTS.md](docs/SERVER-TTS.md).

## Keamanan dan pengaturan server

Semua diatur lewat variabel lingkungan (tanpa mengubah kode):

| Variabel | Fungsi |
|---|---|
| `PORT` | Port server (bawaan 3000). |
| `CORS_ORIGIN` | Origin halaman statis yang boleh memanggil API, dipisah koma (mis. `https://nama.github.io`). Jangan pakai `*` di produksi: server memberi peringatan. |
| `TRUST_PROXY` | Isi (mis. `1`) bila server ada di belakang proxy/CDN, supaya batas laju memakai IP pengunjung asli. |
| `RATE_LIMIT_SCALE` | Pengali batas laju per IP: `1` bawaan (400 permintaan/menit umum, 150 untuk layanan yang memanggil situs lain, 20 untuk transkripsi dan suara klon), `2` melonggarkan, `0` mematikan. |
| `ADMIN_TOKEN` | Bila diisi, membuat dan menghapus suara klon butuh header `X-Admin-Token`. Di browser, simpan token dengan `localStorage.setItem('lf:token', '...')`. |
| `ALLOW_PRIVATE_URLS=1` | Hanya untuk pengembangan: mengizinkan Web Link/RSS ke alamat lokal. Jangan dipakai di server publik. |

Pengambilan URL oleh server (Web Link, berita, podcast) memakai `netsafe.js`: setiap alamat, termasuk di setiap pengalihan, diperiksa (IPv4, IPv6, IPv4-mapped, `100.64.0.0/10`, dan lain-lain), lalu koneksi dibuat ke alamat yang sudah diperiksa itu sehingga DNS rebinding tidak bisa menyelinap. Paket opsional `compression` mengaktifkan gzip bila terpasang.

## Bahasa antarmuka (`data/language.json` dan `data/lang/`)

`data/language.json` tetap sumber utama (dipakai Language Builder). Halaman memuat file kecil per bahasa dari `data/lang/<kode>.json` secara async, jadi halaman tidak tertahan oleh file besar. File kecil itu harus ikut diperbarui setiap `language.json` berubah. Cara termudah, tanpa Node, API, atau GitHub Action: di `language-builder.html` (langkah 4) klik **Unduh ZIP**, lalu ekstrak ke folder proyek dan timpa. ZIP berisi `data/language.json` dan file per bahasa di `data/lang/` yang sudah sinkron. Untuk update berikutnya (teks baru lewat "Pindai semua halaman", atau bahasa baru), muat ulang `language.json`, ubah, lalu unduh ZIP lagi. Dengan **Hanya file yang berubah** dicentang, ZIP hanya memuat file yang beda dari yang ada di situs. Bila sebuah bahasa dihapus, builder menyebut file `data/lang/<kode>.json` yang perlu dihapus manual.

Alternatif lewat terminal: `npm run build:lang` (atau biarkan GitHub Action `build-lang.yml` melakukannya saat `data/language.json` di-push). Hasilnya sama persis dengan ZIP dari builder. Bila `data/lang/` belum ada, halaman jatuh balik ke `language.json`.

## PWA dan offline

`manifest.webmanifest`, ikon di `icons/`, dan `sw.js` membuat situs bisa dipasang dan halaman yang pernah dibuka tetap tampil saat offline (jaringan dulu, cache sebagai cadangan, tanpa halaman basi). `/api/*` dan media luar tidak di-cache. Naikkan `VERSION` di `sw.js` untuk membuang cache lama; tambahkan `?nosw` ke alamat untuk mematikan dan membersihkan.

## Pemeriksaan dan tes

    npm test              # sintaks semua .js dan skrip inline di .html, tes netsafe, pemeriksa data
    npm run test:all      # ditambah tes podcast, berita, artikel (butuh npm install)
    npm run check:data    # index.json, file pelajaran yatim, http://, bab loncat, terjemahan, data/lang

`.github/workflows/ci.yml` menjalankannya di setiap push dan pull request. `package-lock.json` belum ada di repo: jalankan `npm install` sekali lalu commit file itu supaya pemasangan konsisten.

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

## Kosakata otomatis di Player Reading (dikenal / belum dikenal / dipelajari)

`player-reading.html` menandai setiap kata di bacaan: **pink = belum dikenal**, **hijau = sedang dipelajari**, tanpa warna = dikenal. Di atas teks ada statistik seluruh bab (Dikenal, Belum (%), Belajar, Total) dan jumlah kata yang sudah kamu kenal di bahasa itu. Ketuk kata, lalu di popup arti pilih **Sudah tahu** atau **Sedang belajar** (ketuk lagi untuk membatalkan). **Anggap bagian ini dikenal** menandai semua kata pink di bagian yang sedang tampil sebagai dikenal. **Daftar belajar** menampilkan kata hijau dan 40 kata belum dikenal tersering; kata yang dicentang disimpan sebagai kartu (kata, arti otomatis, kalimat contoh) ke deck pilihan di Kosa Kata. Status disimpan per bahasa di `localStorage` (`lf:vocab:<bahasa>`), jadi berlaku di semua bacaan bahasa yang sama. Fitur ini bawaannya nonaktif; aktifkan di Pengaturan, grup "Kosakata otomatis". Selama aktif, tombol putar TTS dimatikan (pelafalan satu kata di popup tetap bisa).

## Langkah per pelajaran di path.html

Tiap pelajaran punya dua langkah: **Pelajaran → Latihan**. Di jalur, tiap unit (5 pelajaran) tersusun: P1 P2 P3 **[Review kosakata]** P4 P5 **[Kuis]**. Review dan Kuis adalah node tersendiri (ikon 🔁 dan 🏆), tidak bisa dilewati, dan node berikutnya terbuka setelah node itu selesai. Pengaturan: `CFG.reviewAfter` (3) dan `CFG.quizAfter` (5) di `path.html`. Progres di `lf:path`: `done[slug]` = Pelajaran, `steps[slug].practice` = Latihan, `gates["deck:<slug P1 unit>"|"quiz:<slug P1 unit>"] = {started, fin, done}`. Pelajaran lama di `legacy` tetap dianggap lengkap, dan node Review/Kuis yang berada sebelum pelajaran yang sudah selesai otomatis dianggap lewat.

- Latihan: dicatat otomatis. Video: saat Shadowing atau Dictation dimulai; audio: saat Practice dimulai; bacaan: saat susun paragraf benar. Bila susunan belum pas, tombol "Selesai latihan" muncul di ringkasan (hanya bila dibuka dari path).
- Review kosakata: `kosakata.html?from=path&auto=deck&q=<slug>` memulai mode Hafalan (SRS) pada deck terakhir yang dipakai (bawaan Kata Berbintang).
- Kuis: `kosakata.html?from=path&auto=quiz&q=<slug1,slug2,...>` memulai Cocokkan kata untuk semua pelajaran di unit itu (butuh internet untuk arti kata).
- Tombol **Selesai**: hanya muncul di halaman terakhir Review/Kuis, dan hanya bila tombol **Mulai** sudah ditekan di path lalu sesinya dituntaskan. Menekannya menandai node selesai dan kembali ke path. Keluar lewat tombol kembali tidak menandai selesai.
