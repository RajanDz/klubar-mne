-- ============================================================
-- MIGRACIJA 001: Inicijalna šema baze podataka
-- Aplikacija: Klubar MNE
-- Datum: 2026-10-17
-- ============================================================
-- Ovaj fajl kreira sve tabele, relacije, indekse,
-- RLS politike i sigurnosne funkcije.
-- Izvršiti u Supabase SQL Editoru.
-- ============================================================


-- ============================================================
-- 1. TABELE
-- Tabele se kreiraju redom od kojih ne zavise → ka onima koje zavise.
-- ============================================================

-- Sportski klubovi — osnovni entitet sistema
create table public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Korisnici koji se mogu prijaviti u aplikaciju (vlasnici i koordinatori)
-- VAŽNO: id mora biti jednak auth.users.id iz Supabase Auth sistema.
-- Jedan korisnik može biti u tačno jednom klubu.
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  club_id    uuid not null references public.clubs(id) on delete cascade,
  full_name  text not null,
  email      text not null,
  role       text not null check (role in ('owner', 'coordinator')),
  created_at timestamptz not null default now()
);

-- Grupe i selekcije unutar kluba
-- unique(club_id, id) je potreban da bi children i attendance mogli
-- koristiti složeni strani ključ koji osigurava da grupa i dijete
-- uvijek pripadaju istom klubu.
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),

  unique (club_id, id)
);

-- Djeca — članovi kluba
-- unique(club_id, id) je potreban za složene strane ključeve iz attendance i memberships.
-- Složeni strani ključ na (club_id, group_id) garantuje da dijete ne može biti
-- dodijeljeno grupi iz drugog kluba.
create table public.children (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  group_id      uuid not null,
  full_name     text not null,
  date_of_birth date,
  parent_name   text,
  parent_phone  text,
  created_at    timestamptz not null default now(),

  unique (club_id, id),

  -- Ovo je ključna zaštita: grupi mora biti isti club_id kao djetetu.
  -- Bez ovoga, dijete bi moglo biti dodijeljeno grupi drugog kluba.
  constraint fk_child_group_same_club
    foreign key (club_id, group_id)
    references public.groups(club_id, id)
    on delete restrict
);

-- Evidencija dolazaka na treninge
-- Složeni strani ključevi osiguravaju da su dijete i grupa
-- uvijek iz istog kluba kao i evidencija.
create table public.attendance (
  id       uuid primary key default gen_random_uuid(),
  club_id  uuid not null references public.clubs(id) on delete cascade,
  child_id uuid not null,
  group_id uuid not null,
  date     date not null,
  status   text not null check (status in ('present', 'absent', 'excused')),
  note     text,

  -- Jedno dijete ne može imati dvije evidencije za isti datum u istoj grupi
  unique (child_id, group_id, date),

  -- Dijete mora biti iz istog kluba kao evidencija
  constraint fk_attendance_child_same_club
    foreign key (club_id, child_id)
    references public.children(club_id, id)
    on delete cascade,

  -- Grupa mora biti iz istog kluba kao evidencija
  constraint fk_attendance_group_same_club
    foreign key (club_id, group_id)
    references public.groups(club_id, id)
    on delete restrict
);

-- Evidencija članarina
-- period je DATE koji uvijek predstavlja prvi dan u mjesecu
-- (npr. 2026-10-01 znači "oktobar 2026").
-- NUMERIC(10, 2) korišten umjesto FLOAT jer float nije precizan za novac.
-- Složeni strani ključ osigurava da dijete i članarina uvijek budu u istom klubu.
create table public.memberships (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  child_id     uuid not null,
  amount       numeric(10, 2) not null check (amount >= 0),
  period       date not null,
  status       text not null default 'unpaid' check (status in ('paid', 'unpaid', 'partially_paid')),
  payment_date date,
  note         text,

  -- Dijete mora biti iz istog kluba kao i evidencija članarine
  constraint fk_membership_child_same_club
    foreign key (club_id, child_id)
    references public.children(club_id, id)
    on delete cascade
);

-- Treneri kluba
-- Treneri trenutno NEMAJU korisnički nalog niti pristup aplikaciji.
-- Ne referenciraju auth.users niti public.users.
create table public.coaches (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  full_name  text not null,
  phone      text,
  email      text,
  created_at timestamptz not null default now()
);

-- Postavke kluba
-- Svaki klub ima tačno jedan red u ovoj tabeli (unique na club_id).
-- Kreira se automatski pri registraciji kluba.
create table public.settings (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null unique references public.clubs(id) on delete cascade,
  club_name text not null,
  phone     text,
  email     text,
  address   text
);


