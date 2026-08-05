-- Workshop-Erinnerungen: Zeitpunkt merken, wann die "1 Tag vorher"-Mail verschickt
-- wurde, damit sie pro Nutzer/Workshop nur einmal rausgeht (der taegliche Job setzt
-- reminded_at nach dem Versand).
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_workshop_reminders_sent.sql

alter table workshop_reminders add column if not exists reminded_at timestamptz;
