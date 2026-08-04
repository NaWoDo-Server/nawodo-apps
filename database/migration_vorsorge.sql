-- Neue App "Vorsorge": privater Dokumenten-Tresor fuer Testament, Patientenverfuegung,
-- Bankverbindungen, letzte Wuensche und sonstige wichtige Unterlagen. Jedes Mitglied
-- verwaltet nur seine eigenen Dokumente und bestimmt selbst, welche Vertrauenspersonen
-- dauerhaften Zugriff bekommen. Der Superadmin sieht zusaetzlich immer alles (Notfall-
-- Zugriff/Support), unabhaengig von einer expliziten Freigabe.
-- In der SSH-Sitzung ausfuehren: docker exec -i supabase-db psql -U postgres < migration_vorsorge.sql

create table if not exists vorsorge_documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  custom_category text,
  title text not null,
  note text,
  file_path text not null,
  file_name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists vorsorge_shares (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  trusted_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  constraint vorsorge_shares_no_self check (owner_user_id <> trusted_user_id),
  constraint vorsorge_shares_unique unique (owner_user_id, trusted_user_id)
);

alter table vorsorge_documents enable row level security;
alter table vorsorge_shares enable row level security;

drop policy if exists "vorsorge_documents select" on vorsorge_documents;
drop policy if exists "vorsorge_documents insert" on vorsorge_documents;
drop policy if exists "vorsorge_documents update" on vorsorge_documents;
drop policy if exists "vorsorge_documents delete" on vorsorge_documents;

-- Lesen: der Besitzer selbst, jede von ihm eingetragene Vertrauensperson, und der
-- Superadmin (immer, als Notfall-/Support-Zugriff).
create policy "vorsorge_documents select" on vorsorge_documents for select to authenticated using (
  owner_user_id = auth.uid()
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or exists (
    select 1 from vorsorge_shares s
    where s.owner_user_id = vorsorge_documents.owner_user_id and s.trusted_user_id = auth.uid()
  )
);

-- Schreiben/Aendern/Loeschen: nur der Besitzer selbst oder der Superadmin.
create policy "vorsorge_documents insert" on vorsorge_documents for insert to authenticated with check (
  owner_user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);
create policy "vorsorge_documents update" on vorsorge_documents for update to authenticated using (
  owner_user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);
create policy "vorsorge_documents delete" on vorsorge_documents for delete to authenticated using (
  owner_user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);

drop policy if exists "vorsorge_shares select" on vorsorge_shares;
drop policy if exists "vorsorge_shares insert" on vorsorge_shares;
drop policy if exists "vorsorge_shares delete" on vorsorge_shares;

-- Lesen: der Besitzer (sieht seine eigene Liste an Vertrauenspersonen), die
-- eingetragene Vertrauensperson selbst (sieht, fuer wen sie eingetragen ist), und
-- der Superadmin.
create policy "vorsorge_shares select" on vorsorge_shares for select to authenticated using (
  owner_user_id = auth.uid()
  or trusted_user_id = auth.uid()
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);

-- Vertrauenspersonen hinzufuegen/entfernen: nur der Besitzer selbst oder der Superadmin.
create policy "vorsorge_shares insert" on vorsorge_shares for insert to authenticated with check (
  owner_user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);
create policy "vorsorge_shares delete" on vorsorge_shares for delete to authenticated using (
  owner_user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);

-- Eigener, NICHT oeffentlicher Storage-Bucket fuer die Dateien selbst. Dateien liegen
-- unter "<owner_user_id>/<dateiname>" - die Storage-Policies pruefen genau diesen
-- ersten Pfad-Teil.
insert into storage.buckets (id, name, public)
values ('vorsorge-dokumente', 'vorsorge-dokumente', false)
on conflict (id) do nothing;

drop policy if exists "vorsorge_storage select" on storage.objects;
drop policy if exists "vorsorge_storage insert" on storage.objects;
drop policy if exists "vorsorge_storage delete" on storage.objects;

create policy "vorsorge_storage select" on storage.objects for select to authenticated using (
  bucket_id = 'vorsorge-dokumente'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (
      select 1 from vorsorge_shares s
      where s.owner_user_id::text = (storage.foldername(name))[1] and s.trusted_user_id = auth.uid()
    )
  )
);

create policy "vorsorge_storage insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'vorsorge-dokumente'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  )
);

create policy "vorsorge_storage delete" on storage.objects for delete to authenticated using (
  bucket_id = 'vorsorge-dokumente'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  )
);
