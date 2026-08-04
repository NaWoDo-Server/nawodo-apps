-- Fuellt die Apps mit Demo-Inhalten fuer August, September und Oktober 2026, damit sie
-- sich zum Testen/Vorfuehren "benutzt" anfuehlen.
--
-- Ansatz: 10 fiktive Mitglieder (Testuser1-10) OHNE eigenen Login-Account. Das ist bewusst
-- so gewaehlt - echte Login-Accounts per Rohdatenbank-SQL anzulegen ist riskant (Supabase-
-- interne Auth-Tabellen, Passwort-Hashes etc.), waehrend Mitglieder ohne Login von den Apps
-- schon vollstaendig unterstuetzt werden ("Kein eigener Login"). Die Testuser tauchen also
-- ganz normal in der Mitglieder-App auf und als Name auf allen Buchungen/Eintraegen, koennen
-- sich aber selbst nirgends einloggen.
--
-- Betrifft: Sharing/Termine-Buchungen, Fahrtenbuch, Termine-Kalender, 2 neue Workshops
-- (mit Themen/Agenda/Zu-Absagen/Essensliste, aber ohne Anhaenge). Ruehrt NICHT an: echte
-- Mitglieder, Gruppen, Pinnwand, FAQ, Vorsorge, Bulldozer.
--
-- Falls Ressourcen/Kategorien bei euch umbenannt wurden, finden die Namens-basierten
-- Zuordnungen (z.B. "GMR", "Car Sharing") einfach nichts und ueberspringen den jeweiligen
-- Teil - kein Fehler, nur weniger generierte Daten als gedacht.
--
-- Spaeter wieder loeschen: siehe migration_remove_testdata.sql (separat).
--
-- In Supabase Studio -> SQL Editor -> "New query" einfuegen und "Run" klicken.
-- (Oder per SSH: docker exec -i supabase-db psql -U postgres < migration_seed_testdata.sql)

begin;

-- 1) 10 fiktive Test-Mitglieder ------------------------------------------------------
insert into members (vorname, nachname, strasse, hausnummer, plz, wohnort, telefon, handy, geburtstag, email, is_child, mitgliedstyp)
values
  ('Testuser1',  'Ahrens',     'Kölner Straße',         '12', '41540', 'Dormagen', '02133 100001', '0170 1000001', '1985-03-14', 'testuser1@nawodo-test.local',  false, 'mitglied'),
  ('Testuser2',  'Bergmann',   'Further Straße',        '7',  '41540', 'Dormagen', '02133 100002', '0170 1000002', '1990-07-22', 'testuser2@nawodo-test.local',  false, 'mitglied'),
  ('Testuser3',  'Cordes',     'Nievenheimer Straße',   '23', '41540', 'Dormagen', '02133 100003', '0170 1000003', '1978-11-02', 'testuser3@nawodo-test.local',  false, 'mitglied'),
  ('Testuser4',  'Dietrich',   'Chempark Allee',        '5',  '41540', 'Dormagen', '02133 100004', '0170 1000004', '1995-01-30', 'testuser4@nawodo-test.local',  false, 'mitglied'),
  ('Testuser5',  'Ehlers',     'Rheinstraße',           '18', '41540', 'Dormagen', '02133 100005', '0170 1000005', '1982-09-09', 'testuser5@nawodo-test.local',  false, 'mitglied'),
  ('Testuser6',  'Frank',      'Sankt-Michael-Straße',  '3',  '41540', 'Dormagen', '02133 100006', '0170 1000006', '1988-05-17', 'testuser6@nawodo-test.local',  false, 'mitglied'),
  ('Testuser7',  'Gerlach',    'Bahnhofstraße',         '41', '41540', 'Dormagen', '02133 100007', '0170 1000007', '1973-12-24', 'testuser7@nawodo-test.local',  false, 'mitglied'),
  ('Testuser8',  'Hartmann',   'Zonser Straße',         '9',  '41540', 'Dormagen', '02133 100008', '0170 1000008', '1992-06-06', 'testuser8@nawodo-test.local',  false, 'mitglied'),
  ('Testuser9',  'Imhoff',     'Delrather Straße',      '27', '41540', 'Dormagen', '02133 100009', '0170 1000009', '1980-02-19', 'testuser9@nawodo-test.local',  false, 'mitglied'),
  ('Testuser10', 'Jansen',     'Hackenbroicher Straße', '14', '41540', 'Dormagen', '02133 100010', '0170 1000010', '1997-10-11', 'testuser10@nawodo-test.local', false, 'mitglied');

