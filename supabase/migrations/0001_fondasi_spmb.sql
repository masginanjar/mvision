-- MVISION tahap 1: identitas, peran, data induk SPMB, pendaftaran. Semua tabel memakai RLS.
create type public.peran as enum ('ortu','pegawai','panitia','superadmin');
create type public.status_daftar as enum ('menunggu_pembayaran','menunggu_verifikasi_bayar','lunas_pendaftaran','berkas_diunggah','berkas_perlu_perbaikan','berkas_terverifikasi','terjadwal_seleksi','selesai_seleksi','diterima','cadangan','tidak_diterima','menunggu_daftar_ulang','daftar_ulang_lunas','siswa_aktif','mengundurkan_diri','dibatalkan');

create table public.profil (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null default '',
  email text,
  hp text,
  dibuat_at timestamptz not null default now()
);
create table public.peran_pengguna (
  user_id uuid not null references auth.users(id) on delete cascade,
  peran public.peran not null,
  bagian text[] not null default '{}',
  jabatan text,
  primary key (user_id, peran)
);
create table public.tahun_ajaran (id text primary key, aktif boolean not null default false);
create table public.tingkat (
  id text primary key, nama text not null, jenjang text not null check (jenjang in ('KB','TK','SD','SMP')),
  urut int not null, usia_min_bulan int
);
create table public.gelombang (
  id uuid primary key default gen_random_uuid(), tahun text not null references public.tahun_ajaran(id),
  nama text not null, buka date not null, tutup date not null, aktif boolean not null default true,
  check (tutup >= buka)
);
create index on public.gelombang (tahun);
create table public.kuota (
  tahun text not null references public.tahun_ajaran(id), tingkat text not null references public.tingkat(id),
  jumlah int not null check (jumlah >= 0), primary key (tahun, tingkat)
);
create index on public.kuota (tingkat);
create sequence public.no_daftar_seq;
create table public.pendaftaran (
  id uuid primary key default gen_random_uuid(),
  no text not null unique,
  pemilik uuid not null references auth.users(id),
  tahun text not null references public.tahun_ajaran(id),
  gelombang_id uuid not null references public.gelombang(id),
  tingkat text not null references public.tingkat(id),
  jalur text not null check (jalur in ('baru','pindahan')),
  anak_nama text not null, anak_panggilan text, anak_jk text not null check (anak_jk in ('Laki-laki','Perempuan')),
  anak_tempat_lahir text not null, anak_tgl_lahir date not null, nik text, asal_sekolah text,
  wali_hubungan text not null check (wali_hubungan in ('Ayah','Ibu','Wali')), wali_nama text not null, wali_hp text not null,
  alamat text not null,
  status public.status_daftar not null default 'menunggu_pembayaran',
  token_kirim uuid not null,
  dibuat_at timestamptz not null default now(), diubah_at timestamptz not null default now(),
  unique (pemilik, token_kirim)
);
create index on public.pendaftaran (pemilik);
create index on public.pendaftaran (tahun, tingkat, status);
create index on public.pendaftaran (gelombang_id);
create index on public.pendaftaran (tingkat);
create table public.transisi_status (
  dari public.status_daftar not null, ke public.status_daftar not null, bagian text not null, primary key (dari, ke)
);
create table public.riwayat_status (
  id bigint generated always as identity primary key, pendaftaran_id uuid not null references public.pendaftaran(id) on delete cascade,
  dari public.status_daftar, ke public.status_daftar not null, oleh uuid references auth.users(id), catatan text, at timestamptz not null default now()
);
create index on public.riwayat_status (pendaftaran_id);
create index on public.riwayat_status (oleh);
create table public.audit_log (
  id bigint generated always as identity primary key, at timestamptz not null default now(),
  oleh uuid references auth.users(id), aksi text not null, ket text, pendaftaran_id uuid references public.pendaftaran(id) on delete set null
);
create index on public.audit_log (pendaftaran_id);
create index on public.audit_log (oleh);

