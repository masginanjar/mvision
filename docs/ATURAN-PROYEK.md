# Aturan Tetap Proyek MVISION

Berlaku otomatis pada setiap prompt (fitur baru, perubahan halaman, perbaikan) tanpa perlu diulang.
Bila permintaan baru bertentangan dengan aturan ini: ikuti instruksi terbaru yang spesifik, lalu jelaskan konsekuensinya singkat.

Ditetapkan pimpinan proyek pada 15 November 2026.

## A. Mobile-first (rasa aplikasi iPhone modern, satu jempol)

1. **Desain dari layar kecil.** Bukan desktop yang dikecilkan. Tanpa konten terpotong, elemen bertumpuk, atau scroll horizontal. Tablet dan desktop tetap proporsional.
2. **Ramah jempol.** Bottom navigation 3–5 menu inti berlabel. Tindakan utama di bawah (sticky bottom action). Area sentuh minimal 44 pt iOS / 48 dp Android (di web dipakai 48 px). Hormati safe area, notch, home indicator, navigasi sistem Android, dan keyboard.
3. **Interaksi.** Bottom sheet untuk pilihan singkat; halaman penuh untuk detail panjang dan formulir kompleks. Tombol kembali konsisten. Transisi halus, feedback tekan, state loading / empty / success / error jelas. Tidak bergantung pada hover atau gesture tersembunyi.
4. **UI minimalis.** Hierarki jelas, teks ringkas, ikon familiar + label, tab / progressive disclosure, tabel lebar menjadi kartu di ponsel.
5. **Formulir.** Satu kolom, label jelas, autofill, keyboard sesuai jenis input, teks input minimal 16 px, validasi dekat kolom, isian dipertahankan saat error, input aktif dan tombol tetap terjangkau saat keyboard terbuka.
6. **PWA.** Manifest, ikon, standalone bila lingkup memungkinkan. Status koneksi dan offline jujur; transaksi tidak ditampilkan berhasil sebelum terkonfirmasi. Tidak menyimpan data sensitif di cache sembarangan. Bedakan yang sudah jadi dan yang masih rencana.
7. **Pemeriksaan tiap perubahan.** Lebar 320, 375, 390, 430 px + tablet + desktop. Scroll, keyboard, safe area, bottom navigation, modal, posisi tombol utama. Aksesibilitas dasar (kontras, label, fokus, reduced motion). Tidak merusak fitur. Laporkan singkat perubahan dan uji yang benar-benar dilakukan.

## B. Siap Android (Google Play) dan iOS (App Store), tetap bisa web/PWA

1. **Arsitektur.** Periksa teknologi dulu. Untuk aplikasi web, utamakan pakai ulang kode (mis. Capacitor). Tidak migrasi besar tanpa menjelaskan kebutuhan dan dampak. Pisahkan logika bisnis, antarmuka, dan integrasi perangkat. Hindari fitur browser yang tidak jalan baik di WebView Android/iOS. Jaga kompatibilitas web/PWA, Android, iOS.
2. **Mobile-first dan ramah jempol.** Sama dengan bagian A.
3. **Sesuai platform.** Visual konsisten, tetapi hormati kebiasaan tiap platform: tombol/gesture kembali Android, navigasi kembali iOS. Tautan eksternal, berbagi, unduh, unggah, kamera, pemilih file harus bekerja per platform. Animasi ringan, hormati reduced motion.
4. **Fitur native yang berguna.** Bukan sekadar website dalam WebView. Push notification, kamera untuk unggah dokumen, berbagi file, deep link bila relevan. Tidak meminta izin yang tidak perlu; izin diminta saat fitur dipakai, dijelaskan manfaatnya, dan ada penanganan bila ditolak.
5. **Login, data, keamanan.** Login/logout/pemulihan/sesi/redirect autentikasi jalan di web dan mobile. Token di penyimpanan aman platform. Tanpa secret di kode aplikasi. Hak akses ditegakkan di backend. Ada alur hapus akun. Data pribadi tidak masuk log atau cache.
6. **Koneksi dan performa.** Aset ringan, buka cepat. State loading / empty / error / offline / retry. Simpan dan bayar tidak ditampilkan berhasil sebelum terkonfirmasi. Cegah kirim ganda. Isian dipertahankan saat koneksi putus bila aman.
7. **Kesiapan publikasi.** Bundle ID / package name, ikon, splash, versi, build number. Konfigurasi dev / staging / production terpisah. Kebijakan privasi, URL dukungan, deklarasi data, izin, screenshot, akun demo reviewer. Cek ketentuan terbaru Apple dan Google sebelum memutuskan pembayaran, login pihak ketiga, hapus akun, distribusi. Tidak menyatakan "siap publikasi" sebelum pemeriksaan selesai.
8. **Validasi.** Layar 320–430 px; alur utama di Android dan iOS (keyboard, kembali, safe area, login, unggah, koneksi buruk). Bedakan uji browser, simulator/emulator, perangkat nyata. Tidak mengklaim uji yang belum dilakukan. Laporkan: apa yang diubah, apa yang diuji, apa yang masih dibutuhkan sebelum publikasi.

