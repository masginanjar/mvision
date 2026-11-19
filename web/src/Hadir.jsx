import React, { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { supabase } from './supabase.js'
import { Tombol, Kartu, Tanda, Lembar, isian } from './ui.jsx'
import { tgl } from './domain.js'

export const hariIni = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date())
const jam = s => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(s)).replace('.', ':')
const ST = { hadir: ['Hadir', 'ok'], terlambat: ['Terlambat', 'warn'], izin: ['Izin', 'info'], sakit: ['Sakit', 'info'], alpa: ['Tanpa keterangan', 'bad'] }
const IZIN = { guru: 'Guru', gerbang: 'Petugas Gerbang', admin: 'Admin Sekolah', kepsek: 'Kepala Sekolah' }
export const bolehScan = d => d.superadmin || d.petugas.some(p => ['guru', 'gerbang', 'admin'].includes(p.izin))

function Status({ a }) { if (!a) return <Tanda>Belum datang</Tanda>; const v = ST[a.status]; return <Tanda w={v[1]}>{v[0]}{a.metode !== 'koreksi' ? ' ' + jam(a.at) : ''}</Tanda> }

export function Kehadiran({ data, saya, muat }) {
  const [lembar, setLembar] = useState(null), [pesan, setPesan] = useState(''), [sibuk, setSibuk] = useState(false)
  const hari = hariIni(), kelas = id => (data.kelas.find(k => k.id === id) || {}).nama || id
  const abs = (sid, t = hari) => data.absensi.find(a => a.siswa_id === sid && a.tgl === t && a.jenis === 'datang')
  const anak = data.siswa.filter(s => s.ortu === saya), lain = data.siswa.filter(s => s.ortu !== saya)
  const bisaKoreksi = data.superadmin || data.petugas.some(p => p.izin === 'guru' || p.izin === 'admin'), admin = data.superadmin || data.petugas.some(p => p.izin === 'admin')
  async function jalankan(fn, argumen, sukses) { setSibuk(true); setPesan(''); const { error } = await supabase.rpc(fn, argumen); setSibuk(false); if (error) { setPesan(error.message || 'Belum berhasil. Coba lagi.'); return } setLembar(null); await muat(); if (sukses) setPesan(sukses) }
  return <div className="flex flex-col gap-3">
    {pesan && !lembar && <p role="status" className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{pesan}</p>}
    {anak.map(s => { const q = data.qr.find(x => x.siswa_id === s.id), riw = data.absensi.filter(a => a.siswa_id === s.id && a.jenis === 'datang').sort((a, b) => a.tgl < b.tgl ? 1 : -1).slice(0, 7)
      return <Kartu key={s.id}><div className="flex items-start justify-between gap-3"><div><div className="text-[17px] font-semibold">{s.nama}</div><div className="text-sm text-muted">{kelas(s.kelas)}</div></div><Status a={abs(s.id)} /></div>
        <div className="mt-3 flex gap-2"><Tombol utama className="flex-1" disabled={!q} onClick={() => setLembar({ jenis: 'qr', s, q })}>Tampilkan QR</Tombol><Tombol onClick={() => setLembar({ jenis: 'ganti', s })}>Ganti kode</Tombol></div>
        {riw.length > 0 && <div className="mt-3 border-t border-line pt-2">{riw.map(a => <div key={a.id} className="flex items-center justify-between py-1.5 text-sm"><span>{tgl(a.tgl)}</span><Status a={a} /></div>)}</div>}</Kartu> })}
    {!anak.length && !lain.length && <Kartu><p className="text-muted">Belum ada anak yang terhubung ke akun ini.</p><p className="mt-2 text-sm">Berikan kode akun ini ke Admin Sekolah agar anak Anda dihubungkan:</p><p className="mt-1 text-2xl font-bold tracking-widest">{saya.slice(0, 8).toUpperCase()}</p></Kartu>}
    {lain.length > 0 && <><h2 className="mt-2 text-[15px] font-bold">Daftar hadir hari ini</h2>
      {lain.map(s => <Kartu key={s.id}><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{s.nama}</div><div className="text-sm text-muted">{kelas(s.kelas)}{admin ? (s.ortu ? ' · orang tua terhubung' : ' · belum ada orang tua') : ''}</div></div><Status a={abs(s.id)} /></div>
        {(bisaKoreksi || admin) && <div className="mt-3 flex gap-2">{bisaKoreksi && <Tombol className="flex-1" onClick={() => setLembar({ jenis: 'koreksi', s, status: (abs(s.id) || {}).status || 'hadir', alasan: '' })}>Koreksi</Tombol>}{admin && <Tombol className="flex-1" onClick={() => setLembar({ jenis: 'ortu', s, akun: '' })}>Orang tua</Tombol>}</div>}</Kartu>)}</>}
    {data.superadmin && <Petugas data={data} muat={muat} />}

    {lembar?.jenis === 'qr' && <Lembar judul={'QR ' + lembar.s.panggilan} tutup={() => setLembar(null)}><Qr teks={'MV1:' + lembar.q.token} /><p className="mt-2 text-center text-3xl font-bold tracking-[.2em]">{lembar.q.kode}</p><p className="mt-1 text-center text-sm text-muted">Tunjukkan ke kamera kiosk. Berlaku sampai {tgl(lembar.q.berlaku_sampai)}.</p><Tombol className="mt-4 w-full" onClick={() => setLembar(null)}>Tutup</Tombol></Lembar>}
    {lembar?.jenis === 'ganti' && <Lembar judul="Ganti kode QR?" tutup={() => setLembar(null)}><p className="text-muted">Kode lama langsung tidak berlaku. Pakai ini bila QR pernah terlihat orang lain.</p>{pesan && <p role="alert" className="mt-2 text-sm text-red-700">{pesan}</p>}<div className="mt-4 flex flex-col gap-2"><Tombol utama disabled={sibuk} onClick={() => jalankan('ganti_qr', { p_siswa: lembar.s.id }, 'Kode QR sudah diganti.')}>Ya, ganti kode</Tombol><Tombol onClick={() => setLembar(null)}>Batal</Tombol></div></Lembar>}
    {lembar?.jenis === 'koreksi' && <Lembar judul={'Koreksi ' + lembar.s.panggilan} tutup={() => setLembar(null)}>
      <label htmlFor="k-st" className="text-sm font-semibold">Status hari ini</label><select id="k-st" className={isian + ' mb-3 mt-1.5'} value={lembar.status} onChange={e => setLembar({ ...lembar, status: e.target.value })}>{Object.keys(ST).map(k => <option key={k} value={k}>{ST[k][0]}</option>)}</select>
      <label htmlFor="k-al" className="text-sm font-semibold">Alasan <span className="text-red-600">*</span></label><textarea id="k-al" rows="2" className={isian + ' mt-1.5 py-2'} value={lembar.alasan} onChange={e => setLembar({ ...lembar, alasan: e.target.value })} />
      {pesan && <p role="alert" className="mt-2 text-sm text-red-700">{pesan}</p>}
      <div className="mt-4 flex flex-col gap-2"><Tombol utama disabled={sibuk} onClick={() => lembar.alasan.trim() ? jalankan('koreksi_absensi', { p_siswa: lembar.s.id, p_tgl: hari, p_status: lembar.status, p_alasan: lembar.alasan }, 'Koreksi tersimpan.') : setPesan('Alasan koreksi wajib diisi.')}>Simpan koreksi</Tombol><Tombol onClick={() => { setLembar(null); setPesan('') }}>Batal</Tombol></div></Lembar>}
    {lembar?.jenis === 'ortu' && <Lembar judul={'Orang tua ' + lembar.s.panggilan} tutup={() => setLembar(null)}>
      <label htmlFor="o-ak" className="text-sm font-semibold">Email atau kode akun orang tua</label><input id="o-ak" className={isian + ' mt-1.5'} autoCapitalize="none" autoComplete="off" value={lembar.akun} onChange={e => setLembar({ ...lembar, akun: e.target.value })} placeholder="nama@email.com atau 8 huruf kode" />
      <p className="mt-1.5 text-[13px] text-muted">Orang tua harus sudah pernah masuk. Kode akun ada di menu Akun mereka. Kosongkan untuk melepas hubungan.</p>
      {pesan && <p role="alert" className="mt-2 text-sm text-red-700">{pesan}</p>}
      <div className="mt-4 flex flex-col gap-2"><Tombol utama disabled={sibuk} onClick={() => jalankan('hubungkan_ortu', { p_siswa: lembar.s.id, p_akun: lembar.akun }, 'Orang tua diperbarui.')}>Simpan</Tombol><Tombol onClick={() => { setLembar(null); setPesan('') }}>Batal</Tombol></div></Lembar>}
  </div>
}

