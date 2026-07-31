-- NaWoDo Sharing: Komplette Datenbank-Struktur für den Betrieb mit echten Accounts
-- Für die Ausführung auf eurem SELBST GEHOSTETEN Supabase (nicht die alte Cloud-Version).
-- In Supabase Studio -> SQL Editor -> "New query" einfügen und "Run" klicken.

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default 'package',
  color text not null default '#1F6F5C',
  sort_order int not null default 0,
  event_mode boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade,
  name text not null,
  icon text not null default 'zap',
  photo_url text,
  created_at timestamptz default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references resources(id) on delete cascade,
  date date not null,
  end_date date,
  all_day boolean not null default false,
  start_time text not null,
  end_time text not null,
  name text not null,
  title text,
  note text,
  created_at timestamptz default now()
);

create table if not exists settings (
  key text primary key,
  value text
);

-- ---- Zugriffsregeln (Row Level Security) ----
-- Jetzt, wo es echte Accounts gibt: nur eingeloggte Nutzer dürfen überhaupt etwas sehen.
-- Verwaltung (Items/Bereiche/Logo anlegen, ändern, löschen) nur für Accounts mit is_admin=true.

alter table categories enable row level security;
alter table resources enable row level security;
alter table bookings enable row level security;
alter table settings enable row level security;

-- Lesen: alle eingeloggten Nutzer
create policy "read categories" on categories for select to authenticated using (true);
create policy "read resources" on resources for select to authenticated using (true);
create policy "read bookings" on bookings for select to authenticated using (true);
create policy "read settings" on settings for select to authenticated using (true);

-- Buchen: alle eingeloggten Nutzer dürfen Buchungen anlegen und löschen (vertrauensbasiert untereinander)
create policy "create bookings" on bookings for insert to authenticated with check (true);
create policy "delete bookings" on bookings for delete to authenticated using (true);

-- Verwaltung von Bereichen/Items/Logo: nur Admin-Accounts
create policy "admin insert resources" on resources for insert to authenticated
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "admin update resources" on resources for update to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "admin delete resources" on resources for delete to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));

create policy "admin insert settings" on settings for insert to authenticated
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "admin update settings" on settings for update to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));

-- ---- Zugriffsregeln für den Bilder-Speicher (Fotos, Logo) ----
-- Wichtig: den Bucket "public-media" vorher in Storage anlegen (Public bucket = an).
create policy "public read media" on storage.objects for select using (bucket_id = 'public-media');
create policy "authenticated upload media" on storage.objects for insert to authenticated with check (bucket_id = 'public-media');
create policy "authenticated update media" on storage.objects for update to authenticated using (bucket_id = 'public-media');

-- Startbelegung: eure Bereiche + Items
insert into categories (name, icon, color, sort_order, event_mode) values
  ('Car Sharing', 'car', '#2E86AB', 0, false),
  ('Rad Sharing', 'bike', '#C9A227', 1, false),
  ('Wallbox', 'zap', '#1F6F5C', 2, false),
  ('Raumbuchung', 'home', '#6C63A6', 3, false),
  ('Materialverleih', 'package', '#C9752F', 4, false),
  ('NaWoDo-Termine', 'calendar', '#B54A45', 5, true);

insert into resources (name, icon, category_id)
select v.name, v.icon, (select id from categories where categories.name = v.cat)
from (values
  ('Zoe', 'car', 'Car Sharing'),
  ('Volvo', 'car', 'Car Sharing'),
  ('Herrenrad groß', 'bike', 'Rad Sharing'),
  ('Herrenrad klein', 'bike', 'Rad Sharing'),
  ('Damenrad schwarz', 'bike', 'Rad Sharing'),
  ('Damenrad weiß', 'bike', 'Rad Sharing'),
  ('Ebike Damen', 'bike', 'Rad Sharing'),
  ('Ebike Herren', 'bike', 'Rad Sharing'),
  ('Wallbox 1', 'zap', 'Wallbox'),
  ('Wallbox 2', 'zap', 'Wallbox'),
  ('Steckdose', 'plug', 'Wallbox'),
  ('MFR', 'home', 'Raumbuchung'),
  ('GMR', 'home', 'Raumbuchung'),
  ('Terrasse', 'sun', 'Raumbuchung'),
  ('Rondell', 'trees', 'Raumbuchung'),
  ('Veranda', 'umbrella', 'Raumbuchung'),
  ('Pavillon 3x3m', 'tent', 'Materialverleih'),
  ('Pavillon 6x3m', 'tent', 'Materialverleih'),
  ('Grill', 'flame', 'Materialverleih'),
  ('Hilti', 'wrench', 'Materialverleih'),
  ('Termin', 'calendar', 'NaWoDo-Termine')
) as v(name, icon, cat);