-- ============================================================
-- 2. INDEKSI
-- Poboljšavaju performanse upita koji filtriraju po club_id,
-- child_id, group_id i datumu.
-- ============================================================

create index on public.users(club_id);
create index on public.groups(club_id);
create index on public.children(club_id);
create index on public.children(group_id);
create index on public.attendance(club_id);
create index on public.attendance(child_id);
create index on public.attendance(date);
create index on public.memberships(club_id);
create index on public.memberships(child_id);
create index on public.memberships(period);
create index on public.coaches(club_id);


-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- RLS osigurava da korisnik može vidjeti i mijenjati
-- isključivo podatke svog kluba, čak i pri direktnim API pozivima.
-- ============================================================

alter table public.clubs       enable row level security;
alter table public.users       enable row level security;
alter table public.groups      enable row level security;
alter table public.children    enable row level security;
alter table public.attendance  enable row level security;
alter table public.memberships enable row level security;
alter table public.coaches     enable row level security;
alter table public.settings    enable row level security;


-- ============================================================
-- 4. HELPER FUNKCIJE ZA RLS
-- ============================================================

-- Vraća club_id trenutno prijavljenog korisnika.
-- SECURITY DEFINER: funkcija se izvršava sa privilegijama postgres korisnika
-- i tako zaobilazi RLS na users tabeli — bez toga bi nastala beskonačna rekurzija
-- (RLS na users poziva funkciju koja čita users).
-- SET search_path = public: zaštita od search_path injection napada.
create or replace function public.get_my_club_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select club_id from public.users where id = auth.uid()
$$;

-- Vraća true ako je prijavljeni korisnik vlasnik svog kluba.
create or replace function public.is_club_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'owner'
  )
$$;

-- Helper funkcije moraju biti dostupne autentifikovanim korisnicima
-- jer ih RLS politike pozivaju pri svakom upitu.
grant execute on function public.get_my_club_id() to authenticated;
grant execute on function public.is_club_owner()  to authenticated;


-- ============================================================
-- 5. RLS POLITIKE
-- USING    → filtrira koje redove korisnik može vidjeti / mijenjati
-- WITH CHECK → ograničava šta smije biti u novom / izmijenjenom redu
-- ============================================================

-- ---- clubs ------------------------------------------------
-- Korisnik može vidjeti samo klub u kom je registrovan.
-- Nema INSERT/UPDATE/DELETE politike: klijent ne može direktno
-- kreirati niti brisati klubove — to radi samo register_club() funkcija.
create policy "clubs: pregled"
  on public.clubs for select
  using (id = get_my_club_id());

-- ---- users ------------------------------------------------
-- Korisnik vidi ostale korisnike svog kluba.
create policy "users: pregled"
  on public.users for select
  using (club_id = get_my_club_id());

-- Korisnik može ažurirati samo vlastiti red.
-- WITH CHECK osigurava da novi red mora imati isti club_id.
-- Promjena role je blokirana triggerom ispod (dvostruka zaštita).
create policy "users: izmjena vlastitog profila"
  on public.users for update
  using    (id = auth.uid())
  with check (
    id      = auth.uid()
    and club_id = get_my_club_id()
  );

-- ---- groups -----------------------------------------------
create policy "groups: pregled"
  on public.groups for select
  using (club_id = get_my_club_id());

create policy "groups: dodavanje"
  on public.groups for insert
  with check (club_id = get_my_club_id());

