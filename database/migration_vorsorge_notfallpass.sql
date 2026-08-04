-- Vorsorge: Notfallpass - ein Formular pro Person mit den wichtigsten Angaben fuer den
-- medizinischen Ernstfall (Rettungsdienst/Krankenhaus), getrennt von den hochgeladenen
-- Dokumenten. Sichtbar fuer den Besitzer selbst, seine vollen Vertrauenspersonen
-- (vorsorge_shares) und den Superadmin - nicht fuer nur-einzeln-freigeschaltete Personen,
-- da der Notfallpass kein einzelnes Dokument ist.
-- In der SSH-Sitzung ausfuehren: docker exec -i supabase-db psql -U postgres < migration_vorsorge_notfallpass.sql

create table if not exists vorsorge_notfallpass (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  geburtsdatum date,
  adresse text,
  blutgruppe text,
  vorerkrankungen text,
  allergien text,
  medikamente text,
  implantate text,
  operationen text,
  kontakt1_name text,
  kontakt1_telefon text,
  kontakt2_name text,
  kontakt2_telefon text,
  hausarzt_name text,
  hausarzt_telefon text,
  facharzt_name text,
  facharzt_telefon text,
  krankenkasse text,
  versichertennummer text,
  vorsorge_hinweis text,
  organspendeausweis boolean not null default false,
  patientenverfuegung_kurzform text,
  besondere_hinweise text,
  updated_at timestamptz default now()
);

alter table vorsorge_notfallpass enable row level security;

drop policy if exists "vorsorge_notfallpass select" on vorsorge_notfallpass;
drop policy if exists "vorsorge_notfallpass insert" on vorsorge_notfallpass;
drop policy if exists "vorsorge_notfallpass update" on vorsorge_notfallpass;
drop policy if exists "vorsorge_notfallpass delete" on vorsorge_notfallpass;

create policy "vorsorge_notfallpass select" on vorsorge_notfallpass for select to authenticated using (
  owner_user_id = auth.uid()
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or exists (
    select 1 from vorsorge_shares s
    where s.owner_user_id = vorsorge_notfallpass.owner_user_id and s.trusted_user_id = auth.uid()
  )
);

create policy "vorsorge_notfallpass insert" on vorsorge_notfallpass for insert to authenticated with check (
  owner_user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);
create policy "vorsorge_notfallpass update" on vorsorge_notfallpass for update to authenticated using (
  owner_user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);
create policy "vorsorge_notfallpass delete" on vorsorge_notfallpass for delete to authenticated using (
  owner_user_id = auth.uid() or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
);
