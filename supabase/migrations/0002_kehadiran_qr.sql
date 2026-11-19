-- MVISION tahap 2: siswa, kelas, gedung, absensi kedatangan dengan QR. Tanpa biometrik.
create table public.gedung (id text primary key, nama text not null);
create table public.kelas (id text primary key, nama text not null, tingkat text not null references public.tingkat(id), gedung text not null references public.gedung(id));
create index on public.kelas (tingkat); create index on public.kelas (gedung);
create table public.jadwal_hadir (jenjang text primary key check (jenjang in ('KB','TK','SD','SMP')), masuk time not null, telat time not null, pulang time not null, check (telat >= masuk and pulang > telat));
create table public.siswa (
  id uuid primary key default gen_random_uuid(), nama text not null, panggilan text not null, kelas text not null references public.kelas(id),
  ortu uuid references auth.users(id) on delete set null, aktif boolean not null default true, contoh boolean not null default false, dibuat_at timestamptz not null default now()
);
create index on public.siswa (kelas); create index on public.siswa (ortu);
create table public.siswa_qr (
  siswa_id uuid primary key references public.siswa(id) on delete cascade, token uuid not null unique default gen_random_uuid(),
  kode text not null unique, berlaku_sampai date not null
);
create table public.petugas_hadir (
  user_id uuid not null references auth.users(id) on delete cascade, izin text not null check (izin in ('guru','gerbang','admin','kepsek')),
  kelas text references public.kelas(id), gedung text references public.gedung(id), primary key (user_id, izin)
);
create index on public.petugas_hadir (kelas); create index on public.petugas_hadir (gedung);
create table public.absensi (
  id uuid primary key default gen_random_uuid(), siswa_id uuid not null references public.siswa(id) on delete cascade, tgl date not null,
  jenis text not null check (jenis in ('datang','pulang')), at timestamptz not null default now(),
  status text not null check (status in ('hadir','terlambat','izin','sakit','alpa')), metode text not null check (metode in ('qr','manual','koreksi')),
  perangkat text, oleh uuid references auth.users(id), catatan text, unique (siswa_id, tgl, jenis)
);
create index on public.absensi (tgl); create index on public.absensi (oleh);
create table public.scan_log (
  id uuid primary key, at timestamptz not null default now(), perangkat text, oleh uuid references auth.users(id),
  siswa_id uuid references public.siswa(id) on delete set null, hasil text not null check (hasil in ('diterima','duplikat','ditolak')), alasan text, balasan jsonb not null
);
create index on public.scan_log (at); create index on public.scan_log (oleh); create index on public.scan_log (siswa_id);
create table public.notifikasi (
  id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, teks text not null, at timestamptz not null default now(), dibaca boolean not null default false
);
create index on public.notifikasi (user_id, at desc);

create or replace function privat.izin_hadir(variadic p text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.peran_pengguna r where r.user_id = (select auth.uid()) and r.peran = 'superadmin')
      or exists (select 1 from public.petugas_hadir h where h.user_id = (select auth.uid()) and h.izin = any (p))
$$;
create or replace function privat.boleh_siswa(s uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.peran_pengguna r where r.user_id = (select auth.uid()) and r.peran = 'superadmin')
      or exists (select 1 from public.petugas_hadir h join public.siswa x on x.id = s join public.kelas k on k.id = x.kelas
                  where h.user_id = (select auth.uid()) and (h.izin in ('admin','kepsek') or (h.izin = 'guru' and h.kelas = x.kelas) or (h.izin = 'gerbang' and (h.gedung is null or h.gedung = k.gedung))))
$$;
create or replace function privat.kode_baru() returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6)
$$;
revoke all on all functions in schema privat from public, anon;
grant execute on function privat.izin_hadir(text[]), privat.boleh_siswa(uuid) to authenticated;
revoke all on function privat.pengguna_baru() from authenticated;

