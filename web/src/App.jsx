import React, { useEffect, useRef, useState } from 'react'
import { supabase, caraMasuk } from './supabase.js'
import { STATUS, PERAN, kosong, periksa, tgl } from './domain.js'
import { Kehadiran, Kiosk, bolehScan, hariIni } from './Hadir.jsx'
import { Lembar } from './ui.jsx'
import { DataPanitia } from './Spmb.jsx'

const warna = { ok: 'bg-brand-soft text-brand-dark', warn: 'bg-amber-100 text-amber-800', bad: 'bg-red-100 text-red-700', info: 'bg-sky-100 text-sky-800', mute: 'bg-zinc-100 text-zinc-600' }
const Pil = ({ s }) => { const v = STATUS[s] || [s, 'mute']; return <span className={'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ' + warna[v[1]]}>{v[0]}</span> }
const Tombol = ({ utama, bahaya, className = '', ...p }) => <button {...p} className={'min-h-12 rounded-xl px-4 text-[15px] font-semibold transition active:scale-[.98] disabled:opacity-50 ' + (utama ? 'bg-brand text-white ' : bahaya ? 'border border-red-200 bg-white text-red-700 ' : 'border border-line bg-white ') + className} />
const Kartu = ({ className = '', ...p }) => <div {...p} className={'rounded-2xl border border-line bg-white p-4 ' + className} />
const Ikon = ({ d }) => <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
const IK = { rumah: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z', tambah: 'M12 5v14M5 12h14', daftar: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', akun: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5', hadir: 'M5 12l4 4 10-10M4 4h16v16H4z', kiosk: 'M4 8h3l2-2h6l2 2h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z', kembali: 'M15 5l-7 7 7 7' }

export default function App() {
  const [sesi, setSesi] = useState(undefined), [google, setGoogle] = useState(undefined)
  const [hal, setHal] = useState('beranda'), [data, setData] = useState(null), [galat, setGalat] = useState(''), [daring, setDaring] = useState(navigator.onLine)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesi(data.session))
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSesi(s))
    caraMasuk().then(setGoogle)
    const on = () => setDaring(true), off = () => setDaring(false); addEventListener('online', on); addEventListener('offline', off)
    return () => { l.subscription.unsubscribe(); removeEventListener('online', on); removeEventListener('offline', off) }
  }, [])
  async function muat() {
    setGalat('')
    const [pr, pe, ti, ge, da, tr] = await Promise.all([
      supabase.from('profil').select('*').eq('id', sesi.user.id).maybeSingle(), supabase.from('peran_pengguna').select('*').eq('user_id', sesi.user.id),
      supabase.from('tingkat').select('*').order('urut'), supabase.from('gelombang').select('*').eq('aktif', true).order('buka'),
      supabase.from('pendaftaran').select('*').order('dibuat_at', { ascending: false }), supabase.from('transisi_status').select('*')])
    const sejak = new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 10)
    const [pt, sw, qr, ab, kl, gd, nt] = await Promise.all([supabase.from('petugas_hadir').select('*'), supabase.from('siswa').select('*').eq('aktif', true).order('kelas').order('nama'), supabase.from('siswa_qr').select('*'),
      supabase.from('absensi').select('*').gte('tgl', sejak), supabase.from('kelas').select('*').order('nama'), supabase.from('gedung').select('*').order('id'), supabase.from('notifikasi').select('*').order('at', { ascending: false }).limit(5)])
    const err = [pr, pe, ti, ge, da, tr, pt, sw, qr, ab, kl, gd, nt].find(x => x.error)
    if (err) { setGalat('Data belum bisa dimuat. Periksa koneksi lalu coba lagi.'); return }
    const superadmin = pe.data.some(p => p.peran === 'superadmin'); let profilSemua = []
    if (superadmin) { const x = await supabase.from('profil').select('id,nama,email'); profilSemua = x.data || [] }
    setData({ profil: pr.data, peran: pe.data, tingkat: ti.data, gelombang: ge.data, daftar: da.data, transisi: tr.data, superadmin, profilSemua,
      petugas: pt.data.filter(p => p.user_id === sesi.user.id), petugasSemua: superadmin ? pt.data : [], siswa: sw.data, qr: qr.data, absensi: ab.data, kelas: kl.data, gedung: gd.data, notif: nt.data })
  }
  useEffect(() => { if (sesi) muat(); else setData(null) }, [sesi && sesi.user.id])

  const pita = <div role="note" className="flex-none border-b border-amber-200 bg-amber-50 px-3 pb-1 pt-[calc(4px+env(safe-area-inset-top))] text-center text-xs font-semibold text-amber-800">UJI INTERNAL · data panitia hanya terlihat oleh Panitia</div>
  if (sesi === undefined) return <Layar pita={pita}><p className="text-center text-muted">Memuat…</p></Layar>
  if (!sesi) return <Layar pita={pita}><Masuk google={google} /></Layar>

  const staf = data && data.peran.some(p => p.peran === 'panitia' || p.peran === 'superadmin')
  const scan = data && bolehScan(data)
  const menu = [['beranda', 'Beranda', IK.rumah], ['hadir', 'Kehadiran', IK.hadir]].concat(scan ? [['kiosk', 'Kiosk', IK.kiosk]] : []).concat(staf ? [['panitia', 'Pendaftar', IK.daftar]] : []).concat([['akun', 'Akun', IK.akun]])
  const judul = { beranda: 'Beranda', daftar: 'Daftarkan Anak', hadir: 'Kehadiran', kiosk: 'Kiosk Kedatangan', panitia: 'SPMB', akun: 'Akun' }[hal]
  return <div className="mx-auto flex h-dvh max-w-3xl flex-col">
    {pita}
    <header className="flex min-h-13 flex-none items-center gap-2 border-b border-line bg-white px-3">
      {hal !== 'beranda' && <button aria-label="Kembali" onClick={() => setHal('beranda')} className="-ml-1 flex h-11 w-11 items-center justify-center rounded-xl"><Ikon d={IK.kembali} /></button>}
      <h1 className="text-base font-semibold">{judul}</h1>
    </header>
    {!daring && <div role="status" className="flex-none bg-amber-50 px-4 py-2 text-center text-[13px] text-amber-800">Tidak ada koneksi internet. Isian Anda tetap ada di layar; kirim setelah tersambung.</div>}
    <main className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
      {galat && <Kartu className="mb-3 border-red-200"><p className="mb-3 text-red-700">{galat}</p><Tombol onClick={muat}>Coba lagi</Tombol></Kartu>}
      {!data && !galat && <p className="text-center text-muted">Memuat data…</p>}
      {data && hal === 'beranda' && <Beranda data={data} ke={setHal} />}
      {data && hal === 'daftar' && <Formulir data={data} daring={daring} selesai={() => { muat(); setHal('beranda') }} />}
      {data && hal === 'hadir' && <Kehadiran data={data} saya={sesi.user.id} muat={muat} />}
      {data && hal === 'kiosk' && scan && <Kiosk daring={daring} muat={muat} />}
      {data && hal === 'panitia' && staf && <Spmb data={data} saya={sesi.user.id} muat={muat} daring={daring} />}
      {data && hal === 'akun' && <Akun data={data} sesi={sesi} />}
    </main>
    <nav aria-label="Navigasi utama" className="flex flex-none border-t border-line bg-white/95 px-1 pb-[calc(4px+env(safe-area-inset-bottom))] pt-1 backdrop-blur">
      {menu.map(m => <button key={m[0]} onClick={() => setHal(m[0])} aria-current={hal === m[0] ? 'page' : undefined} className={'flex min-h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] ' + (hal === m[0] ? 'font-semibold text-brand-dark' : 'font-medium text-muted')}>
        <span className={'flex h-7 w-13 items-center justify-center rounded-full ' + (hal === m[0] ? 'bg-brand-soft' : '')}><Ikon d={m[2]} /></span>{m[1]}</button>)}
    </nav>
  </div>
}
const Layar = ({ pita, children }) => <div className="flex min-h-dvh flex-col">{pita}<div className="flex flex-1 items-center justify-center p-4"><div className="w-full max-w-sm">{children}</div></div></div>

