-- Erweitert die persoenlichen Startseiten-Einstellungen um ein getrenntes Layout
-- fuer Desktop und Handy (Reihenfolge + Ein-/Ausblenden von Apps UND Widgets).
-- Struktur der Spalte "layout":
--   {
--     "desktop": { "apps":[...], "hiddenApps":[...], "widgets":[...], "hiddenWidgets":[...] },
--     "mobile":  { "apps":[...], "hiddenApps":[...], "widgets":[...], "hiddenWidgets":[...] }
--   }
-- Die alten Spalten (app_order/widget_order/hidden_widgets) bleiben als Rueckfallebene.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_user_hub_layout.sql

alter table user_hub_prefs add column if not exists layout jsonb;
