-- Schadenmelder-App: Ticketsystem fuer Schadensmeldungen im Gebaeude.
-- Melden -> Begutachtung -> Freigabe/Ablehnung -> Behebung -> Erledigt.
-- Jedes freigeschaltete Mitglied sieht alle Meldungen inkl. Fortschritt; das
-- "Schadenmelder-Team" (Moderatoren der App + Admins/Superadmin) nimmt Schaeden auf,
-- aendert den Status und pflegt die Bearbeitungsfelder.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < schema_schadenmelder.sql
-- (NICHT ueber die Studio-UI, wie bei allen anderen Migrationen.)

-- =====================================================================
-- Tabellen
-- =====================================================================

-- Haupttabelle: ein Schaden = ein Ticket.
create table if not exists schaden_tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,                              -- Ort im Gebaeude, z.B. "Treppenhaus 2. OG"
  category text,                              -- Sanitaer/Elektro/Heizung/Dach/Aussenanlage/Sonstiges
  status text not null default 'gemeldet'
    check (status in ('gemeldet','begutachtung','freigegeben','behebung','erledigt','abgelehnt')),
  priority text
    check (priority is null or priority in ('niedrig','mittel','hoch')),
  repair_mode text                            -- Behebungsweg
    check (repair_mode is null or repair_mode in ('eigenleistung','handwerker')),
  resources_available boolean,                -- nur bei Eigenleistung: Ressourcen NaWoDo vorhanden?
  handwerker_info text,                        -- nur bei Handwerker: Firma/Kontakt/Notiz
  inspection_date date,                        -- Begutachtungstermin
  reject_reason text,                          -- Begruendung bei Ablehnung / "kein Schaden"
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fotos zu einem Ticket (Melder-Fotos + Begutachtungs-Fotos des Teams).
create table if not exists schaden_photos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references schaden_tickets(id) on delete cascade,
  url text not null,
  filename text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Kommentare: oeffentlich (fuer alle sichtbar) oder intern (nur Team).
create table if not exists schaden_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references schaden_tickets(id) on delete cascade,
  body text not null,
  is_internal boolean not null default false,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

-- Aktivitaets-Log: automatische Eintraege bei Status-/Feldaenderungen, damit der
-- Fortschritt fuer alle nachvollziehbar ist (Zeitstrahl im Ticket).
create table if not exists schaden_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references schaden_tickets(id) on delete cascade,
  kind text not null,                          -- z.B. 'created','status','priority','field'
  detail text,                                 -- menschenlesbarer Text, z.B. "Status: In Begutachtung"
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_schaden_photos_ticket on schaden_photos(ticket_id);
create index if not exists idx_schaden_comments_ticket on schaden_comments(ticket_id);
create index if not exists idx_schaden_events_ticket on schaden_events(ticket_id);

-- =====================================================================
-- Row Level Security
-- =====================================================================
-- "elevated" = Admin ODER Superadmin ODER Moderator der App 'schadenmelder'.
-- Dasselbe Muster wie in den anderen Apps (auth.jwt user_metadata + app_moderators).

alter table schaden_tickets  enable row level security;
alter table schaden_photos   enable row level security;
alter table schaden_comments enable row level security;
alter table schaden_events   enable row level security;

-- ---------- Tickets ----------
-- Lesen: alle eingeloggten Mitglieder (Zugriffssteuerung zusaetzlich ueber member_permissions in der App).
drop policy if exists "schaden read tickets" on schaden_tickets;
create policy "schaden read tickets" on schaden_tickets for select to authenticated using (true);

-- Anlegen: jedes Mitglied darf einen Schaden melden (created_by muss man selbst sein).
drop policy if exists "schaden insert tickets" on schaden_tickets;
create policy "schaden insert tickets" on schaden_tickets for insert to authenticated
  with check (created_by = auth.uid());

-- Aendern (Status/Prioritaet/Bearbeitungsfelder): nur Team.
drop policy if exists "schaden update tickets" on schaden_tickets;
create policy "schaden update tickets" on schaden_tickets for update to authenticated
  using (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'schadenmelder')
  );

-- Loeschen: Team oder der Ersteller selbst.
drop policy if exists "schaden delete tickets" on schaden_tickets;
create policy "schaden delete tickets" on schaden_tickets for delete to authenticated
  using (
    created_by = auth.uid()
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'schadenmelder')
  );

-- ---------- Fotos ----------
drop policy if exists "schaden read photos" on schaden_photos;
create policy "schaden read photos" on schaden_photos for select to authenticated using (true);

drop policy if exists "schaden insert photos" on schaden_photos;
create policy "schaden insert photos" on schaden_photos for insert to authenticated
  with check (created_by = auth.uid());

-- Foto entfernen: eigener Upload oder Team.
drop policy if exists "schaden delete photos" on schaden_photos;
create policy "schaden delete photos" on schaden_photos for delete to authenticated
  using (
    created_by = auth.uid()
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'schadenmelder')
  );

-- ---------- Kommentare ----------
-- Lesen: oeffentliche Kommentare fuer alle; interne nur fuer das Team.
drop policy if exists "schaden read comments" on schaden_comments;
create policy "schaden read comments" on schaden_comments for select to authenticated using (
  is_internal = false
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
  or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
  or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'schadenmelder')
);

-- Schreiben: jeder darf oeffentliche Kommentare; interne nur das Team.
drop policy if exists "schaden insert comments" on schaden_comments;
create policy "schaden insert comments" on schaden_comments for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      is_internal = false
      or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
      or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
      or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'schadenmelder')
    )
  );

-- Kommentar entfernen: eigener Kommentar oder Team.
drop policy if exists "schaden delete comments" on schaden_comments;
create policy "schaden delete comments" on schaden_comments for delete to authenticated
  using (
    created_by = auth.uid()
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false)
    or coalesce((auth.jwt() -> 'user_metadata' ->> 'is_superadmin')::boolean, false)
    or exists (select 1 from app_moderators m where m.user_id = auth.uid() and m.app_key = 'schadenmelder')
  );

-- ---------- Events / Aktivitaets-Log ----------
drop policy if exists "schaden read events" on schaden_events;
create policy "schaden read events" on schaden_events for select to authenticated using (true);

drop policy if exists "schaden insert events" on schaden_events;
create policy "schaden insert events" on schaden_events for insert to authenticated
  with check (created_by = auth.uid());
