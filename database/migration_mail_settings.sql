-- Zentrale Mail-Konfiguration (SMTP-Absender) fuer alle Apps, pflegbar ueber den
-- neuen "E-Mail"-Reiter in Settings. Eine einzige Zeile (id=1).
-- Enthaelt das SMTP-Passwort -> NUR der Superadmin darf lesen/schreiben (RLS).
-- Die Edge Functions (schaden-notify, daily-reminders) lesen die Werte per Service-Role
-- und umgehen damit RLS.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_mail_settings.sql

create table if not exists mail_settings (
  id int primary key,
  smtp_host text,
  smtp_port int not null default 465,
  smtp_user text,
  smtp_pass text,
  smtp_from text,
  schaden_notify_to text default 'schadensmeldung@nawodo.de',
  enabled boolean not null default false,
  updated_at timestamptz default now(),
  constraint mail_settings_singleton check (id = 1)
);

insert into mail_settings (id) values (1) on conflict (id) do nothing;

alter table mail_settings enable row level security;

drop policy if exists "mail_settings superadmin all" on mail_settings;
create policy "mail_settings superadmin all" on mail_settings for all to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false));