alter table public.gedung enable row level security; alter table public.kelas enable row level security; alter table public.jadwal_hadir enable row level security;
alter table public.siswa enable row level security; alter table public.siswa_qr enable row level security; alter table public.petugas_hadir enable row level security;
alter table public.absensi enable row level security; alter table public.scan_log enable row level security; alter table public.notifikasi enable row level security;
create policy induk_lihat on public.gedung for select to authenticated using (true);
create policy induk_lihat on public.kelas for select to authenticated using (true);
create policy induk_lihat on public.jadwal_hadir for select to authenticated using (true);
create policy siswa_lihat on public.siswa for select to authenticated using (ortu = (select auth.uid()) or (select privat.boleh_siswa(id)));
create policy qr_lihat on public.siswa_qr for select to authenticated using (exists (select 1 from public.siswa s where s.id = siswa_id and s.ortu = (select auth.uid())));
create policy petugas_lihat on public.petugas_hadir for select to authenticated using (user_id = (select auth.uid()) or (select privat.punya_peran('superadmin')));
create policy absensi_lihat on public.absensi for select to authenticated
  using (exists (select 1 from public.siswa s where s.id = siswa_id and (s.ortu = (select auth.uid()) or (select privat.boleh_siswa(s.id)))));
create policy scan_lihat on public.scan_log for select to authenticated using ((select privat.izin_hadir('admin','kepsek')));
create policy notif_lihat on public.notifikasi for select to authenticated using (user_id = (select auth.uid()));
create policy notif_baca on public.notifikasi for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.gedung, public.kelas, public.jadwal_hadir, public.siswa, public.siswa_qr, public.petugas_hadir, public.absensi, public.scan_log, public.notifikasi from anon;
revoke insert, update, delete on public.gedung, public.kelas, public.jadwal_hadir, public.siswa, public.siswa_qr, public.petugas_hadir, public.absensi, public.scan_log from authenticated;
revoke insert, delete on public.notifikasi from authenticated;

-- catat scan kedatangan. Selalu mengembalikan jawaban (tidak melempar galat) agar jejak scan tersimpan.
create or replace function public.catat_scan(p_kode text, p_kunci uuid, p_perangkat text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); lama public.scan_log; s public.siswa; q public.siswa_qr; k public.kelas; t public.tingkat; j public.jadwal_hadir;
  kini timestamptz := now(); lokal timestamp := (now() at time zone 'Asia/Makassar'); hari date; st text; a public.absensi; ada public.absensi; b jsonb; kode_ text := upper(btrim(coalesce(p_kode, '')));
begin
  if u is null or not privat.izin_hadir('guru','gerbang','admin') then raise exception 'Anda tidak punya izin untuk memindai.' using errcode = '42501'; end if;
  if p_kunci is null then raise exception 'Kunci kejadian wajib ada.'; end if;
  select * into lama from public.scan_log where id = p_kunci; if found then return lama.balasan; end if;
  hari := lokal::date;
  if kode_ like 'MV1:%' then kode_ := substr(kode_, 5); end if;
  select * into q from public.siswa_qr where kode = kode_ or token::text = lower(kode_);
  if not found then b := jsonb_build_object('ok', false, 'hasil', 'ditolak', 'pesan', 'Kode QR tidak dikenal atau sudah diganti.');
    insert into public.scan_log (id, perangkat, oleh, hasil, alasan, balasan) values (p_kunci, p_perangkat, u, 'ditolak', b ->> 'pesan', b); return b; end if;
  select * into s from public.siswa where id = q.siswa_id; select * into k from public.kelas where id = s.kelas; select * into t from public.tingkat where id = k.tingkat;
  if q.berlaku_sampai < hari then b := jsonb_build_object('ok', false, 'hasil', 'ditolak', 'pesan', 'Kode QR sudah kedaluwarsa. Minta orang tua memperbarui kode.');
  elsif not s.aktif then b := jsonb_build_object('ok', false, 'hasil', 'ditolak', 'pesan', 'Siswa ini tidak aktif.');
  elsif not privat.boleh_siswa(s.id) then b := jsonb_build_object('ok', false, 'hasil', 'ditolak', 'pesan', s.panggilan || ' terdaftar di ' || (select nama from public.gedung where id = k.gedung) || ', bukan wilayah tugas Anda.');
  end if;
  if b is not null then insert into public.scan_log (id, perangkat, oleh, siswa_id, hasil, alasan, balasan) values (p_kunci, p_perangkat, u, s.id, 'ditolak', b ->> 'pesan', b); return b; end if;
  select * into j from public.jadwal_hadir where jenjang = t.jenjang;
  st := case when j.telat is not null and lokal::time > j.telat then 'terlambat' else 'hadir' end;
  insert into public.absensi (siswa_id, tgl, jenis, at, status, metode, perangkat, oleh) values (s.id, hari, 'datang', kini, st, 'qr', p_perangkat, u)
    on conflict (siswa_id, tgl, jenis) do nothing returning * into a;
  if a.id is null then
    select * into ada from public.absensi where siswa_id = s.id and tgl = hari and jenis = 'datang';
    b := jsonb_build_object('ok', false, 'hasil', 'duplikat', 'nama', s.panggilan, 'pesan', s.panggilan || ' sudah tercatat pukul ' || to_char(ada.at at time zone 'Asia/Makassar', 'HH24:MI') || '.');
    insert into public.scan_log (id, perangkat, oleh, siswa_id, hasil, alasan, balasan) values (p_kunci, p_perangkat, u, s.id, 'duplikat', b ->> 'pesan', b); return b;
  end if;
  b := jsonb_build_object('ok', true, 'hasil', 'diterima', 'nama', s.panggilan, 'status', st, 'jam', to_char(lokal, 'HH24:MI'));
  insert into public.scan_log (id, perangkat, oleh, siswa_id, hasil, balasan) values (p_kunci, p_perangkat, u, s.id, 'diterima', b);
  if s.ortu is not null then insert into public.notifikasi (user_id, teks) values (s.ortu, s.nama || case st when 'hadir' then ' sudah tiba di sekolah pukul ' else ' tiba terlambat pukul ' end || to_char(lokal, 'HH24:MI') || '.'); end if;
  return b;
