-- Gast/Bewohner: Pflichtangabe, zu welchem Mitglied die Person gehoert.
alter table members add column if not exists related_user_id uuid references auth.users(id) on delete set null;
