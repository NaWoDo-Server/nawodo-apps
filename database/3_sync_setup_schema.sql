-- Einmalig: Spalte, um synchronisierte Buchungen von der alten Seite zu erkennen.
-- In der SSH-Sitzung: docker exec -it supabase-db psql -U postgres
-- Dann diesen Block einfügen, Enter drücken.

alter table bookings add column if not exists external_id uuid;
create unique index if not exists bookings_external_id_idx on bookings (external_id) where external_id is not null;

-- Die 40 gerade von Hand übernommenen Buchungen haben noch keine external_id.
-- Damit der Sync sie nicht doppelt anlegt, jetzt einmalig entfernen -
-- der erste Sync-Lauf gleich danach legt exakt dieselben Daten neu an, nur
-- diesmal richtig markiert.
delete from bookings where external_id is null;
