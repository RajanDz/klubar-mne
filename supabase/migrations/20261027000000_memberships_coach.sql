-- ============================================================
-- MIGRACIJA 005: coach_id i group_id u memberships + RLS za trenere
-- Datum: 2026-10-27
-- ============================================================
-- Izmjene:
--
-- 1. memberships dobija coach_id (ko je naplatio) i group_id
--    (za koju grupu je evidencija), oboje nullable da se ne pokvari
--    eventualna postojeća data.
--
-- 2. RLS na memberships se mijenja:
--    - Trener vidi/piše SAMO redove gdje je coach_id = njegov coach_id
--    - Owner/coordinator imaju pun pristup
-- ============================================================


-- ============================================================
-- 1. Nove kolone
-- ============================================================

alter table public.memberships
  add column coach_id uuid references public.coaches(id) on delete set null,
  add column group_id uuid references public.groups(id)  on delete set null;

create index on public.memberships(coach_id);
create index on public.memberships(group_id);


-- ============================================================
-- 2. RLS — ažuriranje svih politika za memberships
-- ============================================================

drop policy "memberships: pregled"   on public.memberships;
drop policy "memberships: dodavanje" on public.memberships;
drop policy "memberships: izmjena"   on public.memberships;
drop policy "memberships: brisanje"  on public.memberships;

-- Trener vidi samo vlastite redove (coach_id = njegov).
-- Owner/coordinator vide sve u svom klubu.
create policy "memberships: pregled"
  on public.memberships for select
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or coach_id = get_my_coach_id()
    )
  );

-- Trener može dodati samo pod svojim coach_id.
create policy "memberships: dodavanje"
  on public.memberships for insert
  with check (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or coach_id = get_my_coach_id()
    )
  );

-- Trener može mijenjati samo vlastite redove i ne može promijeniti coach_id.
create policy "memberships: izmjena"
  on public.memberships for update
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or coach_id = get_my_coach_id()
    )
  )
  with check (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or coach_id = get_my_coach_id()
    )
  );

create policy "memberships: brisanje"
  on public.memberships for delete
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or coach_id = get_my_coach_id()
    )
  );
