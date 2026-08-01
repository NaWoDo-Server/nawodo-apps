-- Bookings: Es gab bisher nur Regeln zum Lesen/Anlegen/Löschen, aber keine zum
-- Bearbeiten (Update) einer bestehenden Buchung. Dadurch wurden Änderungen an
-- Buchungen (Sharing/Termine) im Hintergrund von Supabase stillschweigend verworfen,
-- ohne Fehlermeldung in der App.
-- In Supabase Studio -> SQL Editor -> "New query" einfügen und "Run" klicken.

create policy "update bookings" on bookings for update to authenticated using (true) with check (true);
