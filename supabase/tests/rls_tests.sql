-- ============================================================
-- TESTOVI: RLS izolacija podataka i bezbjednost
-- ============================================================
-- Ove testove treba izvršiti ručno u Supabase SQL Editoru
-- pod različitim korisnicima (koristiti "Run as user" opciju
-- ili kreirati test korisnike u Authentication panelu).
--
-- NAPOMENA: Testovi nisu automatski izvršeni. Svaki test
-- treba ručno pokrenuti i provjeriti rezultat.
-- ============================================================


-- ============================================================
-- PRIPREMA: Kreiranje testnih podataka
-- Ovo izvršiti kao postgres (service role) u SQL Editoru.
-- ============================================================

-- Klub A i klub B su potpuno odvojeni tenanti.
-- U produkciji se klubovi kreiraju isključivo kroz register_club().
-- Ovdje ih kreiramo direktno radi testiranja.

insert into public.clubs (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'FK Test A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'FK Test B');

-- Grupe za svaki klub
insert into public.groups (id, club_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'Kadeti A'),
  ('bbbbbbbb-0000-0000-0000-000000000022', 'bbbbbbbb-0000-0000-0000-000000000002', 'Kadeti B');

-- Dijete u klubu A
insert into public.children (id, club_id, group_id, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000111', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000011', 'Marko Marković');

-- Dijete u klubu B
insert into public.children (id, club_id, group_id, full_name) values
  ('bbbbbbbb-0000-0000-0000-000000000222', 'bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000022', 'Nikola Nikolić');


-- ============================================================
-- TEST 1: Korisnik vidi samo podatke svog kluba
-- ============================================================
-- Kako testirati:
-- 1. Kreirati test korisnika A u Authentication panelu
-- 2. Dodati ga u public.users sa club_id kluba A
-- 3. U SQL Editoru koristiti "Run as user: <email korisnika A>"
-- 4. Izvršiti sljedeći upit — mora vratiti samo dijete iz kluba A

select id, full_name, club_id from public.children;

-- Očekivani rezultat: samo 'Marko Marković' iz kluba A
-- Neočekivani rezultat (propust): pojavljuje se 'Nikola Nikolić' iz kluba B


-- ============================================================
-- TEST 2: Korisnik ne može pročitati podatke drugog kluba
--         mijenjanjem ID-ja u upitu
-- ============================================================
-- Kao korisnik A, pokušati direktno dohvatiti dijete iz kluba B:

select * from public.children
where id = 'bbbbbbbb-0000-0000-0000-000000000222';

-- Očekivani rezultat: 0 redova (RLS blokira pristup)
-- Neočekivani rezultat (propust): vraća se dijete iz kluba B


-- ============================================================
-- TEST 3: Korisnik ne može INSERT-ovati podatak sa tuđim club_id
-- ============================================================
-- Kao korisnik A, pokušati dodati dijete u klub B:

insert into public.children (club_id, group_id, full_name)
values (
  'bbbbbbbb-0000-0000-0000-000000000002',  -- club_id kluba B
  'aaaaaaaa-0000-0000-0000-000000000011',  -- grupa kluba A
  'Pokušaj upada'
);

-- Očekivani rezultat: greška — RLS WITH CHECK odbija insert jer club_id != get_my_club_id()
-- Neočekivani rezultat (propust): dijete je kreirano u drugom klubu


-- ============================================================
-- TEST 4: Korisnik ne može povezati dijete sa grupom drugog kluba
-- ============================================================
-- Pokušaj kreiranja djeteta u klubu A ali sa grupom kluba B:

insert into public.children (club_id, group_id, full_name)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',  -- club_id kluba A (korisnikov)
  'bbbbbbbb-0000-0000-0000-000000000022',  -- group_id grupe kluba B
  'Pokušaj cross-club veze'
);

-- Očekivani rezultat: greška — composite FK fk_child_group_same_club odbija upit
-- jer (club_id, group_id) kombinacija ne postoji u groups tabeli


-- ============================================================
-- TEST 5: Korisnik ne može promijeniti vlastiti club_id
-- ============================================================
-- Kao korisnik A (user_id = auth.uid()), pokušati promijeniti klub:

update public.users
set club_id = 'bbbbbbbb-0000-0000-0000-000000000002'
where id = auth.uid();

-- Očekivani rezultat: greška iz triggera — "Nije dozvoljeno mijenjati klub korisnika."
-- Neočekivani rezultat (propust): club_id je promijenjen


-- ============================================================
-- TEST 6: Korisnik ne može promijeniti vlastitu ulogu
-- ============================================================
-- Kao koordinator (role = 'coordinator'), pokušati dodijeliti sebi 'owner':

update public.users
set role = 'owner'
where id = auth.uid();

-- Očekivani rezultat: greška iz triggera — "Nije dozvoljeno mijenjati ulogu korisnika..."
-- Neočekivani rezultat (propust): uloga je promijenjena


-- ============================================================
-- TEST 7: Anonimni korisnik ne vidi nikakve podatke
-- ============================================================
-- U SQL Editoru odabrati "Run as: anon" i izvršiti:

select * from public.clubs;
select * from public.users;
select * from public.children;

-- Očekivani rezultat: 0 redova za sve tabele
-- Neočekivani rezultat (propust): podaci su vidljivi bez prijave


-- ============================================================
-- TEST 8: register_club() ne može biti pozvana od anonimnog korisnika
-- ============================================================
-- Kao anon korisnik:

select public.register_club('Napadački klub', 'Haker', 'haker@test.com');

-- Očekivani rezultat: greška — "permission denied for function register_club"
-- Neočekivani rezultat (propust): klub je kreiran bez autentifikacije


-- ============================================================
-- ČIŠĆENJE: Brisanje testnih podataka
-- Izvršiti nakon testiranja.
-- ============================================================

delete from public.children
where club_id in (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002'
);

delete from public.groups
where club_id in (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002'
);

delete from public.clubs
where id in (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002'
);
