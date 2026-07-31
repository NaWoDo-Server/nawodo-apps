-- Fahrtenbuch: Buchungen sollen wissen, wer sie angelegt hat.
-- Damit im Fahrtenbuch nur der Buchende (oder ein Admin) die Kilometer zu einer
-- Buchung eintragen kann.
-- In Supabase Studio -> SQL Editor -> "New query" einfügen und "Run" klicken.

alter table bookings add column if not exists user_id uuid references auth.users(id);

-- Hinweis: Bereits bestehende (alte) Buchungen haben noch kein user_id gespeichert.
-- Die App behandelt diese Altfälle als "für alle offen", damit nichts verloren geht.
