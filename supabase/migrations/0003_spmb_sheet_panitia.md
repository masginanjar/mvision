# 0003 — Salinan data SPMB dari Google Sheet panitia

Diterapkan langsung ke proyek Supabase sebagai tiga migrasi:
`spmb_sumber_sheet`, `spmb_sheet_tampilan_jadwal`, `spmb_sheet_tampilan_rapi`.

- `spmb_sumber` (tab, baris, sel jsonb): salinan mentah tiap tab. RLS: hanya `privat.staf_spmb()`.
- `spmb_sinkron_log`: catatan tiap tarikan (berubah / tidak / galat). Dibersihkan setelah 14 hari.
- `spmb_pendaftar_sheet`, `spmb_rekap_sheet`: view `security_invoker` di atas salinan mentah.
- `privat.sinkron_kunci`: kunci acak untuk panggilan terjadwal; tidak pernah keluar dari database.
- RPC khusus `service_role`: `sinkron_cek`, `sinkron_sidik`, `spmb_simpan`. RPC `boleh_tarik` untuk tombol manual.
- `pg_cron` menit ke-7 tiap jam memanggil Edge Function `tarik-spmb` lewat `pg_net`.

Kolom dipetakan menurut posisi di tab `Rekap_PPDB_2728` (baris judul 5-7, data mulai baris 9).
Jika panitia menyisipkan atau memindah kolom, pemetaan di view harus disesuaikan.

Sumber Edge Function `tarik-spmb` sengaja tidak disimpan di repo ini karena memuat ID sheet panitia; repo ini publik.

Tambahan (migrasi `spmb_sheet_jadwal_bayar`): `privat.rp`, kolom pembayaran di `spmb_pendaftar_sheet`, view `spmb_jadwal_sheet`.
