-- Replace single time field with per-day times stored as JSONB.
-- Keys are day numbers (1=Mon...7=Sun), values are "HH:MM" strings.
-- e.g. {"1": "18:00", "3": "17:30", "5": "18:00"}

alter table public.groups
  add column if not exists day_times jsonb default '{}';
