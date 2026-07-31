# NaWoDo Apps

Quellcode für die selbst gehosteten Apps des Wohnprojekts NaWoDo.

- `sharing/` – NaWoDo Sharing (Ressourcen-Buchung: Autos, Räder, Wallbox, Räume, Material, Termine)
- `fahrtenbuch/` – Fahrtenbuch (Kilometer-Erfassung für Car Sharing)
- `hub_static/` – Startseite mit App-Icons + Platzhalter für Pinnwand/Biete-Suche
- `database/` – SQL-Migrationen und die Kalender-Feed-Funktion

Läuft komplett selbst gehostet auf einem eigenen Server (Supabase via Docker, Nginx),
erreichbar unter app.nawodo.de. Keine echten Zugangsdaten in diesem Repository -
`config.js` in `sharing/public/` und `fahrtenbuch/public/` sind Platzhalter.
