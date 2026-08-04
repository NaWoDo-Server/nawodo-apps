-- Vorsorge: zusaetzlich zur bestehenden "volle Freigabe" (vorsorge_shares, eine
-- Vertrauensperson sieht ALLE Dokumente) jetzt auch einzelne, selektive Freigabe
-- moeglich - eine Person bekommt Zugriff auf genau ein bestimmtes Dokument.
-- In der SSH-Sitzung ausfuehren: docker exec -i supabase-db psql -U postgres < migration_vorsorge_document_shares.sql

create table if not exists vorsorge_document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references vorsorge_documents(id) on delete cascade,
  trusted_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  constraint vorsorge_document_shares_unique unique (document_id, trusted_user_id)
);

alter table vorsorge_document_shares enable row level security;

drop policy if exists "vorsorge_document_shares select" on vorsorge_document_shares;
drop policy if exists "vorsorge_document_shares insert" on vorsorge_document_shares;
drop policy if exists "vorsorge_document_shares delete" on vorsorge_document_shares;

-- Lesen: der Besitzer des Dokuments (verwaltet seine Freigaben), die freigeschaltete
-- Person selbst, und der Superadmin.
create policy "vorsorge_document_shares select" on vorsorge_document_shares for select to authenticated using (
  trusted_user_id = auth.uid()
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or exists (
    select 1 from vorsorge_documents d
    where d.id = vorsorge_document_shares.document_id and d.owner_user_id = auth.uid()
  )
);

-- Freigeben/entziehen: nur der Besitzer des jeweiligen Dokuments oder der Superadmin.
create policy "vorsorge_document_shares insert" on vorsorge_document_shares for insert to authenticated with check (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or exists (
    select 1 from vorsorge_documents d
    where d.id = vorsorge_document_shares.document_id and d.owner_user_id = auth.uid()
  )
);
create policy "vorsorge_document_shares delete" on vorsorge_document_shares for delete to authenticated using (
  coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or exists (
    select 1 from vorsorge_documents d
    where d.id = vorsorge_document_shares.document_id and d.owner_user_id = auth.uid()
  )
);

-- vorsorge_documents: SELECT-Policy um die neue selektive Freigabe erweitern (bisher
-- nur Besitzer + volle Vertrauensperson + Superadmin).
drop policy if exists "vorsorge_documents select" on vorsorge_documents;
create policy "vorsorge_documents select" on vorsorge_documents for select to authenticated using (
  owner_user_id = auth.uid()
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or exists (
    select 1 from vorsorge_shares s
    where s.owner_user_id = vorsorge_documents.owner_user_id and s.trusted_user_id = auth.uid()
  )
  or exists (
    select 1 from vorsorge_document_shares ds
    where ds.document_id = vorsorge_documents.id and ds.trusted_user_id = auth.uid()
  )
);

-- Storage: SELECT-Policy ebenfalls um die selektive Freigabe erweitern.
drop policy if exists "vorsorge_storage select" on storage.objects;
create policy "vorsorge_storage select" on storage.objects for select to authenticated using (
  bucket_id = 'vorsorge-dokumente'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (
      select 1 from vorsorge_shares s
      where s.owner_user_id::text = (storage.foldername(name))[1] and s.trusted_user_id = auth.uid()
    )
    or exists (
      select 1 from vorsorge_documents d
      join vorsorge_document_shares ds on ds.document_id = d.id
      where d.file_path = name and ds.trusted_user_id = auth.uid()
    )
  )
);
