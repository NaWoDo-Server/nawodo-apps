-- Verknuepft die Demo-Buchungen/Fahrtenbuch/Workshops wirklich mit den echten
-- Testuser-Accounts (user_id), statt nur den Namen als Text zu tragen. Der erste
-- Seed-Lauf (migration_seed_testdata.sql) ist VOR den echten Testuser-Logins
-- entstanden und konnte deshalb noch keine user_id setzen - wird hier komplett
-- geloescht und mit echter Verknuepfung neu angelegt.
--
-- Voraussetzung: create_testusers.sh wurde bereits erfolgreich ausgefuehrt (die 10
-- Testuser existieren als echte Mitglieder mit user_id in der Tabelle "members").
-- Findet sich ein Testuser nicht (z.B. weil das Anlegen fehlgeschlagen ist), wird für
-- ihn einfach kein Eintrag erzeugt - kein Fehler, nur weniger Daten fuer diesen einen.

begin;

-- 0) Alten, nicht verknuepften Seed-Datensatz entfernen ------------------------------
delete from workshop_food_items where created_by_name like 'Testuser%';
delete from workshop_attendance where user_name like 'Testuser%';
delete from bookings where workshop_id in (select id from workshops where moderator_name like 'Testuser%' or created_by_name like 'Testuser%');
delete from workshops where moderator_name like 'Testuser%' or created_by_name like 'Testuser%';
delete from bookings where name like 'Testuser%';
delete from logbook_entries where driver_name like 'Testuser%';

-- 1) Buchungen jeglicher Art, jetzt mit user_id --------------------------------------
do $$
declare
  test_names text[] := array['Testuser1','Testuser2','Testuser3','Testuser4','Testuser5','Testuser6','Testuser7','Testuser8','Testuser9','Testuser10'];
  notes text[] := array['Wochenendausflug','Einkaufsfahrt','Familienbesuch','Kurzstrecke','Fahrt zum Bahnhof','Ausflug ins Grüne','Transport','Besorgungen','Fahrt zur Arbeit','Wochenendtrip'];
  resource_rec record;
  d date;
  i int;
  uid uuid;
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
      select m.user_id into uid from members m where m.vorname = test_names[1 + (i % 10)] limit 1;
      insert into bookings (resource_id, date, end_date, all_day, start_time, end_time, name, note, user_id)
      values (
        resource_rec.id, d, d,
        (random() < 0.5),
        case when random() < 0.5 then '09:00' else '14:00' end,
        case when random() < 0.5 then '13:00' else '18:00' end,
        test_names[1 + (i % 10)],
        notes[1 + (i % 10)],
        uid
      );
      i := i + 1;
      d := d + (7 + floor(random() * 6)::int);
    end loop;
  end loop;
end $$;

-- 2) NaWoDo-Termine (Kalender-Events), jetzt mit user_id -----------------------------
do $$
declare
  event_resource_id uuid;
  test_names text[] := array['Testuser1','Testuser2','Testuser3','Testuser4','Testuser5','Testuser6','Testuser7','Testuser8','Testuser9','Testuser10'];
  titles text[] := array['Hausversammlung','Gartentag','Grillabend','Plenum','Nachbarschaftsfest','Herbstputz','Kinderfest','Waldspaziergang','Weinprobe im Hof','Bücherflohmarkt','Filmabend','Werkzeugverleih-Sprechstunde'];
  d date;
  i int := 0;
  uid uuid;
begin
  select r.id into event_resource_id
  from resources r join categories c on c.id = r.category_id
  where c.event_mode = true limit 1;

  if event_resource_id is not null then
    d := date '2026-08-08';
    while d <= date '2026-10-24' loop
      select m.user_id into uid from members m where m.vorname = test_names[1 + (i % 10)] limit 1;
      insert into bookings (resource_id, date, end_date, all_day, start_time, end_time, name, title, user_id)
      values (
        event_resource_id, d, d, false,
        case when i % 2 = 0 then '18:00' else '15:00' end,
        case when i % 2 = 0 then '21:00' else '17:30' end,
        test_names[1 + (i % 10)],
        titles[1 + (i % 12)],
        uid
      );
      i := i + 1;
      d := d + 8;
    end loop;
  end if;
end $$;

-- 3) Fahrtenbuch (Kilometer-Eintraege), jetzt mit user_id ----------------------------
do $$
declare
  car_rec record;
  test_names text[] := array['Testuser1','Testuser2','Testuser3','Testuser4','Testuser5','Testuser6','Testuser7','Testuser8','Testuser9','Testuser10'];
  d date;
  i int;
  cur_km int;
  trip_km int;
  uid uuid;
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
      select m.user_id into uid from members m where m.vorname = test_names[1 + (i % 10)] limit 1;
      insert into logbook_entries (resource_id, date, driver_name, start_km, end_km, user_id)
      values (car_rec.id, d, test_names[1 + (i % 10)], cur_km, cur_km + trip_km, uid);
      cur_km := cur_km + trip_km;
      i := i + 1;
      d := d + (3 + floor(random() * 4)::int);
    end loop;
  end loop;