create policy "groups: izmjena"
  on public.groups for update
  using     (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "groups: brisanje"
  on public.groups for delete
  using (club_id = get_my_club_id());

-- ---- children ---------------------------------------------
create policy "children: pregled"
  on public.children for select
  using (club_id = get_my_club_id());

create policy "children: dodavanje"
  on public.children for insert
  with check (club_id = get_my_club_id());

create policy "children: izmjena"
  on public.children for update
  using     (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "children: brisanje"
  on public.children for delete
  using (club_id = get_my_club_id());

-- ---- attendance -------------------------------------------
create policy "attendance: pregled"
  on public.attendance for select
  using (club_id = get_my_club_id());

create policy "attendance: dodavanje"
  on public.attendance for insert
  with check (club_id = get_my_club_id());

create policy "attendance: izmjena"
  on public.attendance for update
  using     (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "attendance: brisanje"
  on public.attendance for delete
  using (club_id = get_my_club_id());

-- ---- memberships ------------------------------------------
create policy "memberships: pregled"
  on public.memberships for select
  using (club_id = get_my_club_id());

create policy "memberships: dodavanje"
  on public.memberships for insert
  with check (club_id = get_my_club_id());

create policy "memberships: izmjena"
  on public.memberships for update
  using     (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "memberships: brisanje"
  on public.memberships for delete
  using (club_id = get_my_club_id());

-- ---- coaches ----------------------------------------------
create policy "coaches: pregled"
  on public.coaches for select
  using (club_id = get_my_club_id());

create policy "coaches: dodavanje"
  on public.coaches for insert
  with check (club_id = get_my_club_id());

create policy "coaches: izmjena"
  on public.coaches for update
  using     (club_id = get_my_club_id())
  with check (club_id = get_my_club_id());

create policy "coaches: brisanje"
  on public.coaches for delete
  using (club_id = get_my_club_id());

-- ---- settings ---------------------------------------------
-- Pregled: svaki korisnik kluba može vidjeti postavke.
-- Izmjena: samo vlasnik može mijenjati postavke kluba.
create policy "settings: pregled"
  on public.settings for select
  using (club_id = get_my_club_id());

create policy "settings: izmjena (samo vlasnik)"
  on public.settings for update
  using     (club_id = get_my_club_id() and is_club_owner())
  with check (club_id = get_my_club_id());


-- ============================================================
-- 6. TRIGGER: Zaštita od eskalacije privilegija
-- Sprečava da korisnik putem UPDATE operacije promijeni
-- vlastitu ulogu (role) ili klub (club_id).
-- Ovo je drugi sloj zaštite, pored RLS WITH CHECK.
-- ============================================================

create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id != old.id then
    raise exception 'Nije dozvoljeno mijenjati ID korisnika.';
  end if;

  if new.club_id != old.club_id then
    raise exception 'Nije dozvoljeno mijenjati klub korisnika.';
  end if;

  if new.role != old.role then
    raise exception 'Nije dozvoljeno mijenjati ulogu korisnika putem direktnog ažuriranja.';
  end if;

  return new;
end;
$$;

create trigger users_prevent_privilege_escalation
  before update on public.users
  for each row execute function public.prevent_privilege_escalation();


-- ============================================================
-- 7. FUNKCIJA: Registracija kluba i prvog vlasnika
-- ============================================================
-- Ova funkcija se poziva sa frontenda NAKON što se korisnik
-- registruje u Supabase Auth (dobije auth.uid()).
-- Kreira klub, upisuje korisnika kao vlasnika i kreira postavke.
--
-- Zašto SECURITY DEFINER?
-- Jer INSERT u clubs i users nije dozvoljen klijentu direktno putem RLS-a.
-- Funkcija se izvršava sa privilegijama postgres korisnika i zaobilazi RLS.
-- Na taj način klijent ne može kontrolisati koja se uloga dodjeljuje —
-- 'owner' je hardcoded unutar funkcije, a ne proslijeđen od klijenta.
-- ============================================================

create or replace function public.register_club(
  p_club_name   text,
  p_owner_name  text,
  p_owner_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_club_id uuid;
begin
  v_user_id := auth.uid();

  -- Korisnik mora biti prijavljen
  if v_user_id is null then
    raise exception 'Korisnik nije autentifikovan.';
  end if;

  -- Spriječiti registraciju ako je korisnik već u nekom klubu
  if exists (select 1 from public.users where id = v_user_id) then
    raise exception 'Korisnik je već registrovan u sistemu.';
  end if;

  -- Validacija ulaznih podataka
  if trim(p_club_name) = '' then
    raise exception 'Naziv kluba ne smije biti prazan.';
  end if;

  if trim(p_owner_name) = '' then
    raise exception 'Ime vlasnika ne smije biti prazno.';
  end if;

  -- Kreirati klub
  insert into public.clubs (name)
  values (trim(p_club_name))
  returning id into v_club_id;

  -- Kreirati vlasnika — uloga 'owner' je određena ovdje, ne od klijenta
  insert into public.users (id, club_id, full_name, email, role)
  values (v_user_id, v_club_id, trim(p_owner_name), trim(p_owner_email), 'owner');

  -- Kreirati inicijalne postavke za novi klub
  insert into public.settings (club_id, club_name)
  values (v_club_id, trim(p_club_name));

  return v_club_id;
end;
$$;

-- Samo autentifikovani korisnici mogu registrovati klub
revoke execute on function public.register_club(text, text, text) from public, anon;
grant  execute on function public.register_club(text, text, text) to authenticated;
