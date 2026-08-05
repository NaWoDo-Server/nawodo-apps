-- FAQ-Eintrag fuer die neue App "Saubermachtag" (idempotent).
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_faq_saubermachtag.sql

insert into faq_entries (section, question, answer, sort_order)
select v.section, v.question, v.answer, v.sort_order
from (values
  ('app', 'Was ist die App „Saubermachtag"?',
   E'Hier organisieren wir unsere gemeinsamen Putztage. Zu jedem Termin gibt es einen Hauptverantwortlichen, Datum und Uhrzeit, die Essens-Abfrage (Fleisch/Vegetarisch/Vegan) mit Angabe, wer kocht und was es gibt, sowie die Aufgabenliste. Bei jeder Aufgabe können sich mehrere Helfer eintragen und sie als „fertig" markieren. Die Aufgabenliste lässt sich als Excel-Datei zum Ausdrucken herunterladen. Im Reiter „Übersicht" siehst du, was dieses Jahr wie oft erledigt wurde, und im Reiter „Inspektionsliste" pflegt das Team den Rundgang mit Fotos und Stand der baulichen Dinge.',
   19)
) as v(section, question, answer, sort_order)
where not exists (select 1 from faq_entries f where f.question = v.question);
