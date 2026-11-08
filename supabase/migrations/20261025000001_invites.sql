-- ============================================================
-- Invite system for trainers (treneri)
-- ============================================================

create table public.invites (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  club_id    uuid not null references public.clubs(id) on delete cascade,
  coach_id   uuid not null references public.coaches(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at    timestamptz
);

create index on public.invites(coach_id);
create index on public.invites(code) where used_at is null;

alter table public.invites enable row level security;

create policy "invites: pregled" on public.invites for select
  using (club_id = get_my_club_id() and not is_trener());


-- ============================================================
-- generate_invite: owner generates a 6-char code for a coach
-- ============================================================

create or replace function public.generate_invite(p_coach_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     text;
  v_exists   boolean;
begin
  if not is_club_owner() then
    raise exception 'Samo vlasnik kluba može generisati invite kodove.';
  end if;

  if not exists (
    select 1 from public.coaches
    where id = p_coach_id and club_id = get_my_club_id()
  ) then
    raise exception 'Trener ne pripada vašem klubu.';
  end if;

  if exists (
    select 1 from public.users where coach_id = p_coach_id
  ) then
    raise exception 'Trener već ima korisnički nalog.';
  end if;

  update public.invites
    set used_at = now()
  where coach_id = p_coach_id
    and used_at is null;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1);
    end loop;

    select exists(select 1 from public.invites where code = v_code) into v_exists;
    exit when not v_exists;
  end loop;

  insert into public.invites (code, club_id, coach_id)
  values (v_code, get_my_club_id(), p_coach_id);

  return v_code;
end;
$$;

grant execute on function public.generate_invite(uuid) to authenticated;


-- ============================================================
-- check_invite: validate a code and return coach/club info
-- ============================================================

create or replace function public.check_invite(p_code text)
returns table(coach_name text, club_name text)
language sql
security definer
stable
set search_path = public
as $$
  select c.full_name, cl.name
  from public.invites i
  join public.coaches c  on c.id  = i.coach_id
  join public.clubs   cl on cl.id = i.club_id
  where i.code      = upper(trim(p_code))
    and i.used_at   is null
    and i.expires_at > now();
$$;

grant execute on function public.check_invite(text) to anon, authenticated;


-- ============================================================
-- register_via_invite: link auth user to club via invite code
-- ============================================================

create or replace function public.register_via_invite(
  p_code      text,
  p_full_name text,
  p_email     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Morate biti prijavljeni da biste koristili invite kod.';
  end if;

  select * into v_invite
  from public.invites
  where code      = upper(trim(p_code))
    and used_at   is null
    and expires_at > now();

  if not found then
    raise exception 'Invite kod nije validan ili je istekao.';
  end if;

  if exists (select 1 from public.users where id = auth.uid()) then
    raise exception 'Vaš nalog je već registrovan.';
  end if;

  insert into public.users (id, club_id, full_name, email, role, coach_id)
  values (
    auth.uid(),
    v_invite.club_id,
    p_full_name,
    p_email,
    get_role_id('trener'),
    v_invite.coach_id
  );

  update public.invites
    set used_at = now()
  where id = v_invite.id;
end;
$$;

grant execute on function public.register_via_invite(text, text, text) to authenticated;
