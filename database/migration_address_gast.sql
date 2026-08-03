-- NaWoDo Mitglieder: Anschrift in Straße/Hausnummer/PLZ/Wohnort splitten,
-- Mitgliedstyp "freund" -> "gast" umbenennen (neuer Typ "bewohner" braucht keine
-- Migration, der existiert einfach als weitere Auswahl in der App).
-- In Supabase Studio -> SQL Editor -> "New query" einfügen und "Run" klicken.

-- Neue Adressfelder. Die alte Spalte "anschrift" bleibt unangetastet erhalten
-- (nichts wird gelöscht) - sie dient nur noch als Referenz, falls beim Umstellen
-- auf die neuen Felder mal nachgeschaut werden muss, was vorher eingetragen war.
alter table members add column if not exists strasse text;
alter table members add column if not exists hausnummer text;
alter table members add column if not exists plz text;
alter table members add column if not exists wohnort text;

-- Bestehende "freund"-Einträge auf "gast" umstellen.
update members set mitgliedstyp = 'gast' where mitgliedstyp = 'freund';