-- fungsi bantu hak akses (dipakai kebijakan RLS)
create schema if not exists privat;
create or replace function privat.punya_peran(p public.peran) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.peran_pengguna r where r.user_id = (select auth.uid()) and r.peran = p)
$$;
create or replace function privat.staf_spmb() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.peran_pengguna r where r.user_id = (select auth.uid()) and r.peran in ('panitia','superadmin'))
$$;
create or replace function privat.punya_bagian(b text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.peran_pengguna r where r.user_id = (select auth.uid())
    and (r.peran = 'superadmin' or (r.peran = 'panitia' and b = any (r.bagian))))
$$;
revoke all on schema privat from public, anon;
grant usage on schema privat to authenticated;
revoke all on all functions in schema privat from public, anon;
grant execute on all functions in schema privat to authenticated;

-- pengguna baru: buat profil dan peran orang tua
create or replace function privat.pengguna_baru() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profil (id, nama, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), new.email)
  on conflict (id) do nothing;
  insert into public.peran_pengguna (user_id, peran) values (new.id, 'ortu') on conflict do nothing;
  return new;
end $$;
revoke all on function privat.pengguna_baru() from public, anon, authenticated;
create trigger pengguna_baru after insert on auth.users for each row execute function privat.pengguna_baru();

-- RLS
alter table public.profil enable row level security;
alter table public.peran_pengguna enable row level security;
alter table public.tahun_ajaran enable row level security;
alter table public.tingkat enable row level security;
alter table public.gelombang enable row level security;
alter table public.kuota enable row level security;
alter table public.pendaftaran enable row level security;
alter table public.transisi_status enable row level security;
alter table public.riwayat_status enable row level security;
alter table public.audit_log enable row level security;

create policy profil_lihat on public.profil for select to authenticated using (id = (select auth.uid()) or (select privat.staf_spmb()));
create policy profil_ubah on public.profil for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy peran_lihat on public.peran_pengguna for select to authenticated using (user_id = (select auth.uid()) or (select privat.punya_peran('superadmin')));
create policy peran_tambah on public.peran_pengguna for insert to authenticated with check ((select privat.punya_peran('superadmin')));
create policy peran_ubah on public.peran_pengguna for update to authenticated using ((select privat.punya_peran('superadmin'))) with check ((select privat.punya_peran('superadmin')));
create policy peran_hapus on public.peran_pengguna for delete to authenticated using ((select privat.punya_peran('superadmin')));

create policy induk_lihat on public.tahun_ajaran for select to authenticated using (true);
create policy induk_lihat on public.tingkat for select to authenticated using (true);
create policy induk_lihat on public.gelombang for select to authenticated using (true);
create policy induk_lihat on public.kuota for select to authenticated using (true);
create policy induk_lihat on public.transisi_status for select to authenticated using (true);
create policy induk_tambah on public.tahun_ajaran for insert to authenticated with check ((select privat.punya_peran('superadmin')));
create policy induk_ubah on public.tahun_ajaran for update to authenticated using ((select privat.punya_peran('superadmin'))) with check ((select privat.punya_peran('superadmin')));
create policy induk_tambah on public.gelombang for insert to authenticated with check ((select privat.punya_peran('superadmin')));
create policy induk_ubah on public.gelombang for update to authenticated using ((select privat.punya_peran('superadmin'))) with check ((select privat.punya_peran('superadmin')));
create policy induk_tambah on public.kuota for insert to authenticated with check ((select privat.punya_peran('superadmin')));
create policy induk_ubah on public.kuota for update to authenticated using ((select privat.punya_peran('superadmin'))) with check ((select privat.punya_peran('superadmin')));

