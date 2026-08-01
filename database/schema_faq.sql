-- FAQ-App: Fragen & Antworten, zwei Bereiche (Wohnprojekt / diese Apps).
-- In Supabase Studio -> SQL Editor -> "New query" einfügen und "Run" klicken.

create table if not exists faq_entries (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('projekt', 'app')),
  question text not null,
  answer text not null,
  sort_order int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table faq_entries enable row level security;

-- Lesen: alle eingeloggten Nutzer. Anlegen/Ändern/Löschen: nur Admin-Accounts.
create policy "read faq" on faq_entries for select to authenticated using (true);
create policy "admin insert faq" on faq_entries for insert to authenticated
  with check (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "admin update faq" on faq_entries for update to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));
create policy "admin delete faq" on faq_entries for delete to authenticated
  using (coalesce((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false));

-- Startbelegung: FAQ rund um die Apps (frei ausgedacht, aber sachlich korrekt für den
-- aktuellen Funktionsumfang). Bereich "projekt" bekommt ein paar Platzhalter-Fragen,
-- die ein Admin mit den echten Infos (WLAN, Hausmeister, etc.) befüllen kann.
insert into faq_entries (section, question, answer, sort_order) values
  ('app', 'Wie logge ich mich ein?', 'Mit deinem NaWoDo-Account (E-Mail + Passwort) meldest du dich einmal auf der Hauptseite (app.nawodo.de) an. Danach kannst du alle Apps – Sharing, Termine, Fahrtenbuch, FAQ – öffnen, ohne dich erneut einzuloggen.', 0),
  ('app', 'Ich habe mein Passwort vergessen. Was tue ich?', 'Melde dich bei einem Admin aus dem Wohnprojekt – er kann dir ein neues Passwort setzen oder deinen Account zurücksetzen.', 1),
  ('app', 'Was ist der Unterschied zwischen "Sharing" und "Termine"?', '"Sharing" ist zum Buchen gemeinsamer Ressourcen wie Autos, Räder, Wallbox, Räume und Material. "Termine" ist der Kalender für allgemeine Termine und Veranstaltungen im Wohnprojekt, dort lässt sich auch ein Raum mitbuchen.', 2),
  ('app', 'Warum sehe ich Termine auch bei Sharing?', 'Termine werden dort nur zur Übersicht angezeigt, lassen sich aber nicht bearbeiten – dafür bitte die Termine-App öffnen.', 3),
  ('app', 'Wie buche ich etwas?', 'In der jeweiligen App oben auf "Buchen" klicken (oder direkt einen Tag im Kalender anklicken), Ressource und Zeitraum auswählen und speichern.', 4),
  ('app', 'Kann ich eine Buchung ändern oder löschen?', 'Ja – auf die Buchung klicken, dort gibt es einen Stift zum Bearbeiten und einen Papierkorb zum Löschen.', 5),
  ('app', 'Wie funktioniert das Fahrtenbuch?', 'Nach einer Autobuchung erscheint sie im Fahrtenbuch als "ausstehend". Dort trägst du Start- und End-Kilometerstand ein. Das kann nur, wer das Auto gebucht hat, oder ein Admin.', 6),
  ('app', 'Wer kann neue Fahrzeuge, Räume oder Artikel anlegen?', 'Das können nur Admin-Accounts, über den "Neuer Artikel"-Button in der jeweiligen App.', 7),
  ('app', 'Wie ist mein Datenschutz geregelt?', 'Die Apps laufen auf einem eigenen, selbst gehosteten Server der NaWoDo eG – eure Daten werden nicht an Dritte weitergegeben. Details stehen in der Datenschutzerklärung, verlinkt auf der Hauptseite.', 8),
  ('app', 'Wer sieht meine Buchungen?', 'Alle angemeldeten Mitglieder im Wohnprojekt sehen, was, wann und von wem gebucht wurde – das ist Absicht, damit ihr euch untereinander abstimmen könnt.', 9),
  ('app', 'Ich habe einen Fehler gefunden – an wen wende ich mich?', 'Meld dich einfach bei einem Admin aus eurem Wohnprojekt, der kümmert sich darum oder gibt es weiter.', 10),
  ('app', 'Funktioniert das auch auf dem Handy?', 'Ja, alle Apps passen sich automatisch an dein Bildschirmformat an – Smartphone, Tablet und PC funktionieren alle.', 11),
  ('projekt', 'Wie lautet das WLAN-Passwort?', '(Bitte von einem Admin ausfüllen.)', 0),
  ('projekt', 'Wen rufe ich an, wenn die Heizung ausfällt?', '(Bitte von einem Admin ausfüllen – Name & Telefonnummer.)', 1),
  ('projekt', 'Wo finde ich die Hausordnung?', '(Bitte von einem Admin ausfüllen.)', 2),
  ('projekt', 'An wen wende ich mich bei Nachbarschaftsthemen?', '(Bitte von einem Admin ausfüllen.)', 3);
