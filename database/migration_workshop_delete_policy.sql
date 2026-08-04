-- Bisher konnte das Loeschen eines Workshops nur ueber den Loeschen-Button in der App
-- verhindert werden (canManageWorkshop) - serverseitig (RLS) war das nicht abgesichert.
-- Diese Migration erzwingt es direkt in der Datenbank: nur Ersteller, Workshop-Moderatoren
-- und Admins/Superadmin duerfen einen Workshop loeschen, unabhaengig von der App.
--
-- WICHTIG: Falls fuer "workshops" schon eine DELETE-Regel existiert (in Supabase Studio
-- unter Authentication -> Policies -> Tabelle "workshops" nachsehen), bitte diese zuerst
-- entfernen (Papierkorb-Symbol) - sonst gelten beide Regeln gleichzeitig ("oder"-verknuepft)
-- und die alte, evtl. zu offene Regel wuerde die neue aushebeln.
--
-- In Supabase Studio -> SQL Editor -> "New query" einfuegen und "Run" klicken.

alter table workshops enable row level security;

create policy "delete workshops" on workshops for delete to authenticated using (
  created_by = auth.uid()
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or exists (
    select 1 from app_moderators m
    where m.user_id = auth.uid() and m.app_key = 'workshop'
  )
);
