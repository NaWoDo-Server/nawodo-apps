-- members.mitgliedstyp: Check-Constraint um "bewohner" erweitern (war bisher
-- nicht erlaubt, deshalb Fehler "violates check constraint members_mitgliedstyp_check").
alter table members drop constraint if exists members_mitgliedstyp_check;
alter table members add constraint members_mitgliedstyp_check check (mitgliedstyp in ('mitglied', 'gast', 'bewohner'));
