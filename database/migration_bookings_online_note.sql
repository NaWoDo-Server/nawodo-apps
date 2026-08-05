-- Kleiner Zusatz-Hinweis an einer Buchung (z.B. "Online (Zoom)"), damit ein
-- online stattfindender Steuerungskreis im Termine-Kalender deutlich (rot) markiert
-- werden kann. Wird von der Grossgruppe beim Anlegen/Aendern gesetzt.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_bookings_online_note.sql

alter table bookings add column if not exists online_note text;
