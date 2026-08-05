-- Etappe 3: Erinnerungen als persoenliche Abos (in Settings -> Mein Bereich),
-- gesteuert zusaetzlich durch die globalen Hauptschalter des Superadmins (mail_settings).
--
--  user_hub_prefs:  notify_grossgruppe / notify_vorsorge / notify_notfallpass  (pro Nutzer, Standard AUS)
--  mail_settings:   notify_notfallpass_enabled  (globaler Hauptschalter, wie die anderen)
--  reminder_sends:  Protokoll gegen Doppel-Versand (kind, ref, user, Datum)
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_reminders_etappe3.sql

alter table user_hub_prefs add column if not exists notify_grossgruppe boolean not null default false;
alter table user_hub_prefs add column if not exists notify_vorsorge    boolean not null default false;
alter table user_hub_prefs add column if not exists notify_notfallpass boolean not null default false;

alter table mail_settings add column if not exists notify_notfallpass_enabled boolean not null default false;

create table if not exists reminder_sends (
  id uuid primary key default gen_random_uuid(),
  kind text not null,          -- 'grossgruppe' | 'vorsorge' | 'notfallpass'
  ref text not null,           -- z.B. Meeting-ID oder 'vorsorge-2026-H1'
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_date date not null,
  created_at timestamptz not null default now(),
  unique (kind, ref, user_id, sent_date)
);
-- Nur die Edge Function (Service-Role) schreibt/liest hier; RLS an, keine Policy noetig.
alter table reminder_sends enable row level security;
