-- Schadenmelder: zusaetzliche Felder fuer Schritt "Freigabe/Umsetzung".
--   umsetzung_termin       -> Termin fuer Handwerker/Bestellung/Umsetzung (Schritt 4/5)
--   selbstreparatur_person -> Wer repariert bei Eigenleistung (Schritt 5)
-- Idempotent, gefahrlos mehrfach ausfuehrbar.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_schadenmelder_felder.sql

alter table schaden_tickets add column if not exists umsetzung_termin date;
alter table schaden_tickets add column if not exists selbstreparatur_person text;