end $$;

create or replace function public.koreksi_absensi(p_siswa uuid, p_tgl date, p_status text, p_alasan text) returns public.absensi
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); s public.siswa; a public.absensi; lama text;
begin
  if u is null or not privat.izin_hadir('guru','admin') then raise exception 'Anda tidak punya izin untuk mengoreksi absensi.' using errcode = '42501'; end if;
  select * into s from public.siswa where id = p_siswa;
  if not found or not privat.boleh_siswa(p_siswa) or (not privat.izin_hadir('admin') and not exists (select 1 from public.petugas_hadir h where h.user_id = u and h.izin = 'guru' and h.kelas = s.kelas)) then
    raise exception 'Anda hanya dapat mengoreksi absensi kelas Anda.' using errcode = '42501'; end if;
  if s.ortu = u then raise exception 'Ini anak Anda sendiri. Minta petugas lain yang mengoreksinya.' using errcode = '42501'; end if;
  if p_status not in ('hadir','terlambat','izin','sakit','alpa') then raise exception 'Pilih status yang benar.'; end if;
  if btrim(coalesce(p_alasan, '')) = '' then raise exception 'Alasan koreksi wajib diisi.'; end if;
  if p_tgl is null or p_tgl > (now() at time zone 'Asia/Makassar')::date then raise exception 'Tanggal belum terjadi.'; end if;
  select status into lama from public.absensi where siswa_id = p_siswa and tgl = p_tgl and jenis = 'datang';
  insert into public.absensi (siswa_id, tgl, jenis, status, metode, oleh, catatan) values (p_siswa, p_tgl, 'datang', p_status, 'koreksi', u, p_alasan)
    on conflict (siswa_id, tgl, jenis) do update set status = excluded.status, metode = 'koreksi', oleh = u, catatan = excluded.catatan returning * into a;
  insert into public.audit_log (oleh, aksi, ket) values (u, 'Absensi dikoreksi', s.nama || ' ' || p_tgl || ': ' || coalesce(lama, 'belum ada') || ' menjadi ' || p_status || ' · ' || p_alasan);
  return a;
end $$;

create or replace function public.ganti_qr(p_siswa uuid) returns public.siswa_qr
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); q public.siswa_qr;
begin
  if not exists (select 1 from public.siswa where id = p_siswa and ortu = u) then raise exception 'Hanya orang tua siswa ini yang dapat mengganti kode.' using errcode = '42501'; end if;
  update public.siswa_qr set token = gen_random_uuid(), kode = privat.kode_baru(), berlaku_sampai = (now() at time zone 'Asia/Makassar')::date + 30 where siswa_id = p_siswa returning * into q;
  insert into public.audit_log (oleh, aksi, ket) values (u, 'Kode QR diganti', p_siswa::text);
  return q;
end $$;

-- cari akun dari email atau kode akun (8 huruf pertama id), dipakai superadmin dan admin sekolah
create or replace function privat.cari_akun(p text) returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.profil where (position('@' in p) > 0 and lower(email) = lower(btrim(p))) or (position('@' in p) = 0 and length(btrim(p)) >= 8 and id::text like lower(btrim(p)) || '%') limit 2
$$;
revoke all on function privat.cari_akun(text), privat.kode_baru() from public, anon, authenticated;

