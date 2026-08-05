-- GroßGruppe: strukturierte Agenda. Zu den Beschreibungen (Spalte "agenda", je Zeile
-- ein Punkt) kommen die passenden Startuhrzeiten in einer Parallel-Spalte "agenda_times"
-- (gleiches Muster wie themen/themen_info). Bestehende Agenden bleiben erhalten.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_grossgruppe_agenda.sql

alter table workshops add column if not exists agenda_times text;
