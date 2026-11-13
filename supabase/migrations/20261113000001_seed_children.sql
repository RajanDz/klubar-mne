-- Seed migration: add 20 children to each of 4 groups.
-- Groups are created if they don't already exist.
-- Runs against the first club found in the database.

DO $$
DECLARE
  v_club_id  uuid;
  v_g1       uuid;  -- Juniori
  v_g2       uuid;  -- Kadeti 2012
  v_g3       uuid;  -- Mladji pioniri
  v_g4       uuid;  -- Pioniri 2012
  v_child    uuid;
BEGIN
  SELECT id INTO v_club_id FROM public.clubs ORDER BY created_at LIMIT 1;
  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'No club found — run this after creating a club.';
  END IF;

  -- ── Get or create groups ────────────────────────────────────────

  SELECT id INTO v_g1 FROM public.groups WHERE club_id = v_club_id AND name = 'Juniori' LIMIT 1;
  IF v_g1 IS NULL THEN
    INSERT INTO public.groups (club_id, name) VALUES (v_club_id, 'Juniori') RETURNING id INTO v_g1;
  END IF;

  SELECT id INTO v_g2 FROM public.groups WHERE club_id = v_club_id AND name = 'Kadeti 2012' LIMIT 1;
  IF v_g2 IS NULL THEN
    INSERT INTO public.groups (club_id, name) VALUES (v_club_id, 'Kadeti 2012') RETURNING id INTO v_g2;
  END IF;

  SELECT id INTO v_g3 FROM public.groups WHERE club_id = v_club_id AND name = 'Mladji pioniri' LIMIT 1;
  IF v_g3 IS NULL THEN
    INSERT INTO public.groups (club_id, name) VALUES (v_club_id, 'Mladji pioniri') RETURNING id INTO v_g3;
  END IF;

  SELECT id INTO v_g4 FROM public.groups WHERE club_id = v_club_id AND name = 'Pioniri 2012' LIMIT 1;
  IF v_g4 IS NULL THEN
    INSERT INTO public.groups (club_id, name) VALUES (v_club_id, 'Pioniri 2012') RETURNING id INTO v_g4;
  END IF;

  -- ── Helper: insert child + link to group ────────────────────────

  CREATE TEMP TABLE IF NOT EXISTS _seed_done (dummy int);  -- guard

  -- ── Juniori (godište 2007–2009) ─────────────────────────────────

  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Marko Nikolić',    '2007-03-14', 'Dragan Nikolić')    RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Luka Petrović',    '2008-07-22', 'Zoran Petrović')     RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Stefan Jovanović', '2007-11-05', 'Ivan Jovanović')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Nikola Đurović',   '2009-01-30', 'Miloš Đurović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Aleksa Marković',  '2008-05-17', 'Nenad Marković')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Filip Vuković',    '2007-09-08', 'Branko Vuković')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Vuk Milović',      '2009-04-25', 'Slobodan Milović')    RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Milan Stanić',     '2008-12-03', 'Goran Stanić')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Ivan Božović',     '2007-06-19', 'Predrag Božović')     RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Petar Radović',    '2009-10-11', 'Vojin Radović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Ana Vukotić',      '2008-02-28', 'Jelena Vukotić')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Sara Popović',     '2007-08-16', 'Tamara Popović')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Jovana Đurić',     '2009-03-07', 'Nataša Đurić')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Mia Lazović',      '2008-11-21', 'Marina Lazović')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Tamara Knežević',  '2007-05-04', 'Dragana Knežević')    RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Bojan Đorđević',   '2009-09-13', 'Dejan Đorđević')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Dejan Vuković',    '2008-01-26', 'Srđan Vuković')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Nemanja Bogdanović','2007-07-09', 'Vladimir Bogdanović') RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Sofija Tomović',   '2009-12-18', 'Vesna Tomović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Milica Stijović',  '2008-04-02', 'Snežana Stijović')    RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g1);

  -- ── Kadeti 2012 (godište 2011–2013) ─────────────────────────────

  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Đorđe Milović',    '2012-02-14', 'Slobodan Milović')    RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Miloš Peković',    '2011-06-28', 'Radoslav Peković')    RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Bogdan Vukotić',   '2013-10-05', 'Dragan Vukotić')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Dragan Stjepanović','2012-03-19', 'Mirko Stjepanović')   RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Srđan Raičević',   '2011-08-07', 'Đorđe Raičević')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Vladan Ivanović',  '2013-01-23', 'Nikola Ivanović')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Dušan Jovićević',  '2012-05-31', 'Bojan Jovićević')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Aleksandar Đurović','2011-11-15', 'Zoran Đurović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Rastko Nikolić',   '2013-04-08', 'Petar Nikolić')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Zoran Marković',   '2012-09-27', 'Stevan Marković')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Milena Vukić',     '2011-02-11', 'Vesna Vukić')          RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Nataša Popović',   '2013-07-20', 'Dragana Popović')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Dragana Petrović', '2012-12-03', 'Slobodanka Petrović') RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Teodora Lazović',  '2011-05-16', 'Snežana Lazović')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Katarina Jovović', '2013-09-01', 'Mirjana Jovović')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Nina Đurić',       '2012-01-24', 'Jasmina Đurić')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Iva Vujović',      '2011-10-09', 'Tatjana Vujović')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Jelena Stjepović',  '2013-03-18', 'Gordana Stjepović')   RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Tijana Nikolić',   '2012-08-06', 'Biljana Nikolić')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Andrea Radonjić',  '2011-12-29', 'Lidija Radonjić')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g2);

  -- ── Mladji pioniri (godište 2014–2016) ──────────────────────────

  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'David Đurović',    '2014-04-10', 'Miloš Đurović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Matej Petrović',   '2015-08-23', 'Lazar Petrović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Lazar Nikolić',    '2016-02-07', 'Marko Nikolić')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Vanja Vukotić',    '2014-11-15', 'Ivan Vukotić')         RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Vojin Marković',   '2015-05-28', 'Nikola Marković')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Pavle Božović',    '2016-09-12', 'Stefan Božović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Nikša Lazović',    '2014-01-30', 'Filip Lazović')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Strahinja Popović','2015-07-04', 'Bojan Popović')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Andrej Vuković',   '2016-12-19', 'Dejan Vuković')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Mihailo Đorđević', '2014-06-08', 'Vladica Đorđević')    RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Emma Tomović',     '2015-03-21', 'Vesna Tomović')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Lena Jovović',     '2016-10-14', 'Marina Jovović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Marta Vujović',    '2014-08-27', 'Tatjana Vujović')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Hana Raičević',    '2015-01-05', 'Jasmina Raičević')     RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Dunja Stjepanović','2016-05-17', 'Gordana Stjepanović')  RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Eva Ivanović',     '2014-09-02', 'Dragana Ivanović')     RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Mina Bogdanović',  '2015-12-25', 'Snežana Bogdanović')   RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Zoja Radonjić',    '2016-04-11', 'Lidija Radonjić')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Anja Milović',     '2014-07-30', 'Nataša Milović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Nela Nikolić',     '2015-11-18', 'Biljana Nikolić')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g3);

  -- ── Pioniri 2012 (godište 2012–2013) ────────────────────────────

  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Branko Vukotić',   '2012-02-29', 'Čedomir Vukotić')     RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Danilo Marković',  '2013-06-14', 'Nebojša Marković')     RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Goran Petrović',   '2012-10-07', 'Radomir Petrović')     RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Jovan Nikolić',    '2013-03-22', 'Ognjen Nikolić')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Kristijan Đurović','2012-07-18', 'Predrag Đurović')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Lazar Vuković',    '2013-01-09', 'Vladan Vuković')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Nebojša Božović',  '2012-05-26', 'Zoran Božović')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Ognjen Stijović',  '2013-09-04', 'Miodrag Stijović')     RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Predrag Vujović',  '2012-12-17', 'Dragutin Vujović')     RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Rastko Jovović',   '2013-04-30', 'Slavko Jovović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Aleksandra Tomović','2012-08-13', 'Vesna Tomović')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Biljana Lazović',  '2013-02-06', 'Milena Lazović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Dragana Marković', '2012-11-24', 'Slavica Marković')     RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Emina Jovović',    '2013-05-19', 'Fatima Jovović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Gordana Nikolić',  '2012-09-08', 'Radmila Nikolić')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Irena Đurović',    '2013-01-27', 'Zorica Đurović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Jasna Raičević',   '2012-06-15', 'Branka Raičević')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Kristina Vukotić', '2013-10-03', 'Ružica Vukotić')      RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Lidija Petrović',  '2012-03-21', 'Danka Petrović')       RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);
  INSERT INTO public.children (club_id, full_name, date_of_birth, parent_name) VALUES (v_club_id, 'Maja Đorđević',    '2013-08-10', 'Nada Đorđević')        RETURNING id INTO v_child; INSERT INTO public.children_groups (club_id, child_id, group_id) VALUES (v_club_id, v_child, v_g4);

  DROP TABLE IF EXISTS _seed_done;
END $$;
