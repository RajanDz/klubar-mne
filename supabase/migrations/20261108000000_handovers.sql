-- ============================================================
-- MIGRACIJA 007: Predaje novca + handover_id na memberships
-- Datum: 2026-11-08
-- ============================================================
-- Izmjene:
--
-- 1. clubs.fee — osnovna cijena kluba (nullable).
--    ADD COLUMN IF NOT EXISTS jer kolona može već postojati.
--
-- 2. clubs: izmjena — RLS politika, samo vlasnik može
--    ažurirati podatke kluba (npr. cijenu).
--
-- 3. memberships.handover_id — FK na handovers, nullable.
--    Ako je postavljeno, uplata je već u predaji i ne može
--    se poništiti niti mijenjati iznos.
--
-- 4. Nova tabela handovers — evidencija predaja novca.
--    Trener predaje novac vlasniku, vlasnik potvrđuje.
-- ============================================================


-- ============================================================
-- 1. clubs.fee
-- ============================================================

alter table public.clubs
  add column if not exists fee numeric(10, 2);


-- ============================================================
-- 2. clubs: izmjena (samo vlasnik)
-- Vlasnik može ažurirati podatke kluba, ne može mijenjati id.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'clubs'
      and policyname = 'clubs: izmjena (samo vlasnik)'
  ) then
    execute $policy$
      create policy "clubs: izmjena (samo vlasnik)"
        on public.clubs for update
        using     (id = get_my_club_id() and is_club_owner())
        with check (id = get_my_club_id())
    $policy$;
  end if;
end;
$$;


-- ============================================================
-- 3. handovers — tabela predaja
-- ============================================================

create table public.handovers (
  id           uuid        primary key default gen_random_uuid(),
  club_id      uuid        not null references public.clubs(id)   on delete cascade,
  coach_id     uuid        not null references public.coaches(id) on delete cascade,
  amount       numeric(10, 2) not null check (amount >= 0),
  status       text        not null default 'pending'
                           check (status in ('pending', 'confirmed')),
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  note         text
);

create index on public.handovers(club_id);
create index on public.handovers(coach_id);
create index on public.handovers(status);

alter table public.handovers enable row level security;

-- Trener vidi samo vlastite predaje; vlasnik/koordinator vide sve u klubu
create policy "handovers: pregled"
  on public.handovers for select
  using (
    club_id = get_my_club_id()
    and (not is_trener() or coach_id = get_my_coach_id())
  );

-- Trener može kreirati predaju samo pod vlastitim coach_id
create policy "handovers: dodavanje"
  on public.handovers for insert
  with check (
    club_id  = get_my_club_id()
    and (not is_trener() or coach_id = get_my_coach_id())
  );

-- Trener može ažurirati samo vlastite predaje (za povlačenje).
-- Vlasnik može ažurirati status (potvrda).
create policy "handovers: izmjena"
  on public.handovers for update
  using  (
    club_id = get_my_club_id()
    and (not is_trener() or coach_id = get_my_coach_id())
  )
  with check (club_id = get_my_club_id());

-- Trener može obrisati samo vlastite pending predaje.
-- Vlasnik može brisati sve.
create policy "handovers: brisanje"
  on public.handovers for delete
  using (
    club_id = get_my_club_id()
    and (not is_trener() or (coach_id = get_my_coach_id() and status = 'pending'))
  );


-- ============================================================
-- 4. memberships.handover_id
-- ============================================================

alter table public.memberships
  add column if not exists handover_id uuid
    references public.handovers(id) on delete set null;

create index if not exists memberships_handover_id_idx
  on public.memberships(handover_id);
