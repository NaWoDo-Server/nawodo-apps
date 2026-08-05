-- Einzelne An/Aus-Schalter fuer die automatischen E-Mails.
-- Alle drei stehen absichtlich standardmaessig auf FALSE: ohne ausdrueckliche
-- Freigabe im Settings-Reiter "E-Mail" wird KEINE Automatik-Mail an Mitglieder
-- versendet -- auch dann nicht, wenn der SMTP-Versand global aktiv ist.
--
--   notify_schaden_enabled      -> Info-Mail ans Schaden-Postfach bei neuer Meldung
--   notify_vorsorge_enabled     -> Erinnerung, ein Vorsorge-Dokument nach ~6 Monaten zu pruefen
--   notify_grossgruppe_enabled  -> Erinnerung 1 Tag vor Workshop/Steuerungskreis
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_mail_notify_flags.sql

alter table mail_settings add column if not exists notify_schaden_enabled     boolean not null default false;
alter table mail_settings add column if not exists notify_vorsorge_enabled    boolean not null default false;
alter table mail_settings add column if not exists notify_grossgruppe_enabled boolean not null default false;
