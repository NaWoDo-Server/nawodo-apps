-- Notfallpass: Medikamente von einem einzelnen Freitextfeld auf eine Liste mit
-- Name + Dosierung pro Medikament umstellen. Das alte Textfeld "medikamente"
-- bleibt zur Sicherheit als Spalte erhalten (wird aber nicht mehr befuellt).
-- In der SSH-Sitzung ausfuehren:
-- docker exec -i supabase-db psql -U postgres < migration_vorsorge_medikamente_liste.sql

alter table vorsorge_notfallpass add column if not exists medikamente_liste jsonb not null default '[]'::jsonb;
