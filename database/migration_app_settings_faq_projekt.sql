-- Neue, generische "app_settings"-Tabelle fuer suite-weite Ein/Aus-Schalter,
-- die nur der Superadmin setzen kann. Erster Eintrag: ob der FAQ-Bereich
-- "Rund ums Wohnprojekt" fuer alle Mitglieder sichtbar ist (Default: aus).
-- In der SSH-Sitzung ausfuehren: docker exec -i supabase-db psql -U postgres < migration_app_settings_faq_projekt.sql

create table if not exists app_settings (
  key text primary key,
  value boolean not null default false,
  updated_at timestamptz default now()
);

alter table app_settings enable row level security;

drop policy if exists "read app_settings" on app_settings;
drop policy if exists "superadmin write app_settings" on app_settings;

-- Lesen: alle eingeloggten Nutzer (die FAQ-App muss den Wert kennen, um den
-- Bereich ein-/auszublenden).
create policy "read app_settings" on app_settings for select to authenticated using (true);

-- Schreiben: nur der Superadmin.
create policy "superadmin write app_settings" on app_settings for all to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false));

insert into app_settings (key, value) values ('faq_projekt_visible', false)
on conflict (key) do nothing;
