-- ============================================================
-- MIGRACIJA 004: Normalizacija rola + RLS izolacija trenera
-- Datum: 2026-10-25
-- ============================================================
-- Izmjene:
--
-- 1. Nova tabela roles (id integer, value text)
--    Rola je entitet, ne slobodan tekst sa CHECK constraintom.
--
-- 2. users.role text → users.role integer FK → roles.id
--    Postojeći redovi se konvertuju automatski.
--
-- 3. Nove helper funkcije:
--    get_role_id(text) → integer
--    is_trener()       → boolean
--    is_club_owner() se ažurira za integer poređenje.
--
-- 4. register_club() i create_trener_account() se ažuriraju.
--
-- 5. prevent_privilege_escalation trigger se rekreira.
--
-- 6. Sve RLS politike se repisuju sa izolacijom trenera:
--    - Trener vidi/mijenja SAMO svoje grupe, djecu i prisustvo.
--    - Trener ne može pisati u grupe, djecu, trenere, članarine.
-- ============================================================


-- ============================================================
-- 1. TABELA: roles
-- ============================================================

create table public.roles (
  id    integer primary key generated always as identity,
  value text    not null unique
);

-- Seed: redoslijed INSERT-a određuje id (1, 2, 3)
insert into public.roles (value) values
  ('owner'),
  ('coordinator'),
  ('trener');

alter table public.roles enable row level security;

-- Svi prijavljeni korisnici mogu čitati listu rola.
-- Nema INSERT/UPDATE/DELETE politike — direktan write nije dozvoljen klijentu.
create policy "roles: pregled"
  on public.roles for select
  to authenticated
  using (true);


-- ============================================================
-- 2. HELPER FUNKCIJA: get_role_id()
-- Vraća integer id za dati role value.
-- SECURITY DEFINER da bi radila unutar RLS politika.
-- ============================================================

create or replace function public.get_role_id(p_value text)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select id from public.roles where value = p_value
$$;

grant execute on function public.get_role_id(text) to authenticated;


-- ============================================================
-- 3. KONVERZIJA users.role: text → integer FK
-- ============================================================

-- 3a. Privremena integer kolona
alter table public.users add column role_new integer;

-- 3b. Popuniti na osnovu postojećih text vrijednosti
update public.users
set role_new = (
  select r.id from public.roles r where r.value = public.users.role
);

-- 3c. NOT NULL + FK constraint
alter table public.users
  alter column role_new set not null;

alter table public.users
  add constraint users_role_fk
    foreign key (role_new) references public.roles(id);

-- 3d. Ukloniti staru text kolonu (skupa sa users_role_check constraintom)
alter table public.users drop column role;

-- 3e. Preimenovati
alter table public.users rename column role_new to role;

-- 3f. Indeks za brže pretrage po roli (koristi se u is_club_owner, is_trener)
create index on public.users(role);


-- ============================================================
-- 4. HELPER FUNKCIJE ZA RLS
-- ============================================================

-- get_my_coach_id() — vraća coach_id prijavljenog korisnika (trener).
-- Definiše se ovdje jer migracija 003 možda nije bila pokrenuta.
-- create or replace je siguran i u slučaju da već postoji.

alter table public.users
  add column if not exists coach_id uuid references public.coaches(id) on delete set null;

create index if not exists users_coach_id_idx on public.users(coach_id);

create or replace function public.get_my_coach_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select coach_id from public.users where id = auth.uid()
$$;

grant execute on function public.get_my_coach_id() to authenticated;

-- is_club_owner() — sada uspoređuje integer ID umjesto stringa
create or replace function public.is_club_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id   = auth.uid()
      and role = get_role_id('owner')
  )
$$;

-- is_trener() — nova helper funkcija za RLS politike
create or replace function public.is_trener()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id   = auth.uid()
      and role = get_role_id('trener')
  )
$$;

grant execute on function public.is_trener() to authenticated;


-- ============================================================
-- 5. AŽURIRANJE: register_club()
-- Koristi get_role_id() umjesto hardcoded stringa 'owner'.
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

  if v_user_id is null then
    raise exception 'Korisnik nije autentifikovan.';
  end if;

  if exists (select 1 from public.users where id = v_user_id) then
    raise exception 'Korisnik je već registrovan u sistemu.';
  end if;

  if trim(p_club_name) = '' then
    raise exception 'Naziv kluba ne smije biti prazan.';
  end if;

  if trim(p_owner_name) = '' then
    raise exception 'Ime vlasnika ne smije biti prazno.';
  end if;

  insert into public.clubs (name)
  values (trim(p_club_name))
  returning id into v_club_id;

  insert into public.users (id, club_id, full_name, email, role)
  values (v_user_id, v_club_id, trim(p_owner_name), trim(p_owner_email), get_role_id('owner'));

  insert into public.settings (club_id, club_name)
  values (v_club_id, trim(p_club_name));

  return v_club_id;
