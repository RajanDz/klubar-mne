-- Add fee, days, and time columns to groups table.
-- These were referenced in the frontend but never created in the schema.

alter table public.groups
  add column if not exists fee  numeric(10, 2),
  add column if not exists days integer[]  default '{}',
  add column if not exists time text;
