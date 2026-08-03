-- Bulldozer-Minispiel: Bestzeiten/Bestwerte pro Nutzer und Level.
-- In der SSH-Sitzung ausfuehren: docker exec -i supabase-db psql -U postgres < schema_bulldozer.sql

create table if not exists bulldozer_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_index int not null,
  best_time_ms int not null,
  best_moves int not null,
  solved_at timestamptz not null default now(),
  unique (user_id, level_index)
);

alter table bulldozer_scores enable row level security;

-- Lesen: alle eingeloggten Nutzer (fuer die Rangliste). Schreiben: nur der
-- eigene Eintrag (gleiches Muster wie bei den anderen Tabellen).
create policy "read bulldozer scores" on bulldozer_scores for select to authenticated using (true);
create policy "insert own bulldozer scores" on bulldozer_scores for insert to authenticated with check (user_id = auth.uid());
create policy "update own bulldozer scores" on bulldozer_scores for update to authenticated using (user_id = auth.uid());
