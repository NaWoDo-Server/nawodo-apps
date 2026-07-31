-- Fahrtenbuch: neue Tabelle für Fahrten-Einträge.
-- Nutzt dieselben Autos (Zoe, Volvo) wie NaWoDo Sharing - keine Doppelpflege nötig.
-- In Supabase Studio -> SQL Editor -> "New query" einfügen und "Run" klicken.

create table if not exists logbook_entries (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references resources(id) on delete cascade,
  date date not null,
  driver_name text not null,
  start_km integer not null,
  end_km integer not null,
  note text,
  created_at timestamptz default now()
);

alter table logbook_entries enable row level security;

-- Alle eingeloggten Nutzer sehen alle Einträge (Transparenz) und dürfen neue anlegen.
create policy "read logbook" on logbook_entries for select to authenticated using (true);
create policy "create logbook" on logbook_entries for insert to authenticated with check (true);

-- Löschen/Ändern nur für Admins (schützt die Kilometerstände vor versehentlichem Löschen).
create policy "admin delete logbook" on logbook_entries for delete to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "admin update logbook" on logbook_entries for update to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