create or replace function public.hubungkan_ortu(p_siswa uuid, p_akun text) returns public.siswa
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); t uuid; s public.siswa; n int;
begin
  if u is null or not privat.izin_hadir('admin') then raise exception 'Hanya Admin Sekolah atau Superadmin yang dapat menghubungkan orang tua.' using errcode = '42501'; end if;
  if btrim(coalesce(p_akun, '')) = '' then update public.siswa set ortu = null where id = p_siswa returning * into s;
  else
    select count(*) into n from public.profil where (position('@' in p_akun) > 0 and lower(email) = lower(btrim(p_akun))) or (position('@' in p_akun) = 0 and length(btrim(p_akun)) >= 8 and id::text like lower(btrim(p_akun)) || '%');
    if n <> 1 then raise exception 'Akun tidak ditemukan. Minta orang tua masuk dulu, lalu pakai email atau kode akunnya.'; end if;
    t := privat.cari_akun(p_akun); update public.siswa set ortu = t where id = p_siswa returning * into s;
  end if;
  if s.id is null then raise exception 'Siswa tidak ditemukan.'; end if;
  insert into public.audit_log (oleh, aksi, ket) values (u, 'Orang tua siswa diatur', s.nama);
  return s;
end $$;

create or replace function public.atur_petugas(p_akun text, p_izin text, p_kelas text default null, p_gedung text default null, p_hapus boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); t uuid;
begin
  if u is null or not privat.punya_peran('superadmin') then raise exception 'Hanya Superadmin yang dapat mengatur petugas.' using errcode = '42501'; end if;
  if p_izin not in ('guru','gerbang','admin','kepsek') then raise exception 'Pilih peran petugas.'; end if;
  t := privat.cari_akun(p_akun); if t is null then raise exception 'Akun tidak ditemukan. Minta orang itu masuk dulu, lalu pakai email atau kode akunnya.'; end if;
  if p_hapus then delete from public.petugas_hadir where user_id = t and izin = p_izin;
  else
    if p_izin = 'guru' and p_kelas is null then raise exception 'Pilih kelas untuk guru.'; end if;
    insert into public.peran_pengguna (user_id, peran) values (t, 'pegawai') on conflict do nothing;
    insert into public.petugas_hadir (user_id, izin, kelas, gedung) values (t, p_izin, case when p_izin = 'guru' then p_kelas end, case when p_izin = 'gerbang' then p_gedung end)
      on conflict (user_id, izin) do update set kelas = excluded.kelas, gedung = excluded.gedung;
  end if;
  insert into public.audit_log (oleh, aksi, ket) values (u, case when p_hapus then 'Petugas dicabut' else 'Petugas diatur' end, p_izin || ' · ' || t::text);
end $$;
revoke all on function public.catat_scan(text, uuid, text), public.koreksi_absensi(uuid, date, text, text), public.ganti_qr(uuid), public.hubungkan_ortu(uuid, text), public.atur_petugas(text, text, text, text, boolean) from public, anon;
grant execute on function public.catat_scan(text, uuid, text), public.koreksi_absensi(uuid, date, text, text), public.ganti_qr(uuid), public.hubungkan_ortu(uuid, text), public.atur_petugas(text, text, text, text, boolean) to authenticated;

-- data CONTOH
insert into public.gedung values ('A','Gedung A'),('B','Gedung B');
insert into public.kelas values ('tka-a','TK A','tka','A'),('sd1-a','SD 1A','sd1','B'),('smp7-a','SMP 7A','smp7','B');
insert into public.jadwal_hadir values ('KB','08:00','08:15','11:00'),('TK','08:00','08:15','11:30'),('SD','07:15','07:30','13:30'),('SMP','07:15','07:30','14:30');
insert into public.siswa (nama, panggilan, kelas, contoh) values
 ('Khadijah Rahmani (contoh)','Khadijah','sd1-a',true),('Bilal Arifin (contoh)','Bilal','sd1-a',true),('Zaid Maulana (contoh)','Zaid','sd1-a',true),('Maryam Salsabila (contoh)','Maryam','sd1-a',true),
 ('Yusuf Rahmani (contoh)','Yusuf','tka-a',true),('Fatimah Azzahra (contoh)','Fatimah','tka-a',true),('Hana Hadiyani (contoh)','Hana','smp7-a',true),('Ibrahim Khalil (contoh)','Ibrahim','smp7-a',true);
insert into public.siswa_qr (siswa_id, kode, berlaku_sampai) select id, privat.kode_baru(), (now() at time zone 'Asia/Makassar')::date + 30 from public.siswa;
