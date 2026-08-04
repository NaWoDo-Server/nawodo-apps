-- Erlaubt Mitgliedern, ihren Geburtstag aus dem Geburtstage-Widget der Hauptseite
-- auszublenden (Kontrollkaestchen im Mitglieder-Bearbeiten-Formular).
-- In Supabase Studio -> SQL Editor -> "New query" einfuegen und "Run" klicken.

alter table members add column if not exists geburtstag_versteckt boolean not null default false;