-- pendaftaran: klien hanya boleh membaca. Menulis hanya lewat fungsi server di bawah.
create policy daftar_lihat on public.pendaftaran for select to authenticated using (pemilik = (select auth.uid()) or (select privat.staf_spmb()));
create policy riwayat_lihat on public.riwayat_status for select to authenticated
  using (exists (select 1 from public.pendaftaran p where p.id = pendaftaran_id and (p.pemilik = (select auth.uid()) or (select privat.staf_spmb()))));
create policy audit_lihat on public.audit_log for select to authenticated using ((select privat.punya_peran('superadmin')));

revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.pendaftaran, public.riwayat_status, public.audit_log, public.transisi_status, public.tingkat from authenticated;
revoke all on sequence public.no_daftar_seq from anon, authenticated;

-- kirim pendaftaran: validasi di server, aman dikirim ulang (token), cek gelombang, duplikat, dan kuota
create or replace function public.kirim_pendaftaran(p jsonb) returns public.pendaftaran
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := (select auth.uid());
  tok uuid; r public.pendaftaran; g public.gelombang; t public.tingkat; q int; terisi int; lahir date; usia int; nik_ text; nama_ text;
begin
  if u is null then raise exception 'Silakan masuk terlebih dahulu.' using errcode = '28000'; end if;
  begin tok := (p ->> 'token')::uuid; exception when others then raise exception 'Token pengiriman tidak sah.'; end;
  if tok is null then raise exception 'Token pengiriman wajib ada.'; end if;
  select * into r from public.pendaftaran where pemilik = u and token_kirim = tok;
  if found then return r; end if;

  nama_ := btrim(coalesce(p ->> 'anak_nama', ''));
  if length(nama_) < 3 then raise exception 'Nama lengkap anak wajib diisi.'; end if;
  if coalesce(p ->> 'anak_jk', '') not in ('Laki-laki','Perempuan') then raise exception 'Pilih jenis kelamin anak.'; end if;
  if btrim(coalesce(p ->> 'anak_tempat_lahir', '')) = '' then raise exception 'Tempat lahir wajib diisi.'; end if;
  begin lahir := (p ->> 'anak_tgl_lahir')::date; exception when others then raise exception 'Tanggal lahir tidak sah.'; end;
  if lahir is null or lahir > current_date then raise exception 'Tanggal lahir tidak boleh kosong atau di masa depan.'; end if;
  if coalesce(p ->> 'jalur', '') not in ('baru','pindahan') then raise exception 'Pilih jalur: siswa baru atau pindahan.'; end if;
  if coalesce(p ->> 'wali_hubungan', '') not in ('Ayah','Ibu','Wali') then raise exception 'Pilih Ayah, Ibu, atau Wali.'; end if;
  if btrim(coalesce(p ->> 'wali_nama', '')) = '' then raise exception 'Nama orang tua atau wali wajib diisi.'; end if;
  if coalesce(p ->> 'wali_hp', '') !~ '^[0-9+][0-9 -]{7,17}$' then raise exception 'Nomor HP tidak sah.'; end if;
  if btrim(coalesce(p ->> 'alamat', '')) = '' then raise exception 'Alamat wajib diisi.'; end if;
  nik_ := nullif(regexp_replace(coalesce(p ->> 'nik', ''), '\D', '', 'g'), '');
  if nik_ is not null and length(nik_) <> 16 then raise exception 'NIK harus 16 angka, atau kosongkan.'; end if;

  select * into t from public.tingkat where id = p ->> 'tingkat';
  if not found then raise exception 'Tingkat tidak dikenal.'; end if;
  select gl.* into g from public.gelombang gl join public.tahun_ajaran ta on ta.id = gl.tahun
   where ta.aktif and gl.aktif and current_date between gl.buka and gl.tutup order by gl.buka limit 1;
  if not found then raise exception 'Pendaftaran sedang tidak dibuka.'; end if;
  if (p ->> 'jalur') = 'baru' and t.usia_min_bulan is not null then
    usia := (extract(year from age(current_date, lahir)) * 12 + extract(month from age(current_date, lahir)))::int;
    if usia < t.usia_min_bulan then raise exception 'Usia anak belum memenuhi syarat untuk %.', t.nama; end if;
  end if;

  -- kunci per tahun dan tingkat agar dua pengiriman bersamaan tidak melewati kuota
  perform pg_advisory_xact_lock(hashtext(g.tahun || ':' || t.id));
  if exists (select 1 from public.pendaftaran d where d.tahun = g.tahun and d.status not in ('dibatalkan','mengundurkan_diri','tidak_diterima')
     and ((nik_ is not null and d.nik = nik_) or (lower(d.anak_nama) = lower(nama_) and d.anak_tgl_lahir = lahir))) then
    raise exception 'Anak ini sudah terdaftar pada tahun ajaran %.', g.tahun;
  end if;
  select jumlah into q from public.kuota where tahun = g.tahun and tingkat = t.id;
  select count(*) into terisi from public.pendaftaran d where d.tahun = g.tahun and d.tingkat = t.id and d.status not in ('dibatalkan','mengundurkan_diri','tidak_diterima');
  if q is null or terisi >= q then raise exception 'Kuota % sudah penuh.', t.nama; end if;

  insert into public.pendaftaran (no, pemilik, tahun, gelombang_id, tingkat, jalur, anak_nama, anak_panggilan, anak_jk, anak_tempat_lahir, anak_tgl_lahir, nik, asal_sekolah, wali_hubungan, wali_nama, wali_hp, alamat, token_kirim)
  values (t.jenjang || '-' || right(split_part(g.tahun, '/', 1), 2) || '-' || lpad(nextval('public.no_daftar_seq')::text, 4, '0'), u, g.tahun, g.id, t.id, p ->> 'jalur', nama_, nullif(btrim(coalesce(p ->> 'anak_panggilan', '')), ''), p ->> 'anak_jk', btrim(p ->> 'anak_tempat_lahir'), lahir, nik_, nullif(btrim(coalesce(p ->> 'asal_sekolah', '')), ''), p ->> 'wali_hubungan', btrim(p ->> 'wali_nama'), btrim(p ->> 'wali_hp'), btrim(p ->> 'alamat'), tok)
  returning * into r;
  insert into public.riwayat_status (pendaftaran_id, dari, ke, oleh, catatan) values (r.id, null, r.status, u, 'Pendaftaran dikirim');
  insert into public.audit_log (oleh, aksi, ket, pendaftaran_id) values (u, 'Pendaftaran dikirim', r.no, r.id);
  return r;
