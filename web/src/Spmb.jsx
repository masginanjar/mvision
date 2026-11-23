import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'
import { Tombol, Kartu, Tanda, isian, Lembar } from './ui.jsx'

// Data SPMB dari Google Sheet panitia (salinan baca-saja; sumber kebenaran tetap di sheet).
const angka = s => { const n = parseInt(String(s ?? '').replace(/[^\d-]/g, ''), 10); return isNaN(n) ? 0 : n }
export const waTaut = no => { let d = String(no || '').replace(/\D/g, ''); if (!d) return null; if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d; return d.length >= 10 ? 'https://wa.me/' + d : null }
export const tahap = x => x.sudah_du ? ['Daftar ulang', 'ok'] : x.sudah_wawancara ? ['Sudah wawancara', 'info'] : x.sudah_form ? ['Bayar formulir', 'warn'] : ['Terdaftar', 'mute']
const SARING = [['semua', 'Semua', () => true], ['form', 'Belum bayar formulir', x => !x.sudah_form], ['wawancara', 'Belum wawancara', x => x.sudah_form && !x.sudah_wawancara], ['du', 'Belum daftar ulang', x => x.sudah_wawancara && !x.sudah_du], ['selesai', 'Sudah daftar ulang', x => x.sudah_du]]
const waktu = t => t ? new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'

