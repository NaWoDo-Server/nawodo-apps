-- Einmalig ALLEN bestehenden Login-Accounts volle Haken bei "App-Zugriff" in der
-- Settings-App geben (alle Standard-Apps + alle Opt-in-Unterfilter). Betrifft nur
-- Accounts, die es JETZT schon gibt - neue Accounts starten weiterhin mit den in
-- der Settings-App / beim Anlegen festgelegten Standardwerten.
-- In der SSH-Sitzung ausfuehren: docker exec -i supabase-db psql -U postgres < migration_alle_rechte_freischalten.sql

-- 1) Standard-Apps (Sharing, Termine, Fahrtenbuch, FAQ, Pinnwand, Mitglieder, Workshop,
--    Bulldozer): fehlende Zeile = erlaubt. Also einfach alle bestehenden Sperren entfernen.
delete from member_permissions
where app_key in ('sharing', 'termine', 'fahrtenbuch', 'faq', 'pinnwand', 'mitglieder', 'workshop', 'bulldozer')
  and allowed = false;

-- 2) Opt-in-Unterfilter (FAQ: Rund um das Projekt / Mitglieder: die vier Kategorie-Filter):
--    fehlende Zeile = NICHT erlaubt. Also fuer jeden Account + jeden Key eine allowed=true
--    Zeile anlegen, falls noch keine existiert.
insert into member_permissions (user_id, app_key, allowed)
select u.id, k.app_key, true
from auth.users u
cross join (values
  ('faq_projekt'),
  ('mitglieder_genossenschaft'),
  ('mitglieder_gaeste'),
  ('mitglieder_bewohner'),
  ('mitglieder_kinder')
) as k(app_key)
where not exists (
  select 1 from member_permissions mp
  where mp.user_id = u.id and mp.app_key = k.app_key
);

-- Falls fuer einen Opt-in-Key vorher schon eine allowed=false Zeile bestand (z.B. weil du
-- sie mal bewusst ausgeschaltet hattest), wird sie hier auf true umgestellt:
update member_permissions
set allowed = true
where app_key in ('faq_projekt', 'mitglieder_genossenschaft', 'mitglieder_gaeste', 'mitglieder_bewohner', 'mitglieder_kinder')
  and allowed = false;
