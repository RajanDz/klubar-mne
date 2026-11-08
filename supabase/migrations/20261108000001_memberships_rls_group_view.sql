-- ============================================================
-- MIGRACIJA 008: Popravka RLS za memberships — trener vidi
-- sve uplate u svojim grupama, ne samo vlastite.
-- Datum: 2026-11-08
-- ============================================================
-- Problem: vlasnik upisuje uplatu sa coach_id = NULL.
-- Trener ima RLS koji dozvoljava pregled samo gdje je
-- coach_id = get_my_coach_id(), pa ne vidi vlasnikove uplate
-- i isti red mu prikazuje "nije plaćeno".
--
-- Rješenje: trener smije VIDJETI sve uplate u grupama kojima
-- je dodijeljen (read), ali smije PISATI samo vlastite uplate.
-- ============================================================

drop policy "memberships: pregled" on public.memberships;

create policy "memberships: pregled"
  on public.memberships for select
  using (
    club_id = get_my_club_id()
    and (
      not is_trener()
      or coach_id = get_my_coach_id()
      or (
        group_id is not null
        and exists (
          select 1 from public.coach_groups cg
          where cg.group_id = memberships.group_id
            and cg.coach_id = get_my_coach_id()
        )
      )
    )
  );