end;
$$;

revoke execute on function public.register_club(text, text, text) from public, anon;
grant  execute on function public.register_club(text, text, text) to authenticated;


-- ============================================================
-- 6. AŽURIRANJE: create_trener_account()
-- Koristi get_role_id() umjesto hardcoded stringa 'trener'.
-- ============================================================

create or replace function public.create_trener_account(
  p_auth_user_id uuid,
  p_coach_id     uuid,
  p_email        text,
  p_full_name    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  if not is_club_owner() then
    raise exception 'Samo vlasnik kluba može kreirati trener nalog.';
  end if;

  v_club_id := get_my_club_id();

  if not exists (
    select 1 from public.coaches
    where id = p_coach_id and club_id = v_club_id
  ) then
    raise exception 'Odabrani trener ne pripada vašem klubu.';
  end if;

  if exists (select 1 from public.users where id = p_auth_user_id) then
    raise exception 'Korisnik je već registrovan u sistemu.';
  end if;

  if exists (select 1 from public.users where coach_id = p_coach_id) then
    raise exception 'Ovaj trener već ima korisnički nalog.';
  end if;

  insert into public.users (id, club_id, full_name, email, role, coach_id)
  values (p_auth_user_id, v_club_id, trim(p_full_name), trim(p_email), get_role_id('trener'), p_coach_id);
end;
$$;

revoke execute on function public.create_trener_account(uuid, uuid, text, text) from public, anon;
grant  execute on function public.create_trener_account(uuid, uuid, text, text) to authenticated;


-- ============================================================
-- 7. TRIGGER: prevent_privilege_escalation
-- Rekreirati zbog promjene tipa kolone role (text → integer).
-- Logika ostaje ista — new.role != old.role radi i za integer.
-- ============================================================

drop trigger users_prevent_privilege_escalation on public.users;
drop function public.prevent_privilege_escalation();

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
-- 8. RLS POLITIKE — izolacija trenera
--
-- Princip za svaku tabelu:
--   Owner / coordinator → pun pristup unutar svog kluba
--   Trener → čitanje ograničeno na vlastite grupe, pisanje samo na attendance
-- ============================================================


-- ---- groups -----------------------------------------------
-- Trener vidi SAMO grupe kojima je dodijeljen.
-- Trener ne može kreirati, mijenjati ni brisati grupe.

drop policy "groups: pregled"   on public.groups;
drop policy "groups: dodavanje" on public.groups;
drop policy "groups: izmjena"   on public.groups;
drop policy "groups: brisanje"  on public.groups;

create policy "groups: pregled"
  on public.groups for select
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or exists (
        select 1 from public.coach_groups cg
        where cg.group_id = groups.id
          and cg.coach_id = get_my_coach_id()
      )
    )
  );

create policy "groups: dodavanje"
  on public.groups for insert
  with check (club_id = get_my_club_id() and not is_trener());

create policy "groups: izmjena"
  on public.groups for update
  using     (club_id = get_my_club_id() and not is_trener())
  with check (club_id = get_my_club_id() and not is_trener());

create policy "groups: brisanje"
  on public.groups for delete
  using (club_id = get_my_club_id() and not is_trener());


-- ---- children ---------------------------------------------
-- Trener vidi SAMO djecu koja su u njegovim grupama.
-- Trener ne može kreirati, mijenjati ni brisati djecu.

drop policy "children: pregled"   on public.children;
drop policy "children: dodavanje" on public.children;
drop policy "children: izmjena"   on public.children;
drop policy "children: brisanje"  on public.children;

create policy "children: pregled"
  on public.children for select
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or exists (
        select 1
        from   public.children_groups  cg
        join   public.coach_groups     cog on cog.group_id = cg.group_id
        where  cg.child_id  = children.id
          and  cog.coach_id = get_my_coach_id()
      )
    )
  );

create policy "children: dodavanje"
  on public.children for insert
  with check (club_id = get_my_club_id() and not is_trener());

create policy "children: izmjena"
  on public.children for update
  using     (club_id = get_my_club_id() and not is_trener())
  with check (club_id = get_my_club_id() and not is_trener());

create policy "children: brisanje"
  on public.children for delete
  using (club_id = get_my_club_id() and not is_trener());


-- ---- children_groups --------------------------------------
-- Trener vidi SAMO veze za grupe kojima je dodijeljen.
-- Trener ne može dodavati ni uklanjati djecu iz grupa.

drop policy "children_groups: pregled"   on public.children_groups;
drop policy "children_groups: dodavanje" on public.children_groups;
drop policy "children_groups: brisanje"  on public.children_groups;

