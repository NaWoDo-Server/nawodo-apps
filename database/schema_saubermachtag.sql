-- =====================================================================
-- App "saubermachtag" – Saubermachtag/Putztag der Genossenschaft
-- =====================================================================
-- Ein Saubermachtag = ein Termin (mit Hauptverantwortlichem/Ersteller, Datum+Uhrzeit,
-- Essens-Abfrage und Aufgaben). Aufgaben kommen aus einer Standard-Vorlage (aus der
-- bisherigen Excel), sind pro Termin einzeln abhakbar, und mehrere Helfer koennen sich
-- eintragen. Zusaetzlich: eine dauerhafte "Inspektionsliste" (getrennt von den Terminen),
-- die von Moderatoren/Admins gepflegt wird.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < schema_saubermachtag.sql

-- =====================================================================
-- Tabellen
-- =====================================================================

-- Termine (Saubermachtage)
create table if not exists smt_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  start_time text,
  end_time text,
  slot int check (slot is null or slot between 1 and 4),   -- 1..4 = welcher der vier Putztage im Jahr (Jan/Apr/Jun/Sep)
  cook_name text,                                          -- wer kocht
  cook_dish text,                                          -- was es gibt
  notes text,
  creator_user_id uuid references auth.users(id),
  creator_name text,
  created_at timestamptz not null default now()
);

