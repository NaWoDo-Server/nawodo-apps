-- FAQ-Moderatoren (Settings -> Rollen -> Mod: FAQ) sollen die gleichen Rechte haben wie
-- globale Admins - bisher durften nur Admins (is_admin) Fragen anlegen/aendern/loeschen,
-- das "Moderator: FAQ"-Haekchen aus der Rollen-Matrix hatte serverseitig keine Wirkung.
-- In Supabase Studio -> SQL Editor -> "New query" einfuegen und "Run" klicken.

drop policy if exists "admin insert faq" on faq_entries;
drop policy if exists "admin update faq" on faq_entries;
drop policy if exists "admin delete faq" on faq_entries;

create policy "admin insert faq" on faq_entries for insert to authenticated
  with check (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'faq')
  );
create policy "admin update faq" on faq_entries for update to authenticated
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'faq')
  );
create policy "admin delete faq" on faq_entries for delete to authenticated
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'faq')
  );
