-- Neue FAQ-Frage: Kalender-Links für Outlook/Google Kalender.
-- In der SSH-Sitzung ausführen: docker exec -it supabase-db psql -U postgres
-- dann diesen Block einfügen, Enter drücken.

insert into faq_entries (section, question, answer, sort_order) values
('app', 'Wie binde ich den NaWoDo-Kalender in Outlook oder Google Kalender ein?',
'Ja, das geht – mit einem Abo-Link, der sich automatisch aktualisiert (alle ca. 15 Minuten), sobald neue Termine eingetragen werden.

Nur NaWoDo-Termine:
https://api.nawodo.de/functions/v1/calendar-feed?category=NaWoDo-Termine

Nur Raumbuchungen:
https://api.nawodo.de/functions/v1/calendar-feed?category=Raumbuchung

Alle Buchungen (Autos, Räder, Wallbox, Räume, Material, Termine):
https://api.nawodo.de/functions/v1/calendar-feed

So abonnierst du einen Link:
Outlook: Kalender öffnen -> "Kalender hinzufügen" -> "Aus dem Internet abonnieren" -> Link einfügen -> Importieren.
Google Kalender: Links unten "Weitere Kalender" (+) -> "Per URL" -> Link einfügen -> Kalender hinzufügen.',
12);
