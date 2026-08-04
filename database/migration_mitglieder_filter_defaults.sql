-- Mitglieder-App: Die Filter "Genossenschaftsmitglieder" und "Kinder" sind jetzt genau wie
-- "Gaeste"/"Bewohner" Opt-in (member_permissions, fehlende Zeile = NICHT sichtbar).
-- Damit bestehende Mitglieder nach dem Deploy nicht ploetzlich eine leere Liste sehen, gibt
-- dieses Skript allen aktuellen Login-Accounts einmalig die beiden Rechte, die vorher der
-- Standard waren (Genossenschaftsmitglieder + Kinder sichtbar). Gaeste/Bewohner bleiben wie
-- gehabt aus, bis du sie einzeln in der Settings-App freischaltest.
-- In der SSH-Sitzung ausfuehren: docker exec -i supabase-db psql -U postgres < migration_mitglieder_filter_defaults.sql

insert into member_permissions (user_id, app_key, allowed)
select id, 'mitglieder_genossenschaft', true
from auth.users u
where not exists (
  select 1 from member_permissions mp
  where mp.user_id = u.id and mp.app_key = 'mitglieder_genossenschaft'
);

insert into member_permissions (user_id, app_key, allowed)
select id, 'mitglieder_kinder', true
from auth.users u
where not exists (
  select 1 from member_permissions mp
  where mp.user_id = u.id and mp.app_key = 'mitglieder_kinder'
);