function Qr({ teks }) { const [src, setSrc] = useState(''); useEffect(() => { QRCode.toDataURL(teks, { width: 560, margin: 2, errorCorrectionLevel: 'M' }).then(setSrc) }, [teks]); return src ? <img src={src} alt="Kode QR siswa" className="mx-auto w-full max-w-[280px] rounded-xl border border-line" /> : <div className="mx-auto h-[280px] w-[280px] rounded-xl bg-zinc-100" /> }

function Petugas({ data, muat }) {
  const [f, setF] = useState({ akun: '', izin: '', kelas: '', gedung: '' }), [pesan, setPesan] = useState(''), [sibuk, setSibuk] = useState(false)
  const nama = id => { const p = data.profilSemua.find(x => x.id === id); return p ? (p.nama || p.email || 'Tamu ' + id.slice(0, 8).toUpperCase()) : id.slice(0, 8).toUpperCase() }
  async function simpan(hapus, akun, izin) {
    if (!hapus && (!f.akun.trim() || !f.izin)) { setPesan('Isi akun dan pilih peran.'); return }
    setSibuk(true); setPesan(''); const { error } = await supabase.rpc('atur_petugas', hapus ? { p_akun: akun, p_izin: izin, p_hapus: true } : { p_akun: f.akun, p_izin: f.izin, p_kelas: f.kelas || null, p_gedung: f.gedung || null })
    setSibuk(false); if (error) { setPesan(error.message); return } if (!hapus) setF({ akun: '', izin: '', kelas: '', gedung: '' }); muat()
  }
  return <Kartu className="mt-2 flex flex-col gap-3"><h2 className="text-[15px] font-bold">Petugas kehadiran</h2>
    {data.petugasSemua.map(p => <div key={p.user_id + p.izin} className="flex items-center justify-between gap-2 text-sm"><span><b>{nama(p.user_id)}</b><span className="block text-muted">{IZIN[p.izin]}{p.kelas ? ' · ' + (data.kelas.find(k => k.id === p.kelas) || {}).nama : ''}{p.gedung ? ' · Gedung ' + p.gedung : ''}</span></span><Tombol bahaya disabled={sibuk} onClick={() => simpan(true, p.user_id.slice(0, 8), p.izin)}>Cabut</Tombol></div>)}
    {!data.petugasSemua.length && <p className="text-sm text-muted">Belum ada petugas. Superadmin sudah bisa memindai dan mengoreksi.</p>}
    <label htmlFor="p-ak" className="text-sm font-semibold">Email atau kode akun</label><input id="p-ak" className={isian + ' -mt-1.5'} autoCapitalize="none" autoComplete="off" value={f.akun} onChange={e => setF({ ...f, akun: e.target.value })} />
    <label htmlFor="p-iz" className="text-sm font-semibold">Peran</label><select id="p-iz" className={isian + ' -mt-1.5'} value={f.izin} onChange={e => setF({ ...f, izin: e.target.value })}><option value="">Pilih</option>{Object.keys(IZIN).map(k => <option key={k} value={k}>{IZIN[k]}</option>)}</select>
    {f.izin === 'guru' && <><label htmlFor="p-kl" className="text-sm font-semibold">Kelas</label><select id="p-kl" className={isian + ' -mt-1.5'} value={f.kelas} onChange={e => setF({ ...f, kelas: e.target.value })}><option value="">Pilih</option>{data.kelas.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}</select></>}
    {f.izin === 'gerbang' && <><label htmlFor="p-gd" className="text-sm font-semibold">Gedung</label><select id="p-gd" className={isian + ' -mt-1.5'} value={f.gedung} onChange={e => setF({ ...f, gedung: e.target.value })}><option value="">Semua gedung</option>{data.gedung.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}</select></>}
    {pesan && <p role="alert" className="text-sm text-red-700">{pesan}</p>}
    <Tombol utama disabled={sibuk} onClick={() => simpan(false)}>Simpan petugas</Tombol></Kartu>
}

