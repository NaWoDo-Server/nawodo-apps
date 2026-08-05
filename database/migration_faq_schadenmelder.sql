-- FAQ-Eintrag zum Schadenmelder (Bereich "app"). Idempotent: legt die Frage nur an,
-- wenn sie noch nicht existiert.
--   docker exec -i supabase-db psql -U postgres < migration_faq_schadenmelder.sql

insert into faq_entries (section, question, answer, sort_order)
select 'app',
  'Wie melde ich einen Schaden?',
  E'In wenigen Schritten ist ein Schaden gemeldet:\n\n'
  || E'1. Öffne den Schadenmelder und tippe auf „Schaden melden".\n'
  || E'2. Gib einen kurzen, klaren Titel ein (z. B. „Wasserhahn tropft, 2. OG").\n'
  || E'3. Beschreibe den Schaden möglichst genau.\n'
  || E'4. Wähle den Ort im Gebäude und die passende Kategorie.\n'
  || E'5. Füge – wenn möglich – ein oder mehrere Fotos hinzu.\n'
  || E'6. Tippe auf „Schaden melden". Fertig!\n\n'
  || E'Das Schadenmelder-Team erhält deine Meldung (auch per E-Mail) und kümmert sich darum. '
  || E'Du und alle anderen Mitglieder könnt den Fortschritt jederzeit im Schadenmelder verfolgen – '
  || E'von „Gemeldet" über „In Begutachtung" bis „Erledigt". '
  || E'Rückfragen stellst du direkt als Kommentar an der Meldung.',
  12
where not exists (select 1 from faq_entries where question = 'Wie melde ich einen Schaden?');