function Masuk({ google: cara }) {
  const [sibuk, setSibuk] = useState(''), [pesan, setPesan] = useState(''), [email, setEmail] = useState(''), [terkirim, setTerkirim] = useState('')
  const balik = location.origin + import.meta.env.BASE_URL
  const galat = e => /rate|limit|seconds/i.test(e.message || '') ? 'Terlalu sering mencoba. Tunggu sebentar lalu coba lagi.' : /not authorized|not allowed/i.test(e.message || '') ? 'Email ini belum diizinkan menerima link dari server uji.' : 'Belum berhasil. Coba lagi.'
  async function google() {
    setSibuk('g'); setPesan('')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: balik } })
    if (error) { setPesan(galat(error)); setSibuk('') }
  }
  async function lewatEmail(e) {
    e.preventDefault(); if (sibuk) return; setPesan('')
    const em = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setPesan('Tulis alamat email yang benar.'); return }
    setSibuk('e'); const { error } = await supabase.auth.signInWithOtp({ email: em, options: { emailRedirectTo: balik } }); setSibuk('')
    if (error) setPesan(galat(error)); else setTerkirim(em)
  }
  async function tamu() {
    setSibuk('t'); setPesan(''); const { error } = await supabase.auth.signInAnonymously(); setSibuk('')
    if (error) setPesan(/disabled/i.test(error.message || '') ? 'Mode tamu belum dinyalakan di server.' : galat(error))
  }
  return <Kartu className="p-6">
    <div className="mb-5 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">M</span><div><div className="text-xl font-bold">MVISION</div><div className="text-sm text-muted">Sekolah Mutiara</div></div></div>
    <Tombol className="w-full" onClick={google} disabled={!!sibuk || (cara && !cara.google)}>{sibuk === 'g' ? 'Membuka Google…' : 'Masuk dengan Google'}</Tombol>
    {cara && !cara.google && <p role="status" className="mt-2 text-[13px] text-muted">Login Google belum diaktifkan. Untuk uji, pakai email atau mode tamu di bawah.</p>}
    <div className="my-4 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />atau<span className="h-px flex-1 bg-line" /></div>
    {terkirim ? <p role="status" className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">Link masuk dikirim ke <b>{terkirim}</b>. Buka email itu di perangkat ini, lalu tekan link di dalamnya. <button type="button" className="font-semibold underline" onClick={() => setTerkirim('')}>Ganti email</button></p>
      : <form onSubmit={lewatEmail} noValidate className="flex flex-col gap-2"><label htmlFor="m-email" className="text-sm font-semibold">Masuk dengan email</label>
        <input id="m-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" enterKeyHint="send" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" className={kelas(false)} disabled={cara && !cara.email} />
        <Tombol utama type="submit" disabled={!!sibuk || (cara && !cara.email)}>{sibuk === 'e' ? 'Mengirim…' : 'Kirim link masuk'}</Tombol></form>}
    <Tombol className="mt-3 w-full" onClick={tamu} disabled={!!sibuk || (cara && !cara.tamu)}>{sibuk === 't' ? 'Membuka…' : 'Coba sebagai tamu'}</Tombol>
    {cara && !cara.tamu && <p role="status" className="mt-2 text-[13px] text-muted">Mode tamu belum dinyalakan di server.</p>}
    {pesan && <p role="alert" className="mt-3 text-sm text-red-700">{pesan}</p>}
    <p className="mt-4 text-[13px] text-muted">Email dan mode tamu hanya untuk uji internal. Tamu tidak punya identitas dan datanya dapat dihapus kapan saja.</p>
  </Kartu>
}

