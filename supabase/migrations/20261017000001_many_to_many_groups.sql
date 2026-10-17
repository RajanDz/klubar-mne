-- ============================================================
-- MIGRACIJA 002: Many-to-many veze za grupe
-- ============================================================
-- Izmjene u odnosu na migraciju 001:
--
-- 1. children — uklanja se group_id kolona i FK constraint.
--    Dijete sada može biti u više grupa.
--
-- 2. Nova tabela children_groups — junction tabela koja
--    povezuje dijete sa jednom ili više grupa.
--
-- 3. coaches — dodaje se UNIQUE(club_id, id) koji je
--    potreban za composite FK iz coach_groups.
--
-- 4. Nova tabela coach_groups — junction tabela koja
--    povezuje trenera sa jednom ili više grupa.
-- ============================================================


-- ============================================================
-- 1. IZMJENE NA TABELI children
-- ============================================================

-- Ukloniti composite FK constraint koji je vezan za group_id
alter table public.children
  drop constraint fk_child_group_same_club;

-- Ukloniti group_id kolonu
alter table public.children
  drop column group_id;


-- ============================================================
-- 2. JUNCTION TABELA: children_groups
-- Dijete može biti u više grupa, grupa može imati više djece.
-- club_id je prisutan u junction tabeli da bi composite FK-ovi
-- mogli osigurati da dijete i grupa uvijek budu iz istog kluba.
-- ============================================================

create table public.children_groups (
  club_id  uuid not null,
  child_id uuid not null,
  group_id uuid not null,

  primary key (child_id, group_id),

  -- Dijete mora biti iz istog kluba
  constraint fk_cg_child_same_club
    foreign key (club_id, child_id)
    references public.children(club_id, id)
    on delete cascade,

  -- Grupa mora biti iz istog kluba
  constraint fk_cg_group_same_club
    foreign key (club_id, group_id)
    references public.groups(club_id, id)
    on delete cascade
);


-- ============================================================
-- 3. IZMJENE NA TABELI coaches
-- Dodati unique(club_id, id) koji je potreban da bi
-- coach_groups mogla koristiti composite FK.
-- ============================================================

alter table public.coaches
  add constraint coaches_club_id_id_unique unique (club_id, id);


-- ============================================================
-- 4. JUNCTION TABELA: coach_groups
-- Trener može biti dodijeljen više grupa, grupa može imati
-- više trenera.
-- ============================================================

create table public.coach_groups (
  club_id  uuid not null,
  coach_id uuid not null,
  group_id uuid not null,

  primary key (coach_id, group_id),

  -- Trener mora biti iz istog kluba
  constraint fk_cog_coach_same_club
    foreign key (club_id, coach_id)
    references public.coaches(club_id, id)
    on delete cascade,

  -- Grupa mora biti iz istog kluba
  constraint fk_cog_group_same_club
    foreign key (club_id, group_id)
    references public.groups(club_id, id)
    on delete cascade
);


-- ============================================================
-- 5. INDEKSI za nove tabele
-- ============================================================

create index on public.children_groups(club_id);
create index on public.children_groups(child_id);
create index on public.children_groups(group_id);

create index on public.coach_groups(club_id);
create index on public.coach_groups(coach_id);
create index on public.coach_groups(group_id);


-- ============================================================
-- 6. RLS za nove tabele
-- ============================================================

alter table public.children_groups enable row level security;
alter table public.coach_groups     enable row level security;

-- children_groups: korisnik vidi/mijenja samo veze svog kluba
create policy "children_groups: pregled"
  on public.children_groups for select
  using (club_id = get_my_club_id());

create policy "children_groups: dodavanje"
  on public.children_groups for insert
  with check (club_id = get_my_club_id());

create policy "children_groups: brisanje"
  on public.children_groups for delete
  using (club_id = get_my_club_id());

-- coach_groups: korisnik vidi/mijenja samo veze svog kluba
create policy "coach_groups: pregled"
  on public.coach_groups for select
  using (club_id = get_my_club_id());

create policy "coach_groups: dodavanje"
  on public.coach_groups for insert
  with check (club_id = get_my_club_id());

create policy "coach_groups: brisanje"
  on public.coach_groups for delete
  using (club_id = get_my_club_id());
