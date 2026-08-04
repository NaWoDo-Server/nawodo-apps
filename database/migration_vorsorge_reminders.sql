-- Vorsorge: pro Dokument waehlbare Erinnerung, es alle 6 Monate zu aktualisieren.
-- Nur das Datenmodell - der tatsaechliche Email-Versand ist ein separater Schritt
-- (braucht SMTP-Zugangsdaten fuer diese Instanz, siehe Rueckfrage an Lars).
-- In der SSH-Sitzung ausfuehren: docker exec -i supabase-db psql -U postgres < migration_vorsorge_reminders.sql

alter table vorsorge_documents add column if not exists reminder_enabled boolean not null default false;
alter table vorsorge_documents add column if not exists last_reminded_at timestamptz;