-- 2) Buchungen jeglicher Art (Auto/Rad/Wallbox/Raum/Material), Aug-Okt 2026 ----------
do $$
declare
  test_names text[] := array['Testuser1','Testuser2','Testuser3','Testuser4','Testuser5','Testuser6','Testuser7','Testuser8','Testuser9','Testuser10'];
  notes text[] := array['Wochenendausflug','Einkaufsfahrt','Familienbesuch','Kurzstrecke','Fahrt zum Bahnhof','Ausflug ins Grüne','Transport','Besorgungen','Fahrt zur Arbeit','Wochenendtrip'];
  resource_rec record;
  d date;
  i int;
begin
  for resource_rec in
    select r.id
    from resources r
    join categories c on c.id = r.category_id
    where c.name in ('Car Sharing','Rad Sharing','Wallbox','Raumbuchung','Materialverleih')
  loop
    i := 0;
    d := date '2026-08-02';
    while d <= date '2026-10-30' loop
      insert into bookings (resource_id, date, end_date, all_day, start_time, end_time, name, note)
      values (
        resource_rec.id, d, d,
        (random() < 0.5),
        case when random() < 0.5 then '09:00' else '14:00' end,
        case when random() < 0.5 then '13:00' else '18:00' end,
        test_names[1 + (i % 10)],
        notes[1 + (i % 10)]
      );
      i := i + 1;
      d := d + (7 + floor(random() * 6)::int);
    end loop;
  end loop;
end $$;

-- 3) NaWoDo-Termine (Kalender-Events), Aug-Okt 2026 ----------------------------------
do $$
declare
  event_resource_id uuid;
  test_names text[] := array['Testuser1','Testuser2','Testuser3','Testuser4','Testuser5','Testuser6','Testuser7','Testuser8','Testuser9','Testuser10'];
  titles text[] := array['Hausversammlung','Gartentag','Grillabend','Plenum','Nachbarschaftsfest','Herbstputz','Kinderfest','Waldspaziergang','Weinprobe im Hof','Bücherflohmarkt','Filmabend','Werkzeugverleih-Sprechstunde'];
  d date;
  i int := 0;
begin
  select r.id into event_resource_id
  from resources r join categories c on c.id = r.category_id
  where c.event_mode = true limit 1;

  if event_resource_id is not null then
    d := date '2026-08-08';
    while d <= date '2026-10-24' loop
      insert into bookings (resource_id, date, end_date, all_day, start_time, end_time, name, title)
      values (
        event_resource_id, d, d, false,
        case when i % 2 = 0 then '18:00' else '15:00' end,
        case when i % 2 = 0 then '21:00' else '17:30' end,
        test_names[1 + (i % 10)],
        titles[1 + (i % 12)]
      );
      i := i + 1;
      d := d + 8;
    end loop;
  end if;
end $$;

-- 4) Fahrtenbuch (Kilometer-Eintraege), Aug-Okt 2026 ---------------------------------
do $$
declare
  car_rec record;
  test_names text[] := array['Testuser1','Testuser2','Testuser3','Testuser4','Testuser5','Testuser6','Testuser7','Testuser8','Testuser9','Testuser10'];
  d date;
  i int;
  cur_km int;
  trip_km int;
