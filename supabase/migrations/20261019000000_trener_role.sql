-- ============================================================
-- MIGRACIJA 003: Trener rola — korisnički nalog za trenere
-- Datum: 2026-10-19
-- ============================================================
-- Izmjene:
--
-- 1. users.role — dodaje se 'trener' u dozvoljene vrijednosti.
--
-- 2. users.coach_id — nova nullable kolona koja povezuje
--    korisnički nalog (role='trener') sa zapisom u coaches tabeli.
--
-- 3. get_my_coach_id() — helper funkcija za RLS,
--    vraća coach_id prijavljenog korisnika.
--
-- 4. create_trener_account() — SECURITY DEFINER funkcija
--    koju owner poziva da kreira trener nalog.
--    Tok: trener se registruje u Supabase Auth → owner poziva
--    ovu funkciju sa auth UUID trenera i odgovarajućim coach_id.
-- ============================================================


-- ============================================================
-- 1. Dodati 'trener' u dozvoljene uloge
-- ============================================================

alter table public.users
  drop constraint users_role_check;

alter table public.users
  add constraint users_role_check
    check (role in ('owner', 'coordinator', 'trener'));


-- ============================================================
-- 2. Dodati coach_id kolonu na users
-- ============================================================

alter table public.users
  add column coach_id uuid references public.coaches(id) on delete set null;

create index on public.users(coach_id);


-- ============================================================
-- 3. Helper funkcija: get_my_coach_id()
-- Vraća coach_id trenutno prijavljenog korisnika.
-- SECURITY DEFINER da zaobiđe RLS na users tabeli.
-- ============================================================

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


-- ============================================================
-- 4. Funkcija: create_trener_account()
-- Owner poziva ovu funkciju NAKON što se trener registruje
-- u Supabase Auth (dobije auth.uid()).
--
-- Parametri:
--   p_auth_user_id — UUID iz Supabase Auth (auth.uid() trenera)
--   p_coach_id     — UUID iz coaches tabele
--   p_email        — email adresa trenera
--   p_full_name    — puno ime trenera
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
  -- Samo owner može kreirati trener nalog
  if not is_club_owner() then
    raise exception 'Samo vlasnik kluba može kreirati trener nalog.';
  end if;

  v_club_id := get_my_club_id();

  -- Coach mora biti iz istog kluba
  if not exists (
    select 1 from public.coaches
    where id = p_coach_id and club_id = v_club_id
  ) then
    raise exception 'Odabrani trener ne pripada vašem klubu.';
  end if;

  -- Auth korisnik još ne smije imati nalog
  if exists (select 1 from public.users where id = p_auth_user_id) then
    raise exception 'Korisnik je već registrovan u sistemu.';
  end if;

  -- Coach ne smije već imati nalog
  if exists (select 1 from public.users where coach_id = p_coach_id) then
    raise exception 'Ovaj trener već ima korisnički nalog.';
  end if;

  insert into public.users (id, club_id, full_name, email, role, coach_id)
  values (p_auth_user_id, v_club_id, trim(p_full_name), trim(p_email), 'trener', p_coach_id);
end;
$$;

revoke execute on function public.create_trener_account(uuid, uuid, text, text) from public, anon;
grant  execute on function public.create_trener_account(uuid, uuid, text, text) to authenticated;
