-- App "workshop" -> "grossgruppe" (GroßGruppe): Rechte/Einstellungen migrieren
-- (die Freigaben der Mitglieder bleiben erhalten) und neue Felder für Treffen-Typ,
-- Präsenz/Zoom und den Protokoll-Link ergänzen. Die Tabellennamen (workshops,
-- workshop_attachments, workshop_food_items, workshop_attendance, workshop_reminders)
-- bleiben absichtlich unverändert.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_grossgruppe.sql

-- 1) App-Schlüssel migrieren (Moderatoren, Einzel-Freigaben, Ein/Aus-Schalter)
update app_moderators     set app_key = 'grossgruppe'          where app_key = 'workshop';
update member_permissions set app_key = 'grossgruppe'          where app_key = 'workshop';
update app_settings       set key     = 'app_enabled_grossgruppe' where key = 'app_enabled_workshop';

-- 2) Neue Felder auf der Tabelle workshops
alter table workshops add column if not exists meeting_type text not null default 'workshop';
alter table workshops add column if not exists mode text;            -- 'praesenz' | 'zoom' (nur Steuerungskreis)
alter table workshops add column if not exists zoom_link text;       -- Zoom-Einladung/Link (nur Zoom)
alter table workshops add column if not exists protokoll_url text;   -- pCloud-Link zum Protokoll

-- Wertebereich absichern (nur setzen, wenn noch nicht vorhanden)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workshops_meeting_type_chk') then
    alter table workshops add constraint workshops_meeting_type_chk
      check (meeting_type in ('workshop','steuerungskreis'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workshops_mode_chk') then
    alter table workshops add constraint workshops_mode_chk
      check (mode is null or mode in ('praesenz','zoom'));
  end if;
end $$;