function Beranda({ data, ke }) {
  const d = data.daftar.filter(x => x.pemilik === data.profil?.id), nm = id => (data.tingkat.find(t => t.id === id) || {}).nama || id
  return <div className="flex flex-col gap-3">
    <button onClick={() => ke('daftar')} className="flex min-h-24 items-center gap-4 rounded-2xl bg-brand p-5 text-left text-white shadow-sm active:scale-[.99]">
      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white text-brand"><Ikon d={IK.tambah} /></span>
      <span><span className="block text-xl font-bold">{d.length ? 'Tambahkan Anak Lain' : 'Daftarkan Anak Saya'}</span><span className="text-sm opacity-90">{data.gelombang[0] ? data.gelombang[0].nama + ' dibuka sampai ' + tgl(data.gelombang[0].tutup) : 'Pendaftaran sedang tidak dibuka'}</span></span>
    </button>
    {data.notif.length > 0 && <Kartu><h2 className="mb-1 text-[15px] font-bold">Kabar terbaru</h2>{data.notif.map(n => <p key={n.id} className="border-t border-line py-2 text-sm first:border-0">{n.teks}</p>)}</Kartu>}
    {!d.length && <Kartu><p className="text-muted">Belum ada anak yang didaftarkan. Tekan tombol hijau di atas untuk mulai.</p></Kartu>}
    {d.map(x => <Kartu key={x.id}><div className="flex items-start justify-between gap-3"><div><div className="text-[17px] font-semibold">{x.anak_nama}</div><div className="text-sm text-muted">{nm(x.tingkat)} · No. {x.no}</div></div><Pil s={x.status} /></div>
      <p className="mt-2 text-[13px] text-muted">Dikirim {tgl(x.dibuat_at)}. Pembayaran dan unggah berkas menyusul di tahap berikutnya.</p></Kartu>)}
  </div>
}

