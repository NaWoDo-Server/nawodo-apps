-- Entfernt alle Demo-/Testdaten wieder, die migration_seed_testdata.sql angelegt hat.
-- Loescht die 10 Testuser-Mitglieder (Testuser1-10, erkennbar an @nawodo-test.local) sowie
-- alle Buchungen, Fahrtenbuch-Eintraege und Workshops, deren Name/Fahrer/Ersteller mit
-- "Testuser" beginnt. Ruehrt keine echten Mitglieder oder deren Daten an.
--
-- ACHTUNG: Nicht rueckgaengig zu machen. Nur ausfuehren, wenn die Testdaten wirklich raus sollen.

begin;

delete from workshop_food_items where created_by_name like 'Testuser%';
delete from workshop_attendance where user_name like 'Testuser%';
delete from bookings where workshop_id in (select id from workshops where moderator_name like 'Testuser%' or created_by_name like 'Testuser%');
delete from workshops where moderator_name like 'Testuser%' or created_by_name like 'Testuser%';

delete from bookings where name like 'Testuser%';
delete from logbook_entries where driver_name like 'Testuser%';

delete from members where email like '%@nawodo-test.local';

commit;
