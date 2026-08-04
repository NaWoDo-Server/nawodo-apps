select table_name, column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('members','bookings','logbook_entries','workshops','workshop_attendance','workshop_food_items')
order by table_name, ordinal_position;
