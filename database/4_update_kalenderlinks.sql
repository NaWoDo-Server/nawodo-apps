-- Aktualisiert die FAQ-Antwort zu den Kalender-Links: jetzt mit eigenem Link
-- für jeden Bereich (Autos, Räder, Wallbox, Räume, Material, Termine),
-- zusätzlich zum Gesamt-Link.
-- In der SSH-Sitzung: docker exec -it supabase-db psql -U postgres
-- Dann diesen Block einfügen, Enter drücken.

update faq_entries set answer =
'Ja, das geht – mit einem Abo-Link, der sich automatisch aktualisiert (alle ca. 15 Minuten), sobald neue Einträge dazukommen. Jeder kann sich den Link für den Bereich holen, den er braucht.

Auto-Sharing:
https://api.nawodo.de/functions/v1/calendar-feed?category=Car%20Sharing

Rad Sharing:
https://api.nawodo.de/functions/v1/calendar-feed?category=Rad%20Sharing

Wallbox:
https://api.nawodo.de/functions/v1/calendar-feed?category=Wallbox

Raumbuchung:
https://api.nawodo.de/functions/v1/calendar-feed?category=Raumbuchung

Materialverleih:
https://api.nawodo.de/functions/v1/calendar-feed?category=Materialverleih

NaWoDo-Termine:
https://api.nawodo.de/functions/v1/calendar-feed?category=NaWoDo-Termine

Alle Bereiche zusammen in einem Kalender:
https://api.nawodo.de/functions/v1/calendar-feed

So abonnierst du einen Link:
Outlook: Kalender öffnen -> "Kalender hinzufügen" -> "Aus dem Internet abonnieren" -> Link einfügen -> Importieren.
Google Kalender: Links unten "Weitere Kalender" (+) -> "Per URL" -> Link einfügen -> Kalender hinzufügen.'
where section = 'app' and question = 'Wie binde ich den NaWoDo-Kalender in Outlook oder Google Kalender ein?';
