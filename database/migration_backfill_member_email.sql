-- Einmalig alle bestehenden Mitglieder-Eintraege mit Login nachtragen, deren Email-Feld
-- noch leer ist (z.B. weil sie vor diesem Fix angelegt wurden). Ab jetzt schreibt die
-- Account-Anlage (admin-create-account.ts) die Login-Email direkt mit ins Profil, damit
-- das Feld fuer einen Account nie mehr leer startet.
-- In der SSH-Sitzung ausfuehren: docker exec -i supabase-db psql -U postgres < migration_backfill_member_email.sql

update members m
set email = u.email
from auth.users u
where m.user_id = u.id
  and (m.email is null or m.email = '');
