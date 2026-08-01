-- Migration: alle Buchungen von der alten Seite (dazzling-fox-0afe11.netlify.app)
-- in die neue Datenbank uebernehmen. Vorher werden ALLE aktuell vorhandenen
-- Buchungen in dieser Datenbank geloescht (Sharing UND Termine).
-- In der SSH-Sitzung ausfuehren: docker exec -it supabase-db psql -U postgres
-- dann diesen kompletten Block einfuegen, Enter druecken.

delete from bookings;

insert into bookings (resource_id, date, end_date, start_time, end_time, all_day, name, title, note) values
  ((select id from resources where name = 'Zoe' limit 1), '2026-07-06', '2026-07-06', '08:00', '10:00', false, 'Lars Test Outlook 1', null, null),
  ((select id from resources where name = 'Herrenrad klein' limit 1), '2026-07-07', '2026-07-07', '08:00', '10:00', false, 'Lars Test Rad Sharing', null, null),
  ((select id from resources where name = 'Damenrad schwarz' limit 1), '2026-07-07', '2026-07-08', '08:00', '09:00', false, 'Lars Rad Sharing test 2', null, null),
  ((select id from resources where name = 'Zoe' limit 1), '2026-07-16', '2026-07-16', '00:00', '23:59', true, 'Lars Test Outlook 2', null, null),
  ((select id from resources where name = 'GMR' limit 1), '2026-07-20', '2026-07-20', '07:00', '08:30', false, 'Lisa', null, 'Büro'),
  ((select id from resources where name = 'Zoe' limit 1), '2026-07-21', '2026-07-21', '08:00', '10:00', false, 'Isabell', null, null),
  ((select id from resources where name = 'Wallbox 1' limit 1), '2026-07-24', '2026-07-25', '18:30', '07:30', false, 'Wilke', null, null),
  ((select id from resources where name = 'Herrenrad groß' limit 1), '2026-07-24', '2026-07-24', '08:00', '10:00', false, 'Lars Test Outlook 3', null, null),
  ((select id from resources where name = 'GMR' limit 1), '2026-07-24', '2026-07-24', '07:00', '08:30', false, 'Lisa', null, 'Büro'),
  ((select id from resources where name = 'Zoe' limit 1), '2026-07-24', '2026-07-24', '08:00', '08:30', false, 'julia', null, 'TEST EINTRAG'),
  ((select id from resources where name = 'Wallbox 1' limit 1), '2026-07-25', '2026-07-26', '21:00', '08:00', false, 'Steil', null, null),
  ((select id from resources where name = 'Zoe' limit 1), '2026-07-26', '2026-07-26', '00:00', '23:59', true, 'Steil', null, null),
  ((select id from resources where name = 'Wallbox 1' limit 1), '2026-07-26', '2026-07-26', '17:00', '21:00', false, 'Steil', null, null),
  ((select id from resources where name = 'Ebike Damen' limit 1), '2026-07-27', '2026-07-27', '11:00', '17:30', false, 'Heidi', null, null),
  ((select id from resources where name = 'Steckdose' limit 1), '2026-07-27', '2026-07-28', '20:00', '04:00', false, 'Tuts', null, null),
  ((select id from resources where name = 'Wallbox 1' limit 1), '2026-07-28', '2026-07-28', '15:30', '22:30', false, 'Wilke', null, null),
  ((select id from resources where name = 'Zoe' limit 1), '2026-07-29', '2026-07-29', '06:30', '19:00', false, 'Inga', null, null),
  ((select id from resources where name = 'Zoe' limit 1), '2026-07-30', '2026-07-30', '06:30', '19:00', false, 'Inga', null, null),
  ((select id from resources where name = 'Termin' limit 1), '2026-07-30', '2026-07-30', '00:00', '23:59', true, 'Lars', 'Test', null),
  ((select id from resources where name = 'Zoe' limit 1), '2026-07-31', '2026-08-01', '21:00', '08:00', false, 'Zoe laden', null, null),
  ((select id from resources where name = 'Wallbox 1' limit 1), '2026-07-31', '2026-08-01', '21:00', '08:00', false, 'Steil', null, null),
  ((select id from resources where name = 'Wallbox 1' limit 1), '2026-08-01', '2026-08-01', '16:00', '20:00', false, 'Steil', null, null),
  ((select id from resources where name = 'Steckdose' limit 1), '2026-08-01', '2026-08-02', '20:00', '04:00', false, 'Tuts', null, null),
  ((select id from resources where name = 'Zoe' limit 1), '2026-08-01', '2026-08-01', '08:00', '23:59', false, 'Steil', null, null),
  ((select id from resources where name = 'Volvo' limit 1), '2026-08-01', '2026-08-20', '00:00', '23:59', true, 'Schlegl', null, null),
  ((select id from resources where name = 'Steckdose' limit 1), '2026-08-04', '2026-08-05', '20:00', '04:00', false, 'Tuts', null, null),
  ((select id from resources where name = 'GMR' limit 1), '2026-08-07', '2026-08-08', '20:00', '10:00', false, 'Aljoscha', null, 'Büro Übernachtung'),
  ((select id from resources where name = 'Grill' limit 1), '2026-08-08', '2026-08-08', '16:00', '22:00', false, 'Heidi', null, null),
  ((select id from resources where name = 'Pavillon 3x3m' limit 1), '2026-08-08', '2026-08-08', '13:00', '23:59', false, 'Heidi', null, null),
  ((select id from resources where name = 'Veranda' limit 1), '2026-08-08', '2026-08-08', '13:00', '23:59', false, 'Heidi', null, null),
  ((select id from resources where name = 'Terrasse' limit 1), '2026-08-08', '2026-08-08', '13:00', '23:59', false, 'Heidi', null, null),
  ((select id from resources where name = 'GMR' limit 1), '2026-08-08', '2026-08-08', '15:00', '23:59', false, 'Heidi', null, null),
  ((select id from resources where name = 'GMR' limit 1), '2026-08-09', '2026-08-11', '00:00', '23:59', true, 'Übernachtung Büro Isabell', null, null),
  ((select id from resources where name = 'Steckdose' limit 1), '2026-08-21', '2026-08-22', '20:00', '04:00', false, 'Tuts', null, null),
  ((select id from resources where name = 'Volvo' limit 1), '2026-08-21', '2026-08-30', '00:00', '23:59', true, 'Steil', null, null),
  ((select id from resources where name = 'Steckdose' limit 1), '2026-08-24', '2026-08-24', '18:00', '23:55', false, 'Tuts', null, null),
  ((select id from resources where name = 'Steckdose' limit 1), '2026-08-25', '2026-08-25', '18:00', '23:55', false, 'Tuts', null, null),
  ((select id from resources where name = 'Steckdose' limit 1), '2026-08-26', '2026-08-26', '18:00', '23:55', false, 'Tuts', null, null),
  ((select id from resources where name = 'Steckdose' limit 1), '2026-08-27', '2026-08-27', '18:00', '23:55', false, 'Tuts', null, null),
  ((select id from resources where name = 'Zoe' limit 1), '2026-08-28', '2026-08-30', '00:00', '23:59', true, 'Fam Günther', null, null);

-- Kontrolle: sollte 0 sein. Falls nicht 0, sind Ressourcennamen nicht 1:1 übernommen worden.
select count(*) as fehlerhafte_zeilen from bookings where resource_id is null;
