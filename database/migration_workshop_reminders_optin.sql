-- Workshop: pro Nutzer waehlbare Opt-in-Erinnerung "E-Mail-Erinnerung 1 Tag vorher".
-- Hier wird NUR die Anmeldung gespeichert - der tatsaechliche E-Mail-Versand ist ein
-- separater, geplanter Job (braucht SMTP-Zugangsdaten dieser Instanz) und nicht Teil
-- dieser Migration.
--
-- In Supabase Studio -> SQL Editor -> "New query" einfuegen und "Run" klicken.
-- (oder in der SSH-Sitzung: docker exec -i supabase-db psql -U postgres < migration_workshop_reminders_optin.sql)

create table if not exists workshop_reminders (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid references workshops(id) on delete cascade,
  user_id uuid,
  created_at timestamptz default now(),
  unique (workshop_id, user_id)
);

alter table workshop_reminders enable row level security;

drop policy if exists "workshop_reminders select" on workshop_reminders;
drop policy if exists "workshop_reminders insert" on workshop_reminders;
drop policy if exists "workshop_reminders delete" on workshop_reminders;

-- Jeder eingeloggte Nutzer verwaltet ausschliesslich seine eigenen Zeilen:
-- eigene lesen, eigene anlegen (user_id = auth.uid()), eigene loeschen.
create policy "workshop_reminders select" on workshop_reminders for select to authenticated using (
  user_id = auth.uid()
);
create policy "workshop_reminders insert" on workshop_reminders for insert to authenticated with check (
  user_id = auth.uid()
);
create policy "workshop_reminders delete" on workshop_reminders for delete to authenticated using (
  user_id = auth.uid()
);
