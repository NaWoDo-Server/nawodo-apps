-- Fahrtenbuch: Erweiterung für Bearbeiten/Löschen (eigene Einträge + Admin) und Ausgaben.
-- In Supabase Studio -> SQL Editor -> "New query" einfügen und "Run" klicken.

alter table logbook_entries add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table logbook_entries add column if not exists is_expense boolean not null default false;
alter table logbook_entries add column if not exists expense_amount numeric;
alter table logbook_entries add column if not exists booking_id uuid references bookings(id) on delete set null;

-- Alte, admin-only Regeln ersetzen durch: eigene Einträge ODER Admin.
drop policy if exists "admin delete logbook" on logbook_entries;
drop policy if exists "admin update logbook" on logbook_entries;
drop policy if exists "own or admin delete logbook" on logbook_entries;
drop policy if exists "own or admin update logbook" on logbook_entries;

create policy "own or admin delete logbook" on logbook_entries for delete to authenticated
  using (user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "own or admin update logbook" on logbook_entries for update to authenticated
  using (user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));

-- Hinweis: Bereits bestehende Einträge (vor dieser Änderung) haben noch kein user_id
-- gespeichert und können deshalb vorerst nur von Admins bearbeitet/gelöscht werden.
