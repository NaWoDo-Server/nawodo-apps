-- FAQ: Frage "Wer ist Moderator?" um Admins erweitern.
-- In der SSH-Sitzung ausfuehren: docker exec -i supabase-db psql -U postgres < migration_faq_list_admins.sql

-- Neue Funktion, die nur die User-IDs der Admins/Superadmins zurückgibt (keine
-- E-Mail-Adressen o.ä.) - für alle eingeloggten Nutzer aufrufbar, damit die
-- FAQ-Frage die aktuelle Admin-Liste live anzeigen kann.
create or replace function list_admin_user_ids()
returns table(user_id uuid)
language sql
security definer
set search_path = public, auth
as $$
  select id as user_id
  from auth.users
  where coalesce((raw_user_meta_data->>'is_admin')::boolean, false) = true
     or coalesce((raw_user_meta_data->>'is_superadmin')::boolean, false) = true;
$$;

grant execute on function list_admin_user_ids() to authenticated;

-- Frage umbenennen, damit sie auch Admins mit abdeckt (Antwort bleibt der
-- Platzhalter __DYNAMIC_MODERATORS__, die App zeigt jetzt zusätzlich eine
-- Admin-Zeile an).
update faq_entries
set question = 'Wer ist Moderator oder Admin?'
where section = 'app' and question = 'Wer ist Moderator?';