begin
  for car_rec in
    select r.id
    from resources r join categories c on c.id = r.category_id
    where c.name = 'Car Sharing'
  loop
    select coalesce(max(end_km), 10000) into cur_km from logbook_entries where resource_id = car_rec.id;
    i := 0;
    d := date '2026-08-03';
    while d <= date '2026-10-28' loop
      trip_km := 15 + floor(random() * 80)::int;
      insert into logbook_entries (resource_id, date, driver_name, start_km, end_km)
      values (car_rec.id, d, test_names[1 + (i % 10)], cur_km, cur_km + trip_km);
      cur_km := cur_km + trip_km;
      i := i + 1;
      d := d + (3 + floor(random() * 4)::int);
    end loop;
  end loop;
end $$;

-- 5) Zwei Workshops mit Themen/Agenda/Zu-Absagen/Essensliste (keine Anhaenge) --------
do $$
declare
  w1 uuid;
  w2 uuid;
  event_resource_id uuid;
  gmr_id uuid;
begin
  insert into workshops (date, moderator_name, themen, themen_info, agenda, created_by_name)
  values (
    date '2026-09-12',
    'Testuser3',
    E'Kompost richtig anlegen\nSolarstrom fürs Gemeinschaftshaus',
    E'Wie baue ich einen guten Komposthaufen und was darf rein?\nÜberblick über eine mögliche PV-Anlage fürs GMR-Dach.',
    'Treffen im GMR, anschließend gemeinsamer Rundgang über das Gelände.',
    'Testuser3'
  ) returning id into w1;

  insert into workshops (date, moderator_name, themen, themen_info, agenda, created_by_name)
  values (
    date '2026-10-17',
    'Testuser7',
    E'Winterfest machen\nFahrrad-Reparatur-Workshop',
    E'Gemeinsam Balkone/Terrassen winterfest machen.\nKleine Reparaturen an den Sharing-Rädern.',
    'Treffen im GMR, Werkzeug ist vorhanden.',
    'Testuser7'
  ) returning id into w2;

  insert into workshop_attendance (workshop_id, user_name, attending) values
    (w1, 'Testuser1', true),
    (w1, 'Testuser2', true),
    (w1, 'Testuser4', false),
    (w1, 'Testuser5', true),
    (w1, 'Testuser8', true),
    (w2, 'Testuser1', true),
    (w2, 'Testuser6', true),
    (w2, 'Testuser9', false),
    (w2, 'Testuser10', true);

  insert into workshop_food_items (workshop_id, item, created_by_name) values
    (w1, 'Kartoffelsalat', 'Testuser2'),
    (w1, 'Getränke', 'Testuser5'),
    (w2, 'Kuchen', 'Testuser6'),
    (w2, 'Kaffee & Tee', 'Testuser9');

  select r.id into event_resource_id from resources r join categories c on c.id = r.category_id where c.event_mode = true limit 1;
  select id into gmr_id from resources where lower(name) = 'gmr' limit 1;

  if event_resource_id is not null then
    insert into bookings (resource_id, date, end_date, all_day, start_time, end_time, name, title, note, workshop_id) values
      (event_resource_id, date '2026-09-12', date '2026-09-12', false, '10:00', '16:00', 'Testuser3', 'Workshop: Kompost richtig anlegen', 'Treffen im GMR, anschließend gemeinsamer Rundgang über das Gelände.', w1),
      (event_resource_id, date '2026-10-17', date '2026-10-17', false, '10:00', '16:00', 'Testuser7', 'Workshop: Winterfest machen', 'Treffen im GMR, Werkzeug ist vorhanden.', w2);
  end if;

  if gmr_id is not null then
    insert into bookings (resource_id, date, end_date, all_day, start_time, end_time, name, title, workshop_id) values
      (gmr_id, date '2026-09-12', date '2026-09-12', false, '10:00', '16:00', 'Testuser3', 'Workshop: Kompost richtig anlegen (GMR)', w1),
      (gmr_id, date '2026-10-17', date '2026-10-17', false, '10:00', '16:00', 'Testuser7', 'Workshop: Winterfest machen (GMR)', w2);
  end if;
end $$;

commit;