function Isian({ id, label, galat, opsional, children }) {
  return <div className="flex flex-col gap-1.5"><label htmlFor={id} className="text-sm font-semibold">{label} {opsional ? <span className="font-normal text-muted">(opsional)</span> : <span aria-hidden="true" className="text-red-600">*</span>}</label>{children}{galat && <p role="alert" className="text-[13px] text-red-700">{galat}</p>}</div>
}
const kelas = g => 'min-h-12 w-full rounded-xl border bg-white px-3 ' + (g ? 'border-red-400' : 'border-line')

function Formulir({ data, daring, selesai }) {
  const KUNCI = 'mvision-draf'
  const [f, setF] = useState(() => { try { return { ...kosong(), ...JSON.parse(sessionStorage.getItem(KUNCI) || '{}') } } catch { return kosong() } })
  const [g, setG] = useState({}), [sibuk, setSibuk] = useState(false), [pesan, setPesan] = useState(''), [jadi, setJadi] = useState(null)
  const token = useRef(crypto.randomUUID())
  const ubah = (k, v) => { const n = { ...f, [k]: v }; setF(n); if (g[k]) setG({ ...g, [k]: undefined }); if (pesan) setPesan(''); const { nik, ...aman } = n; try { sessionStorage.setItem(KUNCI, JSON.stringify(aman)) } catch { } }
  async function kirim(e) {
    e.preventDefault(); if (sibuk) return
    const er = periksa(f); setG(er); setPesan('')
    if (Object.keys(er).length) { setPesan('Periksa isian yang ditandai merah.'); const el = document.getElementById('f-' + Object.keys(er)[0]); if (el) el.focus(); return }
    if (!daring) { setPesan('Tidak ada koneksi. Isian tetap tersimpan di layar; coba kirim lagi setelah tersambung.'); return }
    setSibuk(true)
    const { data: r, error } = await supabase.rpc('kirim_pendaftaran', { p: { ...f, token: token.current } })
    setSibuk(false)
    if (error) { setPesan(error.message || 'Belum berhasil dikirim. Coba lagi.'); return }
    try { sessionStorage.removeItem(KUNCI) } catch { }
    setJadi(r)
  }
  if (!data.gelombang.length) return <Kartu><p className="text-muted">Pendaftaran sedang tidak dibuka.</p></Kartu>
  if (jadi) return <Kartu className="text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl text-brand-dark">✓</div><h2 className="text-lg font-bold">Pendaftaran terkirim</h2><p className="mt-1 text-muted">{jadi.anak_nama}<br />Nomor pendaftaran <b className="text-ink">{jadi.no}</b></p><Tombol utama className="mt-4 w-full" onClick={selesai}>Kembali ke Beranda</Tombol></Kartu>
  const T = (k, label, o = {}) => <Isian id={'f-' + k} label={label} galat={g[k]} opsional={o.opsional}><input id={'f-' + k} className={kelas(g[k])} value={f[k]} onChange={e => ubah(k, e.target.value)} type={o.type || 'text'} inputMode={o.inputMode} autoComplete={o.auto || 'off'} enterKeyHint="next" max={o.max} /></Isian>
  const P = (k, label, ops) => <Isian id={'f-' + k} label={label} galat={g[k]}><select id={'f-' + k} className={kelas(g[k])} value={f[k]} onChange={e => ubah(k, e.target.value)}><option value="">Pilih</option>{ops.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></Isian>
  return <form onSubmit={kirim} noValidate className="flex flex-col gap-4">
    <Kartu className="flex flex-col gap-4"><h2 className="text-base font-bold">Data anak</h2>
      {P('jalur', 'Jalur', [['baru', 'Siswa baru'], ['pindahan', 'Siswa pindahan']])}
      {P('tingkat', 'Tingkat yang dituju', data.tingkat.map(t => [t.id, t.nama]))}
      {T('anak_nama', 'Nama lengkap anak')}{T('anak_panggilan', 'Nama panggilan', { opsional: true })}
      {P('anak_jk', 'Jenis kelamin', [['Laki-laki', 'Laki-laki'], ['Perempuan', 'Perempuan']])}
      {T('anak_tempat_lahir', 'Tempat lahir')}{T('anak_tgl_lahir', 'Tanggal lahir', { type: 'date', max: new Date().toISOString().slice(0, 10) })}
      {T('nik', 'NIK anak', { opsional: true, inputMode: 'numeric' })}{T('asal_sekolah', 'Asal sekolah', { opsional: true })}</Kartu>
    <Kartu className="flex flex-col gap-4"><h2 className="text-base font-bold">Orang tua atau wali</h2><p className="-mt-2 text-[13px] text-muted">Cukup satu orang.</p>
      {P('wali_hubungan', 'Hubungan dengan anak', [['Ayah', 'Ayah'], ['Ibu', 'Ibu'], ['Wali', 'Wali']])}
      {T('wali_nama', 'Nama lengkap', { auto: 'name' })}{T('wali_hp', 'Nomor HP', { type: 'tel', inputMode: 'tel', auto: 'tel' })}{T('alamat', 'Alamat tinggal', { auto: 'street-address' })}</Kartu>
    <div className="sticky -bottom-6 -mx-4 -mb-6 border-t border-line bg-white px-4 py-3">
      {pesan && <p role="alert" className="mb-2 text-sm text-red-700">{pesan}</p>}
      <Tombol utama type="submit" className="w-full" disabled={sibuk}>{sibuk ? 'Mengirim…' : 'Kirim pendaftaran'}</Tombol>
    </div>
  </form>
}

function Spmb(p) {
  const [tab, setTab] = useState('sheet')
  return <div className="flex flex-col gap-3">
    <div role="tablist" aria-label="Sumber data" className="grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1">{[['sheet', 'Data panitia'], ['online', 'Pendaftar online']].map(t => <button key={t[0]} role="tab" aria-selected={tab === t[0]} onClick={() => setTab(t[0])} className={'min-h-11 rounded-xl text-sm font-semibold ' + (tab === t[0] ? 'bg-white shadow-sm' : 'text-muted')}>{t[1]}</button>)}</div>
    {tab === 'sheet' ? <DataPanitia daring={p.daring} /> : <Panitia {...p} />}
  </div>
}

function Panitia({ data, saya, muat }) {
  const [sibuk, setSibuk] = useState(''), [pesan, setPesan] = useState(''), [tanya, setTanya] = useState(null)
  const bagian = data.peran.some(p => p.peran === 'superadmin') ? null : (data.peran.find(p => p.peran === 'panitia') || { bagian: [] }).bagian
  const nm = id => (data.tingkat.find(t => t.id === id) || {}).nama || id
  async function ubah(x, ke, cat = null) {
    if (['dibatalkan', 'tidak_diterima', 'berkas_perlu_perbaikan'].includes(ke) && cat === null) { setTanya({ x, ke, alasan: '' }); return }
    setTanya(null); setSibuk(x.id); setPesan('')
    const { error } = await supabase.rpc('ubah_status', { p_id: x.id, p_ke: ke, p_catatan: cat })
    setSibuk(''); if (error) setPesan(error.message); else muat()
  }
  return <div className="flex flex-col gap-3">
    {pesan && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{pesan}</p>}
    {!data.daftar.length && <Kartu><p className="text-muted">Belum ada pendaftar.</p></Kartu>}
    {tanya && <Lembar judul={(STATUS[tanya.ke] || [tanya.ke])[0] + '?'} tutup={() => setTanya(null)}><label htmlFor="t-al" className="text-sm font-semibold">Alasan <span className="text-red-600">*</span></label><textarea id="t-al" rows="2" className="mt-1.5 min-h-12 w-full rounded-xl border border-line px-3 py-2" value={tanya.alasan} onChange={e => setTanya({ ...tanya, alasan: e.target.value })} /><div className="mt-4 flex flex-col gap-2"><Tombol bahaya disabled={!tanya.alasan.trim()} onClick={() => ubah(tanya.x, tanya.ke, tanya.alasan.trim())}>Simpan</Tombol><Tombol onClick={() => setTanya(null)}>Batal</Tombol></div></Lembar>}
    {data.daftar.map(x => { const aksi = data.transisi.filter(t => t.dari === x.status && t.bagian !== 'pemilik' && (!bagian || bagian.includes(t.bagian)) && x.pemilik !== saya)
      return <Kartu key={x.id}><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{x.anak_nama}</div><div className="text-sm text-muted">{nm(x.tingkat)} · {x.no} · {x.wali_nama} ({x.wali_hubungan})</div></div><Pil s={x.status} /></div>
        {x.pemilik === saya && <p className="mt-2 text-[13px] text-muted">Ini anak Anda sendiri. Panitia lain yang memprosesnya.</p>}
        {aksi.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{aksi.map(t => <Tombol key={t.ke} disabled={sibuk === x.id} bahaya={['dibatalkan', 'tidak_diterima'].includes(t.ke)} utama={!['dibatalkan', 'tidak_diterima', 'berkas_perlu_perbaikan', 'menunggu_pembayaran'].includes(t.ke)} onClick={() => ubah(x, t.ke)}>{(STATUS[t.ke] || [t.ke])[0]}</Tombol>)}</div>}
      </Kartu> })}
  </div>
}

function Akun({ data, sesi }) {
  return <div className="flex flex-col gap-3"><Kartu><div className="text-[17px] font-semibold">{data.profil?.nama || (sesi.user.is_anonymous ? 'Tamu' : 'Tanpa nama')}</div><div className="text-sm text-muted">{sesi.user.is_anonymous ? 'Tamu (uji) · tanpa identitas' : sesi.user.email}</div>
    <div className="mt-2 text-sm">Kode akun: <b className="tracking-widest">{sesi.user.id.slice(0, 8).toUpperCase()}</b></div>
    <div className="mt-3 flex flex-wrap gap-2">{data.peran.map(p => <span key={p.peran} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold">{PERAN[p.peran]}{p.bagian?.length ? ' · ' + p.bagian.join(', ') : ''}</span>)}</div></Kartu>
    <Tombol bahaya onClick={() => supabase.auth.signOut()}>Keluar</Tombol>
    <p className="text-[13px] text-muted">Sudah di server: login, pendaftaran, absensi kedatangan dengan QR, dan salinan data SPMB dari sheet panitia. Pembayaran, berkas, penjemputan, dan pengenalan wajah masih di versi demo.</p></div>
}
