-- FAQ-App: Inhalte aktualisieren + neue Fragen ergänzen.
-- In Supabase Studio -> SQL Editor -> "New query" einfügen und "Run" klicken.

-- 1) Veraltete Antwort zum Passwort-Reset aktualisieren (jetzt über die
--    Einstellungen-App durch den Superadmin möglich, nicht mehr "irgendein Admin").
update faq_entries
set answer = 'Wende dich an die Person aus eurem Wohnprojekt, die die Mitgliederverwaltung macht – sie kann dir über die Einstellungen-App ein neues Passwort setzen.'
where section = 'app' and question = 'Ich habe mein Passwort vergessen. Was tue ich?';

-- 2) Neue Fragen zum aktuellen Funktionsstand ergänzen (nur einfügen, falls die
--    Frage noch nicht existiert - Migration kann so gefahrlos mehrfach laufen).
insert into faq_entries (section, question, answer, sort_order)
select 'app', 'Wie ändere ich mein Profilbild?', 'Klick oben rechts auf deinen Profilkreis, um das Konto-Fenster zu öffnen. Über das kleine Stift-Symbol am Profilbild kannst du ein neues Foto hochladen – es wird dann überall in den Apps angezeigt.', 12
where not exists (select 1 from faq_entries where section = 'app' and question = 'Wie ändere ich mein Profilbild?');

insert into faq_entries (section, question, answer, sort_order)
select 'app', 'Was ist die Pinnwand?', 'Die Pinnwand ist das schwarze Brett des Wohnprojekts – für Gesuche, Angebote und Umfragen, die nichts mit Buchungen zu tun haben.', 13
where not exists (select 1 from faq_entries where section = 'app' and question = 'Was ist die Pinnwand?');

insert into faq_entries (section, question, answer, sort_order)
select 'app', 'Was ist die Workshop-App?', 'In der Workshop-App findest du Infos zum monatlichen Workshop-Termin, kannst dich per Ja/Nein zur Teilnahme eintragen, an der Essensabfrage teilnehmen und Themen für die Agenda vorschlagen.', 14
where not exists (select 1 from faq_entries where section = 'app' and question = 'Was ist die Workshop-App?');

insert into faq_entries (section, question, answer, sort_order)
select 'app', 'Was bedeuten die Mitgliedstypen (Genossenschaftsmitglied, Gast, Bewohner)?', 'In der Mitglieder-App wird unterschieden zwischen Genossenschaftsmitgliedern, Gästen und Bewohner:innen. Das schafft Übersicht darüber, wer im Wohnprojekt wohnt und wer "nur" Mitglied der Genossenschaft ist.', 15
where not exists (select 1 from faq_entries where section = 'app' and question = 'Was bedeuten die Mitgliedstypen (Genossenschaftsmitglied, Gast, Bewohner)?');

insert into faq_entries (section, question, answer, sort_order)
select 'app', 'Was macht ein Moderator?', 'Moderator:innen haben in einzelnen Apps erweiterte Rechte – z. B. können sie in der Mitglieder-App Gruppen anlegen, umbenennen, löschen und Mitglieder Gruppen zuweisen. Wer für welche App Moderator ist, legt der Superadmin über die Einstellungen-App fest.', 16
where not exists (select 1 from faq_entries where section = 'app' and question = 'Was macht ein Moderator?');

-- 3) Dynamische Frage "Wer ist Moderator?": Die Antwort ist bewusst kein normaler
--    Text, sondern der Platzhalter unten. Die FAQ-App erkennt diesen Platzhalter
--    und zeigt stattdessen automatisch die echte, aktuelle Moderatoren-Liste an
--    (aus der Datenbank abgefragt, kein fest eingetragener Text). Bitte den
--    answer-Text dieser Frage nicht per Hand ändern, sonst verschwindet die Liste.
insert into faq_entries (section, question, answer, sort_order)
select 'app', 'Wer ist Moderator?', '__DYNAMIC_MODERATORS__', 17
where not exists (select 1 from faq_entries where section = 'app' and question = 'Wer ist Moderator?');
