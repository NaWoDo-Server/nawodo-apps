# NaWoDo Apps

Quellcode für die selbst gehosteten Apps des Wohnprojekts **NaWoDo eG**. Alle Apps teilen
sich eine Anmeldung (Supabase Auth) und laufen unter einer gemeinsamen Startseite (Hub).

## Apps

- `hub_static/` – Startseite mit App-Kacheln (phone-style Icons), steuert Sichtbarkeit je App
- `sharing/` – NaWoDo Sharing: Buchung gemeinsamer Ressourcen (Autos, Räder, Wallbox, Räume, Material)
- `termine/` – Gemeinsamer Kalender / Termine & Veranstaltungen
- `fahrtenbuch/` – Kilometer- und Kostenerfassung, verknüpft mit den Car-Sharing-Buchungen
- `mitglieder/` – Mitglieder-Verzeichnis mit Gruppen ("Bereiche") und Kontaktdaten
- `settings/` – Superadmin-Verwaltung: Accounts, Rechte/Rollen, App-Schalter, E-Mail (SMTP)
- `faq/` – Fragen & Antworten (zwei Bereiche: Wohnprojekt und Apps)
- `vorsorge/` – Privater Dokumenten-Tresor (Vorsorge) mit Freigabe an Vertrauenspersonen
- `workshop/` – Termine, Themen, Agenda, Teilnahme & Protokolle für Großgruppen-Treffen
- `schadenmelder/` – Ticketsystem für Schadensmeldungen im Gebäude (Melden → Begutachtung → … → Erledigt)
- `pinnwand/` – Schwarzes Brett / Notizen
- `bulldozer/` – kleines Community-Spiel
- `database/` – SQL-Migrationen sowie die Edge Functions (siehe unten)

## Edge Functions (`database/*.ts`)

- `admin-create-account.ts` – Superadmin: Accounts/Kinder anlegen, Passwörter/Rechte setzen, löschen
- `calendar-feed.ts` – iCal-Feed für die Termine
- `schaden-notify.ts` – schickt bei einer neuen Schadensmeldung eine E-Mail ans Ziel-Postfach
- `daily-reminders.ts` – täglicher Cron-Job: Vorsorge-Erinnerung (6 Monate) und Workshop-Erinnerung (1 Tag vorher)

Die Mail-Funktionen lesen die SMTP-Zugangsdaten zentral aus der Tabelle `mail_settings`
(pflegbar über **Settings → E-Mail**, nur Superadmin). Ohne aktivierte/konfigurierte
Werte überspringen sie den Versand sauber.

## Technik

- Frontend je App: React 18 + Vite 5 + Tailwind (CDN), gebaut nach `dist/`, ausgeliefert per Nginx
- Backend: selbst gehostetes **Supabase** (Postgres + Auth + PostgREST + Edge Functions) via Docker Compose
- Rechte: Row-Level-Security über `auth.jwt() user_metadata` (`is_admin`/`is_superadmin`) und die Tabelle `app_moderators`
- Erreichbar unter `app.nawodo.de` (Frontend) und `api.nawodo.de` (Supabase), HTTPS via Let's Encrypt

## Konfiguration / Geheimnisse

Keine echten Zugangsdaten im Repository. Die je App vorhandene `public/config.js`
(Supabase-URL + Anon-Key) ist ein Platzhalter; die echte Datei liegt nur im Web-Root des
Servers und wird beim Deploy per `rsync --exclude=config.js` nicht überschrieben.

## Deploy (vom Server)

Pro geänderter App: `npm install && npm run build`, dann `rsync -a --exclude=config.js dist/`
in den Web-Root. SQL-Migrationen mit `docker exec -i supabase-db psql -U postgres < datei.sql`.
Edge Functions liegen unter `/root/supabase/docker/volumes/functions/<name>/index.ts`; nach
Änderungen `docker restart supabase-edge-functions`.
