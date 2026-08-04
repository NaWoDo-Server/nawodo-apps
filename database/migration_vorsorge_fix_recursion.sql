-- Fix: Die RLS-Policies von vorsorge_documents und vorsorge_document_shares
-- verweisen gegenseitig aufeinander (vorsorge_documents-Policy fragt per Subquery
-- vorsorge_document_shares ab, dessen Policies fragen wiederum per Subquery
-- vorsorge_documents ab) -> "infinite recursion detected in policy for relation
-- vorsorge_documents" / "... vorsorge_document_shares".
--
-- Loesung: Der Besitzer-Check fuer ein Dokument laeuft jetzt ueber eine
-- SECURITY DEFINER-Funktion, die RLS umgeht (laeuft mit den Rechten des
-- Funktionsbesitzers = postgres, der ueber Tabellen-RLS steht), statt per
-- direkter Subquery auf vorsorge_documents. Damit fragt vorsorge_document_shares
-- nicht mehr "live" bei vorsorge_documents' eigener RLS-Policy an, und der Kreis
-- ist durchbrochen.
--
-- In der SSH-Sitzung ausfuehren:
-- docker exec -i supabase-db psql -U postgres < migration_vorsorge_fix_recursion.sql

create or replace function vorsorge_document_owner_id(doc_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select owner_user_id from vorsorge_documents where id = doc_id;
$$;

drop policy if exists "vorsorge_document_shares select" on vorsorge_document_shares;
create policy "vorsorge_document_shares select" on vorsorge_document_shares for select to authenticated using (
  trusted_user_id = auth.uid()
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or vorsorge_document_owner_id(document_id) = auth.uid()
);

drop policy if exists "vorsorge_document_shares insert" on vorsorge_document_shares;
create policy "vorsorge_document_shares insert" on vorsorge_document_shares for insert to authenticated with check (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or vorsorge_document_owner_id(document_id) = auth.uid()
);

drop policy if exists "vorsorge_document_shares delete" on vorsorge_document_shares;
create policy "vorsorge_document_shares delete" on vorsorge_document_shares for delete to authenticated using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or vorsorge_document_owner_id(document_id) = auth.uid()
);
