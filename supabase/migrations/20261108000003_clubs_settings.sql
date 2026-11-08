-- Postavke kluba: sport, logo, tema
alter table public.clubs
  add column if not exists sport    text,
  add column if not exists logo_url text,
  add column if not exists theme    jsonb;
