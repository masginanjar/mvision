import React, { useEffect } from 'react'
export const Tombol = ({ utama, bahaya, className = '', ...p }) => <button {...p} className={'min-h-12 rounded-xl px-4 text-[15px] font-semibold transition active:scale-[.98] disabled:opacity-50 ' + (utama ? 'bg-brand text-white ' : bahaya ? 'border border-red-200 bg-white text-red-700 ' : 'border border-line bg-white ') + className} />
export const Kartu = ({ className = '', ...p }) => <div {...p} className={'rounded-2xl border border-line bg-white p-4 ' + className} />
const W = { ok: 'bg-brand-soft text-brand-dark', warn: 'bg-amber-100 text-amber-800', bad: 'bg-red-100 text-red-700', info: 'bg-sky-100 text-sky-800', mute: 'bg-zinc-100 text-zinc-600' }
export const Tanda = ({ w = 'mute', children }) => <span className={'inline-flex flex-none items-center rounded-full px-2.5 py-1 text-xs font-semibold ' + W[w]}>{children}</span>
export const isian = 'min-h-12 w-full rounded-xl border border-line bg-white px-3'
// Lembar bawah (bottom sheet) untuk pilihan dan tindakan singkat
export function Lembar({ judul, tutup, children }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape') tutup() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={e => { if (e.target === e.currentTarget) tutup() }}>
    <div role="dialog" aria-modal="true" aria-label={judul} className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:rounded-3xl">
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-300 sm:hidden" /><h2 className="mb-3 text-lg font-bold">{judul}</h2>{children}</div></div>
}