end $$;

-- ubah status: hanya panitia bagian terkait atau superadmin, mengikuti tabel transisi, tidak untuk anak sendiri
create or replace function public.ubah_status(p_id uuid, p_ke public.status_daftar, p_catatan text default null) returns public.pendaftaran
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); r public.pendaftaran; tr public.transisi_status;
begin
  if u is null then raise exception 'Silakan masuk terlebih dahulu.' using errcode = '28000'; end if;
  select * into r from public.pendaftaran where id = p_id for update;
  if not found then raise exception 'Pendaftaran tidak ditemukan.'; end if;
  if r.status = p_ke then return r; end if;
  select * into tr from public.transisi_status where dari = r.status and ke = p_ke;
  if not found then raise exception 'Perubahan status dari % ke % tidak diizinkan.', r.status, p_ke; end if;
  if tr.bagian = 'pemilik' then
    if r.pemilik <> u then raise exception 'Hanya orang tua pendaftar yang dapat melakukan ini.'; end if;
  else
    if not privat.punya_bagian(tr.bagian) then raise exception 'Anda tidak punya izin untuk tindakan ini.' using errcode = '42501'; end if;
    if r.pemilik = u then raise exception 'Ini pendaftaran anak Anda sendiri. Minta panitia lain yang memprosesnya.' using errcode = '42501'; end if;
  end if;
  if p_ke in ('dibatalkan','tidak_diterima','berkas_perlu_perbaikan') and btrim(coalesce(p_catatan, '')) = '' then raise exception 'Alasan wajib diisi.'; end if;
  update public.pendaftaran set status = p_ke, diubah_at = now() where id = p_id returning * into r;
  insert into public.riwayat_status (pendaftaran_id, dari, ke, oleh, catatan) values (r.id, tr.dari, p_ke, u, p_catatan);
  insert into public.audit_log (oleh, aksi, ket, pendaftaran_id) values (u, 'Status diubah', tr.dari || ' ke ' || p_ke || coalesce(' · ' || p_catatan, ''), r.id);
  return r;