## C. Aturan lain yang sudah berlaku sebelumnya

- Data fiktif saja; simulasi diberi label SIMULASI / CONTOH; angka dan kebijakan contoh tidak dinyatakan sebagai fakta.
- Tidak migrasi atau publikasi ke produksi tanpa persetujuan pimpinan.
- Penjelasan hasil dalam bahasa Indonesia sederhana; pisahkan yang diuji dan yang belum.

## D. Audit kondisi sekarang (15 November 2026)

| Hal | Kondisi |
|---|---|
| Bentuk | Demo satu file HTML (vanilla JS), data di browser (localStorage + IndexedDB). Belum ada backend. |
| Login | Google masih SIMULASI. |
| Hak akses | Dicek di kode halaman, belum di server. |
| Pembayaran | Simulasi (transfer + QRIS contoh). |
| Unggah berkas | Pemilih file browser; tersimpan lokal. |
| PWA | Meta tag mode aplikasi dan status koneksi sudah. Manifest, ikon, service worker **belum** (tidak bisa di dalam artifact; butuh domain sendiri). |
| Android / iOS | **Belum ada** proyek native. |

**Kesimpulan:** demo ini alat presentasi dan acuan alur/desain, bukan kode yang akan dikirim ke store.

## E. Jalur paling praktis ke Android dan iOS

1. **Tahap 0 (sekarang):** demo HTML mengikuti standar mobile-first, sebagai acuan desain dan alur yang disetujui direksi.
2. **Tahap 1 – aplikasi web sungguhan:** Vite + React + Tailwind + Supabase (sesuai Prompt-SPMB-MVISION-v3). Struktur dipisah: `domain/` (aturan bisnis, tanpa UI), `ui/` (komponen), `platform/` (kamera, file, notifikasi, penyimpanan aman, tombol kembali). Hak akses lewat Row Level Security di Supabase. Login Google asli. Dipasang sebagai PWA (manifest, ikon, service worker; data sensitif tidak di-cache).
3. **Tahap 2 – bungkus dengan Capacitor:** satu kode untuk web, Android, iOS. Plugin yang relevan: Camera (foto dokumen), Filesystem + Share (formulir PDF, kuitansi), Push Notifications (tagihan, jadwal, pengumuman), App (tombol kembali Android, deep link), Preferences / secure storage (token), Browser (login Google lewat browser sistem, bukan WebView).
4. **Tahap 3 – persiapan store:** bundle ID, ikon, splash, kebijakan privasi, URL dukungan, deklarasi data, alur hapus akun, akun demo reviewer, uji di perangkat nyata, lalu TestFlight dan Play internal testing.

**Hal yang harus diputuskan / dicek sebelum Tahap 3:**
- Akun Apple Developer dan Google Play Console atas nama yayasan/sekolah.
- Ketentuan terbaru Apple dan Google untuk: login pihak ketiga (bila hanya Google login, cek kewajiban opsi login lain di iOS), hapus akun, dan pembayaran. Biaya sekolah adalah layanan dunia nyata, tetapi tetap harus dicek ke pedoman terbaru sebelum diputuskan.
- Payment gateway resmi (pengganti simulasi).
- Kebijakan privasi sekolah (data anak, penghasilan orang tua, dokumen identitas).