export function DataPanitia({ daring }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [sibuk, setSibuk] = useState(false), [info, setInfo] = useState('')
  const [saring, setSaring] = useState('semua'), [jenjang, setJenjang] = useState(''), [cari, setCari] = useState(''), [batas, setBatas] = useState(30), [buka, setBuka] = useState(null)
  async function muat() {
    setGalat('')
    const [a, b, c] = await Promise.all([
      supabase.from('spmb_pendaftar_sheet').select('*').order('baris'),
      supabase.from('spmb_rekap_sheet').select('*').order('baris'),
      supabase.from('spmb_sinkron_log').select('at,tab,berubah,galat').order('id', { ascending: false }).limit(6)])
    const e = a.error || b.error || c.error
    if (e) { setGalat(e.message); return }
    setD({ daftar: a.data, rekap: b.data, log: c.data })
  }
  useEffect(() => { muat() }, [])
  async function tarik() {
    setSibuk(true); setInfo('')
    const { data, error } = await supabase.functions.invoke('tarik-spmb', { body: {} })
    setSibuk(false)
    if (error) { setInfo('Gagal menarik data. Coba lagi sebentar.'); return }
    const h = (data && data.hasil) || [], gagal = h.filter(x => x.galat)
    setInfo(gagal.length ? 'Sebagian tab tidak terbaca. Pastikan sheet masih bisa dibuka lewat link.' : h.some(x => x.berubah) ? 'Data diperbarui.' : 'Tidak ada perubahan di sheet.')
    muat()
  }
  const daftar = d ? d.daftar : []
  const jenjangAda = useMemo(() => [...new Set(daftar.map(x => x.jenjang_rapi).filter(Boolean))].sort(), [d])
  const hasil = useMemo(() => { const f = SARING.find(s => s[0] === saring)[2], q = cari.trim().toLowerCase()
    return daftar.filter(x => f(x) && (!jenjang || x.jenjang_rapi === jenjang) && (!q || [x.nama, x.ayah, x.bunda, x.nis].some(v => (v || '').toLowerCase().includes(q)))) }, [d, saring, jenjang, cari])
  useEffect(() => setBatas(30), [saring, jenjang, cari])

  if (galat) return <Kartu className="border-red-200"><p className="mb-3 text-red-700">{galat}</p><Tombol onClick={muat}>Coba lagi</Tombol></Kartu>
  if (!d) return <p className="text-center text-muted">Memuat data panitia…</p>
  const n = daftar.length, hit = k => daftar.filter(x => x[k]).length
  const corong = [['Terdaftar', n], ['Bayar formulir', hit('sudah_form')], ['Wawancara', hit('sudah_wawancara')], ['Daftar ulang', hit('sudah_du')]]
  const terakhir = d.log.find(l => !l.galat), rusak = d.log[0] && d.log[0].galat
  const unit = d.rekap.filter(r => r.unit && r.unit !== 'KB-TK' && !/^jumlah$/i.test(r.unit) && (angka(r.terdaftar) > 0 || angka(r.kuota) > 0))

  return <div className="flex flex-col gap-3">
    <Kartu>
      <div className="flex items-start justify-between gap-3"><div><div className="font-semibold">Google Sheet panitia</div><div className="text-[13px] text-muted">Dicek otomatis tiap jam · terakhir {waktu(terakhir && terakhir.at)}</div></div><Tanda w={rusak ? 'bad' : 'ok'}>{rusak ? 'Gagal baca' : 'Tersambung'}</Tanda></div>
      {rusak && <p className="mt-2 text-[13px] text-red-700">Sheet terakhir tidak terbaca. Data di bawah adalah salinan terakhir yang berhasil.</p>}
      <Tombol className="mt-3 w-full" disabled={sibuk || !daring} onClick={tarik}>{sibuk ? 'Menarik…' : 'Tarik sekarang'}</Tombol>
      {info && <p role="status" className="mt-2 text-[13px] text-muted">{info}</p>}
      <p className="mt-2 text-[13px] text-muted">Hanya salinan untuk dibaca. Perubahan data tetap dilakukan di sheet.</p>
    </Kartu>

    <Kartu><div className="mb-3 font-semibold">Perjalanan pendaftar 2027/2028</div>
      <div className="flex flex-col gap-2.5">{corong.map(([l, v]) => <div key={l}><div className="mb-1 flex justify-between text-sm"><span>{l}</span><b>{v}</b></div><div className="h-2.5 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={l + ' ' + v + ' dari ' + n}><div className="h-full rounded-full bg-brand" style={{ width: (n ? Math.max(2, v / n * 100) : 0) + '%' }} /></div></div>)}</div>
    </Kartu>

    {unit.length > 0 && <Kartu><div className="mb-1 font-semibold">Kuota per kelas</div><p className="mb-3 text-[13px] text-muted">Angka dari tab rekapitulasi panitia.</p>
      <div className="flex flex-col divide-y divide-line">{unit.map(r => <div key={r.baris} className="flex items-center justify-between gap-3 py-2.5"><div><div className="font-medium">{r.unit}</div><div className="text-[13px] text-muted">Terdaftar {angka(r.terdaftar)} · daftar ulang {angka(r.daftar_ulang)}</div></div><div className="text-right"><div className="text-[17px] font-bold tabular-nums">{angka(r.sisa_kuota)}</div><div className="text-xs text-muted">sisa kuota</div></div></div>)}</div>
    </Kartu>}

    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Saring tindak lanjut">{SARING.map(s => <button key={s[0]} role="tab" aria-selected={saring === s[0]} onClick={() => setSaring(s[0])} className={'min-h-11 flex-none rounded-full border px-4 text-sm font-semibold ' + (saring === s[0] ? 'border-brand bg-brand text-white' : 'border-line bg-white')}>{s[1]} <span className="tabular-nums opacity-80">{daftar.filter(s[2]).length}</span></button>)}</div>
    <div className="flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="sp-cari">Cari nama</label><input id="sp-cari" type="search" inputMode="search" placeholder="Cari nama anak atau orang tua" className={isian + ' text-base'} value={cari} onChange={e => setCari(e.target.value)} />
      <label className="sr-only" htmlFor="sp-jj">Jenjang</label><select id="sp-jj" className={isian + ' text-base sm:w-48'} value={jenjang} onChange={e => setJenjang(e.target.value)}><option value="">Semua jenjang</option>{jenjangAda.map(j => <option key={j}>{j}</option>)}</select></div>
    <p className="text-[13px] text-muted" aria-live="polite">{hasil.length} pendaftar</p>
    {!hasil.length && <Kartu><p className="text-muted">Tidak ada yang cocok dengan saringan ini.</p></Kartu>}
    {hasil.slice(0, batas).map(x => { const t = tahap(x); return <button key={x.baris} onClick={() => setBuka(x)} className="rounded-2xl border border-line bg-white p-4 text-left active:bg-zinc-50">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold">{x.nama}</div><div className="truncate text-sm text-muted">{[x.jenjang_rapi, x.jalur, x.asal_sekolah].filter(Boolean).join(' · ') || 'Jenjang belum diisi'}</div></div><Tanda w={t[1]}>{t[0]}</Tanda></div></button> })}
    {hasil.length > batas && <Tombol onClick={() => setBatas(batas + 30)}>Tampilkan lagi ({hasil.length - batas})</Tombol>}

    {buka && <Lembar judul={buka.nama} tutup={() => setBuka(null)}>
      <div className="mb-3 flex flex-wrap gap-2"><Tanda w={tahap(buka)[1]}>{tahap(buka)[0]}</Tanda>{buka.jenjang_rapi && <Tanda>{buka.jenjang_rapi}</Tanda>}{buka.jalur && <Tanda>{buka.jalur}</Tanda>}</div>
      <dl className="flex flex-col gap-2.5 text-[15px]">{[['No. induk', buka.nis], ['Jenis kelamin', buka.jk], ['Saudara', buka.saudara], ['Ayah', buka.ayah], ['Bunda', buka.bunda], ['Alamat', buka.alamat], ['Asal sekolah', buka.asal_sekolah], ['Gelombang', buka.gelombang], ['Formulir', buka.sudah_form ? 'Rp ' + buka.form_rp + (buka.form_tgl_bayar ? ' · ' + buka.form_tgl_bayar : '') : 'Belum bayar'], ['Wawancara', buka.tgl_wawancara ? buka.tgl_wawancara + (buka.sudah_wawancara ? ' · selesai' : '') : null], ['Observasi', buka.tgl_observasi], ['Pengumuman', buka.tgl_pengumuman], ['No. surat', buka.no_surat], ['Catatan', buka.catatan]].filter(r => r[1]).map(r => <div key={r[0]} className="flex gap-3"><dt className="w-28 flex-none text-muted">{r[0]}</dt><dd className="min-w-0 break-words">{r[1]}</dd></div>)}</dl>
      <div className="mt-4 flex flex-col gap-2">{[['Ayah', buka.wa_ayah], ['Bunda', buka.wa_bunda]].map(([s, no]) => waTaut(no) && <a key={s} href={waTaut(no)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-4 text-[15px] font-semibold text-white">WhatsApp {s}</a>)}<Tombol onClick={() => setBuka(null)}>Tutup</Tombol></div>
    </Lembar>}
  </div>
}