export function Kiosk({ daring, muat }) {
  const [hasil, setHasil] = useState(null), [sibuk, setSibuk] = useState(false), [kamera, setKamera] = useState('mati'), [arah, setArah] = useState('environment'), [kode, setKode] = useState('')
  const [perangkat, setPerangkat] = useState(() => { try { return localStorage.getItem('mvision-perangkat') || 'Kiosk 1' } catch { return 'Kiosk 1' } })
  const video = useRef(null), kanvas = useRef(null), aliran = useRef(null), kunci = useRef({ sibuk: false, terakhir: '', kapan: 0, hasil: 0 })
  const tampil = (h, ms) => { setHasil(h); const id = ++kunci.current.hasil; setTimeout(() => { if (kunci.current.hasil === id) setHasil(null) }, ms) }
  async function catat(teks) {
    const k = kunci.current, t = String(teks || '').trim(); if (!t || k.sibuk) return
    if (t === k.terakhir && Date.now() - k.kapan < 5000) return
    k.sibuk = true; k.terakhir = t; k.kapan = Date.now(); setSibuk(true)
    const id = crypto.randomUUID(); let r = await supabase.rpc('catat_scan', { p_kode: t, p_kunci: id, p_perangkat: perangkat })
    if (r.error && !r.error.code) r = await supabase.rpc('catat_scan', { p_kode: t, p_kunci: id, p_perangkat: perangkat })
    k.sibuk = false; k.kapan = Date.now(); setSibuk(false)
    if (r.error) { tampil({ ok: false, judul: r.error.code ? 'Tidak diizinkan' : 'Belum tersambung', isi: r.error.code ? r.error.message : 'Scan belum tercatat. Coba lagi setelah koneksi kembali.' }, 4500); return }
    const b = r.data; if (b.ok) { tampil({ ok: true, judul: 'Selamat Datang, ' + b.nama, isi: (b.status === 'hadir' ? 'Hadir' : 'Terlambat') + ' · ' + b.jam }, 2500); muat() }
    else tampil({ ok: false, judul: b.hasil === 'duplikat' ? 'Sudah tercatat' : 'Belum berhasil', isi: b.pesan }, 4500)
  }
  async function nyalakan(a = arah) {
    matikan(); setKamera('minta')
    try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: a, width: { ideal: 1280 } }, audio: false }); aliran.current = s; video.current.srcObject = s; await video.current.play(); setKamera('hidup') }
    catch (e) { setKamera(e && e.name === 'NotAllowedError' ? 'ditolak' : 'gagal') }
  }
  function matikan() { if (aliran.current) { aliran.current.getTracks().forEach(t => t.stop()); aliran.current = null } }
  useEffect(() => () => matikan(), [])
  useEffect(() => {
    if (kamera !== 'hidup') return; let hidup = true, lalu = 0
    const putar = w => { if (!hidup) return; const v = video.current, c = kanvas.current
      if (v && c && v.readyState >= 2 && w - lalu > 160 && !kunci.current.sibuk) { lalu = w; const s = Math.min(1, 480 / v.videoWidth); c.width = v.videoWidth * s; c.height = v.videoHeight * s; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(v, 0, 0, c.width, c.height)
        const q = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' }); if (q && q.data) catat(q.data) }
      requestAnimationFrame(putar) }
    requestAnimationFrame(putar); return () => { hidup = false }
  }, [kamera, perangkat])
  const teks = sibuk ? 'Sedang Mengenali…' : kamera === 'hidup' ? 'Arahkan QR ke Kamera' : 'Kamera belum menyala'
  return <div className="flex flex-col gap-3">
    <div className={'relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl text-center text-white ' + (hasil ? (hasil.ok ? 'bg-brand' : 'bg-amber-600') : 'bg-zinc-900')} role="status" aria-live="assertive">
      <video ref={video} playsInline muted className={'absolute inset-0 h-full w-full object-cover ' + (kamera === 'hidup' && !hasil ? '' : 'hidden')} /><canvas ref={kanvas} className="hidden" />
      {kamera === 'hidup' && !hasil && <div className="pointer-events-none absolute inset-[14%] rounded-3xl border-4 border-white/70" />}
      <div className={'relative px-4 ' + (kamera === 'hidup' && !hasil ? 'mt-auto w-full bg-black/55 py-3' : '')}>{hasil ? <><div id="k-judul" className="text-2xl font-bold">{hasil.judul}</div><div className="mt-1 text-base opacity-95">{hasil.isi}</div></> : <div id="k-judul" className="text-lg font-semibold">{teks}</div>}</div>
    </div>
    {!daring && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Tidak ada koneksi. Scan tidak akan dicatat sampai tersambung lagi.</p>}
    {kamera === 'ditolak' && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, atau pakai kode 6 huruf di bawah.</p>}
    {kamera === 'gagal' && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Kamera tidak bisa dibuka di perangkat ini. Pakai kode 6 huruf di bawah.</p>}
    <div className="flex gap-2">{kamera === 'hidup' ? <><Tombol className="flex-1" onClick={() => { const a = arah === 'user' ? 'environment' : 'user'; setArah(a); nyalakan(a) }}>Ganti kamera</Tombol><Tombol className="flex-1" onClick={() => { matikan(); setKamera('mati') }}>Matikan</Tombol></> : <Tombol utama className="flex-1" disabled={kamera === 'minta'} onClick={() => nyalakan()}>{kamera === 'minta' ? 'Membuka kamera…' : 'Nyalakan kamera'}</Tombol>}</div>
    <Kartu><form onSubmit={e => { e.preventDefault(); catat(kode); setKode('') }} className="flex flex-col gap-2"><label htmlFor="k-kode" className="text-sm font-semibold">Kode 6 huruf pada QR</label>
      <div className="flex gap-2"><input id="k-kode" className={isian + ' flex-1 uppercase tracking-[.2em]'} maxLength={6} autoCapitalize="characters" autoComplete="off" value={kode} onChange={e => setKode(e.target.value.toUpperCase())} /><Tombol type="submit" disabled={sibuk || kode.trim().length < 6}>Catat</Tombol></div></form></Kartu>
    <Kartu><label htmlFor="k-pr" className="text-sm font-semibold">Nama perangkat ini</label><input id="k-pr" className={isian + ' mt-1.5'} value={perangkat} onChange={e => { setPerangkat(e.target.value); try { localStorage.setItem('mvision-perangkat', e.target.value) } catch { } }} /><p className="mt-1.5 text-[13px] text-muted">Tercatat di setiap scan. Di iPad sekolah, kunci layar ini dengan Guided Access.</p></Kartu>
  </div>
}
