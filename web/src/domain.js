// Aturan dan label yang tidak bergantung pada tampilan. Keputusan akhir tetap di server.
export const STATUS = {
  menunggu_pembayaran: ['Menunggu pembayaran', 'warn'], menunggu_verifikasi_bayar: ['Bukti bayar diperiksa', 'warn'], lunas_pendaftaran: ['Biaya pendaftaran lunas', 'ok'],
  berkas_diunggah: ['Berkas diperiksa', 'warn'], berkas_perlu_perbaikan: ['Berkas perlu diperbaiki', 'bad'], berkas_terverifikasi: ['Berkas lengkap', 'ok'],
  terjadwal_seleksi: ['Terjadwal seleksi', 'info'], selesai_seleksi: ['Selesai seleksi', 'info'], diterima: ['Diterima', 'ok'], cadangan: ['Cadangan', 'warn'], tidak_diterima: ['Tidak diterima', 'bad'],
  menunggu_daftar_ulang: ['Menunggu daftar ulang', 'warn'], daftar_ulang_lunas: ['Daftar ulang lunas', 'ok'], siswa_aktif: ['Siswa aktif', 'ok'], mengundurkan_diri: ['Mengundurkan diri', 'mute'], dibatalkan: ['Dibatalkan', 'mute'],
}
export const PERAN = { ortu: 'Orang Tua', pegawai: 'Pegawai', panitia: 'Panitia SPMB', superadmin: 'Superadmin' }
export const kosong = () => ({ tingkat: '', jalur: 'baru', anak_nama: '', anak_panggilan: '', anak_jk: '', anak_tempat_lahir: '', anak_tgl_lahir: '', nik: '', asal_sekolah: '', wali_hubungan: '', wali_nama: '', wali_hp: '', alamat: '' })
export function periksa(f) {
  const e = {}, w = (k, m) => { if (!String(f[k] || '').trim()) e[k] = m || 'Wajib diisi.' }
  w('tingkat', 'Pilih tingkat.'); w('anak_nama'); if (!e.anak_nama && f.anak_nama.trim().length < 3) e.anak_nama = 'Tulis nama lengkap.'
  w('anak_jk', 'Pilih salah satu.'); w('anak_tempat_lahir'); w('anak_tgl_lahir')
  if (f.anak_tgl_lahir && f.anak_tgl_lahir > new Date().toISOString().slice(0, 10)) e.anak_tgl_lahir = 'Tanggal lahir tidak boleh di masa depan.'
  const nik = String(f.nik || '').replace(/\D/g, ''); if (nik && nik.length !== 16) e.nik = 'NIK harus 16 angka, atau kosongkan.'
  w('wali_hubungan', 'Pilih Ayah, Ibu, atau Wali.'); w('wali_nama'); w('wali_hp')
  if (f.wali_hp && !/^[0-9+][0-9 -]{7,17}$/.test(f.wali_hp)) e.wali_hp = 'Nomor HP hanya angka, 8 sampai 18 digit.'
  w('alamat'); return e
}
export const tgl = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '-'