end $$;

-- 4) Zwei Workshops mit Themen/Agenda/Essensliste/Zu-Absagen, jetzt mit user_id -------
do $$
declare
  w1 uuid;
  w2 uuid;
  event_resource_id uuid;
  gmr_id uuid;
  uid3 uuid;
  uid7 uuid;
begin
  select user_id into uid3 from members where vorname = 'Testuser3' limit 1;
  select user_id into uid7 from members where vorname = 'Testuser7' limit 1;

  insert into workshops (date, moderator_user_id, moderator_name, themen, themen_info, agenda, created_by, created_by_name)
  values (
    date '2026-09-12',
    uid3,
    'Testuser3',
    E'Kompost richtig anlegen\nSolarstrom fürs Gemeinschaftshaus',
    E'Wie baue ich einen guten Komposthaufen und was darf rein?\nÜberblick über eine mögliche PV-Anlage fürs GMR-Dach.',
    'Treffen im GMR, anschließend gemeinsamer Rundgang über das Gelände.',
    uid3,
    'Testuser3'
  ) returning id into w1;

  insert into workshops (date, moderator_user_id, moderator_name, themen, themen_info, agenda, created_by, created_by_name)
  values (
    date '2026-10-17',
    uid7,
    'Testuser7',
    E'Winterfest machen\nFahrrad-Reparatur-Workshop',
    E'Gemeinsam Balkone/Terrassen winterfest machen.\nKleine Reparaturen an den Sharing-Rädern.',
    'Treffen im GMR, Werkzeug ist vorhanden.',
    uid7,
    'Testuser7'
  ) returning id into w2;

  insert into workshop_attendance (workshop_id, user_id, user_name, attending)
  select w1, m.user_id, m.vorname, att.attending
  from (values ('Testuser1', true), ('Testuser2', true), ('Testuser4', false), ('Testuser5', true), ('Testuser8', true)) as att(vorname, attending)
  join members m on m.vorname = att.vorname
  where m.user_id is not null;

  insert into workshop_attendance (workshop_id, user_id, user_name, attending)
  select w2, m.user_id, m.vorname, att.attending
  from (values ('Testuser1', true), ('Testuser6', true), ('Testuser9', false), ('Testuser10', true)) as att(vorname, attending)
  join members m on m.vorname = att.vorname
  where m.user_id is not null;

  insert into workshop_food_items (workshop_id, item, created_by, created_by_name)
  select w1, food.item, m.user_id, m.vorname
  from (values ('Kartoffelsalat', 'Testuser2'), ('Getränke', 'Testuser5')) as food(item, vorname)
  join members m on m.vorname = food.vorname;

  insert into workshop_food_items (workshop_id, item, created_by, created_by_name)
  select w2, food.item, m.user_id, m.vorname
  from (values ('Kuchen', 'Testuser6'), ('Kaffee & Tee', 'Testuser9')) as food(item, vorname)
  join members m on m.vorname = food.vorname;

  select r.id into event_resource_id from resources r join categories c on c.id = r.category_id where c.event_mode = true limit 1;
  select id into gmr_id from resources where lower(name) = 'gmr' limit 1;

  if event_resource_id is not null then
    insert into bookings (resource_id, date, end_date, all_day, start_time, end_time, name, title, note, workshop_id, user_id) values
      (event_resource_id, date '2026-09-12', date '2026-09-12', false, '10:00', '16:00', 'Testuser3', 'Workshop: Kompost richtig anlegen', 'Treffen im GMR, anschließend gemeinsamer Rundgang über das Gelände.', w1, uid3),
      (event_resource_id, date '2026-10-17', date '2026-10-17', false, '10:00', '16:00', 'Testuser7', 'Workshop: Winterfest machen', 'Treffen im GMR, Werkzeug ist vorhanden.', w2, uid7);
  end if;

  if gmr_id is not null then
    insert into bookings (resource_id, date, end_date, all_day, start_time, end_time, name, title, workshop_id, user_id) values
      (gmr_id, date '2026-09-12', date '2026-09-12', false, '10:00', '16:00', 'Testuser3', 'Workshop: Kompost richtig anlegen (GMR)', w1, uid3),
      (gmr_id, date '2026-10-17', date '2026-10-17', false, '10:00', '16:00', 'Testuser7', 'Workshop: Winterfest machen (GMR)', w2, uid7);
  end if;
end $$;

commit;
