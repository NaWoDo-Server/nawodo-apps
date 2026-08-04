-- Vorsorge: Freigabe-Modell umgestellt. Bisher gab das Eintragen als
-- "Vertrauensperson" (vorsorge_shares) automatisch Zugriff auf ALLE Dokumente
-- und den Notfallpass. Jetzt legt "Vertrauensperson hinzufuegen" nur noch fest,
-- wer im Kreis der moeglichen Empfaenger steht - der tatsaechliche Zugriff auf
-- einzelne Dokumente und/oder den Notfallpass wird gezielt ueber eine
-- Kontrollkaestchen-Matrix in der App gesteuert (vorsorge_document_shares fuer
-- Dokumente, neu: vorsorge_notfallpass_shares fuer den Notfallpass).
-- In der SSH-Sitzung ausfuehren:
-- docker exec -i supabase-db psql -U postgres < migration_vorsorge_matrix_sharing.sql

create table if not exists vorsorge_notfallpass_shares (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  trusted_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  constraint vorsorge_notfallpass_shares_unique unique (owner_user_id, trusted_user_id)
);

alter table vorsorge_notfallpass_shares enable row level security;

drop policy if exists "vorsorge_notfallpass_shares select" on vorsorge_notfallpass_shares;
create policy "vorsorge_notfallpass_shares select" on vorsorge_notfallpass_shares for select to authenticated using (
  owner_user_id = auth.uid()
  or trusted_user_id = auth.uid()
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);

drop policy if exists "vorsorge_notfallpass_shares insert" on vorsorge_notfallpass_shares;
create policy "vorsorge_notfallpass_shares insert" on vorsorge_notfallpass_shares for insert to authenticated with check (
  owner_user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);

drop policy if exists "vorsorge_notfallpass_shares delete" on vorsorge_notfallpass_shares;
create policy "vorsorge_notfallpass_shares delete" on vorsorge_notfallpass_shares for delete to authenticated using (
  owner_user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);

-- vorsorge_documents: automatischen Vollzugriff fuer Vertrauenspersonen entfernen -
-- Zugriff laeuft jetzt ausschliesslich ueber die gezielte Einzel-Freigabe je Dokument.
drop policy if exists "vorsorge_documents select" on vorsorge_documents;
create policy "vorsorge_documents select" on vorsorge_documents for select to authenticated using (
  owner_user_id = auth.uid()
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or exists (
    select 1 from vorsorge_document_shares ds
    where ds.document_id = vorsorge_documents.id and ds.trusted_user_id = auth.uid()
  )
);

-- Storage: dieselbe Umstellung - kein automatischer Zugriff mehr ueber vorsorge_shares.
drop policy if exists "vorsorge_storage select" on storage.objects;
create policy "vorsorge_storage select" on storage.objects for select to authenticated using (
  bucket_id = 'vorsorge-dokumente'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (
      select 1 from vorsorge_documents d
      join vorsorge_document_shares ds on ds.document_id = d.id
      where d.file_path = name and ds.trusted_user_id = auth.uid()
    )
  )
);

-- vorsorge_notfallpass: automatischen Vollzugriff entfernen, dafuer gezielte
-- Freigabe ueber die neue Tabelle vorsorge_notfallpass_shares.
drop policy if exists "vorsorge_notfallpass select" on vorsorge_notfallpass;
create policy "vorsorge_notfallpass select" on vorsorge_notfallpass for select to authenticated using (
  owner_user_id = auth.uid()
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or exists (
    select 1 from vorsorge_notfallpass_shares s
    where s.owner_user_id = vorsorge_notfallpass.owner_user_id and s.trusted_user_id = auth.uid()
  )
);
