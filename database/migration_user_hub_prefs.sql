-- Persoenliche Startseiten-Einstellungen pro Nutzer:
--  - app_order:      eigene Reihenfolge der App-Kacheln (Liste von App-Schluesseln)
--  - widget_order:   eigene Reihenfolge der Startseiten-Widgets
--  - hidden_widgets: vom Nutzer ausgeblendete Widgets
-- Jeder Nutzer sieht und bearbeitet nur seine eigene Zeile (RLS).
-- Die globale Reihenfolge (app_settings.app_order) bleibt als Standard fuer alle,
-- die noch nichts Eigenes eingestellt haben.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_user_hub_prefs.sql

create table if not exists user_hub_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_order jsonb,
  widget_order jsonb,
  hidden_widgets jsonb,
  updated_at timestamptz not null default now()
);

alter table user_hub_prefs enable row level security;

drop policy if exists "hub prefs own select" on user_hub_prefs;
create policy "hub prefs own select" on user_hub_prefs for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "hub prefs own insert" on user_hub_prefs;
create policy "hub prefs own insert" on user_hub_prefs for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "hub prefs own update" on user_hub_prefs;
create policy "hub prefs own update" on user_hub_prefs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "hub prefs own delete" on user_hub_prefs;
create policy "hub prefs own delete" on user_hub_prefs for delete to authenticated
  using (user_id = auth.uid());
