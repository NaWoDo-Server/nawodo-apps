-- Workshop: "Altes Protokoll" pro Workshop. Es wird als ganz normaler Anhang in
-- workshop_attachments abgelegt (gleicher Storage-Bucket, gleiches Upload-Muster),
-- aber mit kind='protokoll' markiert. So kann die App es getrennt von den generischen
-- Anhaengen als eigenen, klar beschrifteten Bereich "Altes Protokoll" anzeigen.
-- Normale Anhaenge behalten kind = null (Standard).
--
-- Die bereits vorhandenen Insert-/Delete-Policies von workshop_attachments (Ersteller,
-- Workshop-Moderatoren, Admins) gelten unveraendert weiter - das Protokoll nutzt dieselbe
-- Tabelle, es ist keine neue Policy noetig.
--
-- In Supabase Studio -> SQL Editor -> "New query" einfuegen und "Run" klicken.
-- (oder in der SSH-Sitzung: docker exec -i supabase-db psql -U postgres < migration_workshop_protokoll_kind.sql)

alter table workshop_attachments add column if not exists kind text;
