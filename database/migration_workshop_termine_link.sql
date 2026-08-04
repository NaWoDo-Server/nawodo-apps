-- Verknuepft Workshops automatisch mit einem Termin im Termine-Kalender: legt beim
-- Anlegen/Aendern eines Workshops eine passende Buchung in "bookings" an bzw. aktualisiert
-- sie, und verlinkt umgekehrt vom Termin zurueck zum Workshop.
-- In Supabase Studio -> SQL Editor -> "New query" einfuegen und "Run" klicken.

alter table bookings add column if not exists workshop_id uuid references workshops(id) on delete cascade;