create policy "children_groups: pregled"
  on public.children_groups for select
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or exists (
        select 1 from public.coach_groups cg
        where cg.group_id = children_groups.group_id
          and cg.coach_id = get_my_coach_id()
      )
    )
  );

create policy "children_groups: dodavanje"
  on public.children_groups for insert
  with check (club_id = get_my_club_id() and not is_trener());

create policy "children_groups: brisanje"
  on public.children_groups for delete
  using (club_id = get_my_club_id() and not is_trener());


-- ---- coach_groups -----------------------------------------
-- Trener vidi SAMO vlastite dodjele (gdje je on coach_id).
-- Trener ne može mijenjati dodjele trenera grupama.

drop policy "coach_groups: pregled"   on public.coach_groups;
drop policy "coach_groups: dodavanje" on public.coach_groups;
drop policy "coach_groups: brisanje"  on public.coach_groups;

create policy "coach_groups: pregled"
  on public.coach_groups for select
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or coach_id = get_my_coach_id()
    )
  );

create policy "coach_groups: dodavanje"
  on public.coach_groups for insert
  with check (club_id = get_my_club_id() and not is_trener());

create policy "coach_groups: brisanje"
  on public.coach_groups for delete
  using (club_id = get_my_club_id() and not is_trener());


-- ---- attendance -------------------------------------------
-- Trener vidi i piše SAMO za grupe kojima je dodijeljen.
-- Owner/coordinator imaju pun pristup unutar kluba.

drop policy "attendance: pregled"   on public.attendance;
drop policy "attendance: dodavanje" on public.attendance;
drop policy "attendance: izmjena"   on public.attendance;
drop policy "attendance: brisanje"  on public.attendance;

create policy "attendance: pregled"
  on public.attendance for select
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or exists (
        select 1 from public.coach_groups cg
        where cg.group_id = attendance.group_id
          and cg.coach_id = get_my_coach_id()
      )
    )
  );

create policy "attendance: dodavanje"
  on public.attendance for insert
  with check (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or exists (
        select 1 from public.coach_groups cg
        where cg.group_id = attendance.group_id
          and cg.coach_id = get_my_coach_id()
      )
    )
  );

create policy "attendance: izmjena"
  on public.attendance for update
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or exists (
        select 1 from public.coach_groups cg
        where cg.group_id = attendance.group_id
          and cg.coach_id = get_my_coach_id()
      )
    )
  )
  with check (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or exists (
        select 1 from public.coach_groups cg
        where cg.group_id = attendance.group_id
          and cg.coach_id = get_my_coach_id()
      )
    )
  );

create policy "attendance: brisanje"
  on public.attendance for delete
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or exists (
        select 1 from public.coach_groups cg
        where cg.group_id = attendance.group_id
          and cg.coach_id = get_my_coach_id()
      )
    )
  );


-- ---- coaches -----------------------------------------------
-- Treneri mogu vidjeti ostale trenere kluba (informativno).
-- Treneri ne mogu kreirati, mijenjati ni brisati trenere.

drop policy "coaches: pregled"   on public.coaches;
drop policy "coaches: dodavanje" on public.coaches;
drop policy "coaches: izmjena"   on public.coaches;
drop policy "coaches: brisanje"  on public.coaches;

create policy "coaches: pregled"
  on public.coaches for select
  using (club_id = get_my_club_id());

create policy "coaches: dodavanje"
  on public.coaches for insert
  with check (club_id = get_my_club_id() and not is_trener());

create policy "coaches: izmjena"
  on public.coaches for update
  using     (club_id = get_my_club_id() and not is_trener())
  with check (club_id = get_my_club_id() and not is_trener());

create policy "coaches: brisanje"
  on public.coaches for delete
  using (club_id = get_my_club_id() and not is_trener());


-- ---- memberships ------------------------------------------
-- Treneri nemaju pristup članarinama.

drop policy "memberships: pregled"   on public.memberships;
drop policy "memberships: dodavanje" on public.memberships;
drop policy "memberships: izmjena"   on public.memberships;
drop policy "memberships: brisanje"  on public.memberships;

create policy "memberships: pregled"
  on public.memberships for select
  using (club_id = get_my_club_id() and not is_trener());

create policy "memberships: dodavanje"
  on public.memberships for insert
  with check (club_id = get_my_club_id() and not is_trener());

create policy "memberships: izmjena"
  on public.memberships for update
  using     (club_id = get_my_club_id() and not is_trener())
  with check (club_id = get_my_club_id() and not is_trener());

create policy "memberships: brisanje"
  on public.memberships for delete
  using (club_id = get_my_club_id() and not is_trener());