end $$;
revoke all on function public.kirim_pendaftaran(jsonb) from public, anon;
revoke all on function public.ubah_status(uuid, public.status_daftar, text) from public, anon;
grant execute on function public.kirim_pendaftaran(jsonb) to authenticated;
grant execute on function public.ubah_status(uuid, public.status_daftar, text) to authenticated;

-- data induk awal (CONTOH, diubah superadmin sebelum dipakai sungguhan)
insert into public.tahun_ajaran (id, aktif) values ('2027/2028', true);
insert into public.tingkat (id, nama, jenjang, urut, usia_min_bulan) values
 ('kb','KB','KB',1,24),('tka','TK A','TK',2,48),('tkb','TK B','TK',3,60),
 ('sd1','SD Kelas 1','SD',4,72),('sd2','SD Kelas 2','SD',5,null),('sd3','SD Kelas 3','SD',6,null),('sd4','SD Kelas 4','SD',7,null),('sd5','SD Kelas 5','SD',8,null),('sd6','SD Kelas 6','SD',9,null),
 ('smp7','SMP Kelas 7','SMP',10,null),('smp8','SMP Kelas 8','SMP',11,null),('smp9','SMP Kelas 9','SMP',12,null);
insert into public.gelombang (tahun, nama, buka, tutup) values ('2027/2028', 'Gelombang 1 (CONTOH)', current_date, current_date + 90);
insert into public.kuota (tahun, tingkat, jumlah) select '2027/2028', id, 20 from public.tingkat;
insert into public.transisi_status (dari, ke, bagian) values
 ('menunggu_pembayaran','menunggu_verifikasi_bayar','pemilik'),('menunggu_pembayaran','lunas_pendaftaran','pembayaran'),('menunggu_verifikasi_bayar','lunas_pendaftaran','pembayaran'),('menunggu_verifikasi_bayar','menunggu_pembayaran','pembayaran'),
 ('lunas_pendaftaran','berkas_diunggah','pemilik'),('berkas_diunggah','berkas_terverifikasi','berkas'),('berkas_diunggah','berkas_perlu_perbaikan','berkas'),('berkas_perlu_perbaikan','berkas_diunggah','pemilik'),
 ('berkas_terverifikasi','terjadwal_seleksi','seleksi'),('terjadwal_seleksi','selesai_seleksi','seleksi'),
 ('selesai_seleksi','diterima','hasil'),('selesai_seleksi','cadangan','hasil'),('selesai_seleksi','tidak_diterima','hasil'),('cadangan','diterima','hasil'),
 ('diterima','menunggu_daftar_ulang','hasil'),('menunggu_daftar_ulang','daftar_ulang_lunas','pembayaran'),('daftar_ulang_lunas','siswa_aktif','hasil'),
 ('menunggu_pembayaran','mengundurkan_diri','pemilik'),('menunggu_verifikasi_bayar','mengundurkan_diri','pemilik'),('lunas_pendaftaran','mengundurkan_diri','pemilik'),('berkas_diunggah','mengundurkan_diri','pemilik'),('berkas_perlu_perbaikan','mengundurkan_diri','pemilik'),('berkas_terverifikasi','mengundurkan_diri','pemilik'),
 ('menunggu_pembayaran','dibatalkan','pembayaran');
