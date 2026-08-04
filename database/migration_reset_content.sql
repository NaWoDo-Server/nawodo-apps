-- Einmalige Bereinigung vor dem "richtigen" Live-Start: loescht Sharing/Termine-Buchungen,
-- Fahrtenbuch-Eintraege und alle Workshops (inkl. Anhaenge, Essenszusagen, Teilnahme).
--
-- UNBERUEHRT bleiben: Mitglieder/Accounts, Gruppen (Bereiche), Pinnwand, FAQ, Vorsorge,
-- Bulldozer-Punktestand, sowie die angelegten Autos/Raeder/Raeume/Kategorien selbst
-- (nur die Buchungen darin werden geleert).
--
-- ACHTUNG: Das ist NICHT rueckgaengig zu machen. Vorher pruefen, dass wirklich alles
-- geleert werden soll.
--
-- In Supabase Studio -> SQL Editor -> "New query" einfuegen und "Run" klicken.

delete from bookings;
delete from logbook_entries;
delete from workshop_attendance;
delete from workshop_food_items;
delete from workshop_attachments;
delete from workshops;