-- Standard-Aufgabenliste (Vorlage). Nur Team pflegt sie.
create table if not exists smt_task_templates (
  id uuid primary key default gen_random_uuid(),
  bereich text not null,
  title text not null,
  haeufigkeit text,                                        -- z.B. "4x"
  slot1 boolean not null default false,                    -- Jan
  slot2 boolean not null default false,                    -- Apr
  slot3 boolean not null default false,                    -- Jun
  slot4 boolean not null default false,                    -- Sep
  kommentar text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Aufgaben eines konkreten Termins (Instanzen aus der Vorlage oder ad hoc angelegt).
create table if not exists smt_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references smt_events(id) on delete cascade,
  template_id uuid references smt_task_templates(id) on delete set null,
  bereich text not null,
  title text not null,
  done boolean not null default false,
  done_by uuid references auth.users(id),
  done_by_name text,
  done_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Anmeldungen zu einer Aufgabe (mehrere Helfer moeglich).
create table if not exists smt_task_signups (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references smt_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

-- Essens-Abfrage pro Termin (eine Antwort je Nutzer).
create table if not exists smt_food (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references smt_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  diet text not null check (diet in ('fleisch','veggi','vegan')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- Inspektionsliste (dauerhaft, terminunabhaengig). Nur Team pflegt sie.
create table if not exists smt_inspection (
  id uuid primary key default gen_random_uuid(),
  bereich text,
  beschreibung text,
  stand text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists smt_inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references smt_inspection(id) on delete cascade,
  url text not null,
  filename text,
  sort_order int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_smt_tasks_event on smt_tasks(event_id);
create index if not exists idx_smt_signups_task on smt_task_signups(task_id);
create index if not exists idx_smt_food_event on smt_food(event_id);
create index if not exists idx_smt_insp_photos on smt_inspection_photos(inspection_id);

-- Verknuepfung mit dem Termine-Kalender (wie bei der Grossgruppe, aber ohne Raumbuchung).
alter table bookings add column if not exists saubermachtag_id uuid references smt_events(id) on delete cascade;

-- =====================================================================
-- Speicher-Bucket fuer Inspektions-Fotos (oeffentlich lesbar)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('saubermachtag-media', 'saubermachtag-media', true)
on conflict (id) do nothing;

drop policy if exists "smt media read" on storage.objects;
create policy "smt media read" on storage.objects for select
  using (bucket_id = 'saubermachtag-media');

drop policy if exists "smt media insert" on storage.objects;
create policy "smt media insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'saubermachtag-media');

drop policy if exists "smt media delete" on storage.objects;
create policy "smt media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'saubermachtag-media');

-- =====================================================================
-- Row Level Security
-- =====================================================================
-- "elevated" = Admin ODER Superadmin ODER Moderator der App 'saubermachtag'.

alter table smt_events         enable row level security;
alter table smt_task_templates enable row level security;
alter table smt_tasks          enable row level security;
alter table smt_task_signups   enable row level security;
alter table smt_food           enable row level security;
alter table smt_inspection     enable row level security;
alter table smt_inspection_photos enable row level security;

-- Hilfsausdruck als wiederkehrendes Muster (inline, da keine Funktion angelegt wird):
--   coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
--   or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
--   or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')

-- ---------- smt_events ----------
drop policy if exists "smt events read" on smt_events;
create policy "smt events read" on smt_events for select to authenticated using (true);

drop policy if exists "smt events insert" on smt_events;
create policy "smt events insert" on smt_events for insert to authenticated
  with check (creator_user_id = auth.uid());

drop policy if exists "smt events update" on smt_events;
create policy "smt events update" on smt_events for update to authenticated
  using (
    creator_user_id = auth.uid()
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
  );

drop policy if exists "smt events delete" on smt_events;
create policy "smt events delete" on smt_events for delete to authenticated
  using (
    creator_user_id = auth.uid()
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
  );

-- ---------- smt_task_templates (nur Team) ----------
drop policy if exists "smt tpl read" on smt_task_templates;
create policy "smt tpl read" on smt_task_templates for select to authenticated using (true);

drop policy if exists "smt tpl write" on smt_task_templates;
create policy "smt tpl write" on smt_task_templates for all to authenticated
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
  )
  with check (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
  );

-- ---------- smt_tasks ----------
drop policy if exists "smt tasks read" on smt_tasks;
create policy "smt tasks read" on smt_tasks for select to authenticated using (true);

-- Anlegen: Team ODER der Ersteller des zugehoerigen Termins (Auto-Befuellung aus Vorlage).
drop policy if exists "smt tasks insert" on smt_tasks;
create policy "smt tasks insert" on smt_tasks for insert to authenticated
  with check (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
    or exists (select 1 from smt_events e where e.id = event_id and e.creator_user_id = auth.uid())
  );

-- Aendern (u.a. "fertig"): Team, Termin-Ersteller ODER ein eingetragener Helfer.
drop policy if exists "smt tasks update" on smt_tasks;
create policy "smt tasks update" on smt_tasks for update to authenticated
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
    or exists (select 1 from smt_events e where e.id = event_id and e.creator_user_id = auth.uid())
    or exists (select 1 from smt_task_signups s where s.task_id = id and s.user_id = auth.uid())
  );

drop policy if exists "smt tasks delete" on smt_tasks;
create policy "smt tasks delete" on smt_tasks for delete to authenticated
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
    or exists (select 1 from smt_events e where e.id = event_id and e.creator_user_id = auth.uid())
  );

-- ---------- smt_task_signups (jeder meldet sich selbst) ----------
drop policy if exists "smt signups read" on smt_task_signups;
create policy "smt signups read" on smt_task_signups for select to authenticated using (true);

drop policy if exists "smt signups insert" on smt_task_signups;
create policy "smt signups insert" on smt_task_signups for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "smt signups delete" on smt_task_signups;
create policy "smt signups delete" on smt_task_signups for delete to authenticated
  using (
    user_id = auth.uid()
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
  );

-- ---------- smt_food (eigene Antwort) ----------
drop policy if exists "smt food read" on smt_food;
create policy "smt food read" on smt_food for select to authenticated using (true);

drop policy if exists "smt food write" on smt_food;
create policy "smt food write" on smt_food for all to authenticated
  using (
    user_id = auth.uid()
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
  )
  with check (user_id = auth.uid());

-- ---------- smt_inspection (nur Team schreibt) ----------
drop policy if exists "smt insp read" on smt_inspection;
create policy "smt insp read" on smt_inspection for select to authenticated using (true);

drop policy if exists "smt insp write" on smt_inspection;
create policy "smt insp write" on smt_inspection for all to authenticated
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
  )
  with check (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
  );

drop policy if exists "smt insp photos read" on smt_inspection_photos;
create policy "smt insp photos read" on smt_inspection_photos for select to authenticated using (true);

drop policy if exists "smt insp photos write" on smt_inspection_photos;
create policy "smt insp photos write" on smt_inspection_photos for all to authenticated
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
  )
  with check (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'saubermachtag')
  );
