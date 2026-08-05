-- FAQ (Bereich "app") auf den aktuellen App-Stand bringen:
--  - veraltete App-Aufzaehlung in der Login-Antwort aktualisieren (nur wenn noch die alte Liste drinsteht)
--  - neue Fragen/Antworten fuer Grossgruppe, Schadenmelder, Vorsorge, Mitglieder-Gruppen, App-Reihenfolge, E-Mail-Erinnerungen
-- Idempotent: neue Fragen werden nur eingefuegt, wenn die Frage noch nicht existiert.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < migration_faq_update_apps.sql

update faq_entries
set answer = 'Mit deinem NaWoDo-Account (E-Mail + Passwort) meldest du dich einmal auf der Hauptseite (app.nawodo.de) an. Danach kannst du alle für dich freigeschalteten Apps öffnen, ohne dich erneut einzuloggen – z. B. Sharing, Termine, Fahrtenbuch, Mitglieder, Großgruppe, Schadenmelder, Vorsorge, Pinnwand und FAQ.'
where section = 'app'
  and question = 'Wie logge ich mich ein?'
  and answer like '%Sharing, Termine, Fahrtenbuch, FAQ%';

insert into faq_entries (section, question, answer, sort_order)
select v.section, v.question, v.answer, v.sort_order
from (values
  ('app', 'Was ist die App „Großgruppe"?',
   E'Hier werden die gemeinsamen Treffen organisiert – „Workshop" und „Steuerungskreis". Zu jedem Treffen gibt es Datum und Uhrzeit, Moderator/in, Themen, eine Agenda mit Uhrzeiten, die Teilnahme-Abfrage und einen Link zum Protokoll. Ein Steuerungskreis kann auch als Zoom-Treffen angelegt werden – dann steht der Zoom-Link direkt am Termin.',
   13),
  ('app', 'Wer bearbeitet eine Schadensmeldung?',
   E'Melden kann jede/r. Bearbeitet wird die Meldung vom „Schadenmelder-Team" (den Moderator/innen der App bzw. Admins). Den Fortschritt – von „Gemeldet" über „In Begutachtung" bis „Erledigt" – sehen alle Mitglieder.',
   14),
  ('app', 'Was ist die App „Vorsorge"?',
   E'Ein privater, geschützter Ablageort für wichtige Unterlagen (z. B. Patientenverfügung, Vollmachten, letzte Wünsche). Nur du selbst siehst deine Dokumente – und die Vertrauenspersonen, die du ausdrücklich freischaltest.',
   15),
  ('app', 'Wie lege ich in „Mitglieder" eine Gruppe an oder ändere sie?',
   E'Als Admin über den „Gruppen"-Bereich: dort legst du eine neue Gruppe an, und eine bestehende Gruppe bearbeitest du über das Stift-Symbol (Name und Kontakt-E-Mail).',
   16),
  ('app', 'Kann ich die Reihenfolge der Apps auf der Startseite ändern?',
   E'Als Superadmin ja: unter den App-Kacheln auf „Bearbeiten" tippen und die Kacheln mit den Pfeilen sortieren. Die Reihenfolge gilt danach für alle.',
   17),
  ('app', 'Bekomme ich Erinnerungen per E-Mail?',
   E'Bei der Großgruppe kannst du pro Treffen „E-Mail-Erinnerung 1 Tag vorher" ankreuzen. Bei Vorsorge kannst du dich erinnern lassen, ein Dokument nach etwa einem halben Jahr wieder zu prüfen. (Setzt voraus, dass der Mailversand eingerichtet ist.)',
   18)
) as v(section, question, answer, sort_order)
where not exists (select 1 from faq_entries f where f.question = v.question);
