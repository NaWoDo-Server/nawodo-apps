-- Demo-/Testdaten: ein paar Schadensmeldungen + ein Saubermachtag am 19.09.2026,
-- unter Einbeziehung der echten Test-Logins (testuser1-10@testnawodo.de).
-- Idempotent: Schaeden werden per Titel, der Saubermachtag per Datum nur angelegt,
-- wenn sie noch nicht existieren. Mehrfaches Ausfuehren erzeugt keine Duplikate.
--
-- Ausfuehren in der SSH-Sitzung:
--   docker exec -i supabase-db psql -U postgres < seed_demo_schaden_saubermachtag.sql
--
-- Wieder entfernen (falls gewuenscht):
--   delete from smt_events where event_date = '2026-09-19';
--   delete from schaden_tickets where title in (
--     'Wasserfleck an der Decke im Treppenhaus','Tropfender Wasserhahn in der Gemeinschaftskueche',
--     'Kellerlicht im Gang defekt','Loses Rinnengitter vor WE23','Fahrradkeller-Tuer schliesst nicht');

do $$
declare
  uids uuid[] := '{}';
  unames text[] := '{}';
  ncount int := 0;
  creator uuid;
  creator_nm text;
  ev_id uuid;
  sch record;
  tsk record;
  seq int;
  diets text[] := array['fleisch','veggi','vegan','fleisch','veggi','vegan','fleisch','veggi'];
begin
  -- 1) Echte Test-Logins einsammeln (mit freundlichem Namen aus der Mitgliederliste)
  select coalesce(array_agg(x.id order by x.email), '{}'),
         coalesce(array_agg(x.nm order by x.email), '{}')
  into uids, unames
  from (
    select u.id, u.email,
           coalesce(nullif(trim(coalesce(m.vorname,'') || ' ' || coalesce(m.nachname,'')), ''),
                    split_part(u.email,'@',1)) as nm
    from auth.users u
    left join members m on lower(m.email) = lower(u.email)
    where u.email like 'testuser%@testnawodo.de'
  ) x;
  ncount := coalesce(array_length(uids,1), 0);

  -- Ersteller / Fallback (falls keine Test-Logins vorhanden): erster Superadmin, sonst irgendein User
  if ncount > 0 then
    creator := uids[1]; creator_nm := unames[1];
  else
    select id into creator from auth.users
      where coalesce((raw_user_meta_data->>'is_superadmin')::boolean, false) order by created_at limit 1;
    if creator is null then select id into creator from auth.users order by created_at limit 1; end if;
    creator_nm := 'Test';
  end if;

  -- 2) Schadensmeldungen ----------------------------------------------------------
  for sch in
    select * from (values
      (1, 'Wasserfleck an der Decke im Treppenhaus', 'Ueber der Wohnungstuer im 2. OG zeigt sich ein brauner Wasserfleck, der groesser geworden ist.', 'Treppenhaus 2. OG', 'Gebäude', 'gemeldet'),
      (2, 'Tropfender Wasserhahn in der Gemeinschaftskueche', 'Der Warmwasserhahn tropft dauerhaft, auch fest zugedreht.', 'Gemeinschaftskueche', 'Sanitär', 'begutachtung'),
      (3, 'Kellerlicht im Gang defekt', 'Die Leuchte im Kellergang flackert und geht immer wieder aus.', 'Kellergang', 'Elektrik', 'behebung'),
      (4, 'Loses Rinnengitter vor WE23', 'Das Rinnengitter vor WE23 wackelt und liegt nicht mehr richtig auf.', 'Aussenbereich WE23', 'Außenanlage', 'erledigt'),
      (5, 'Fahrradkeller-Tuer schliesst nicht', 'Die Tuer zum Fahrradkeller faellt nicht mehr ins Schloss.', 'Tiefgarage', 'Schließanlage', 'gemeldet')
    ) as v(k, title, descr, loc, cat, st)
  loop
    if not exists (select 1 from schaden_tickets where title = sch.title) then
      insert into schaden_tickets (title, description, location, category, status, created_by, created_by_name, created_at, updated_at)
      values (
        sch.title, sch.descr, sch.loc, sch.cat, sch.st,
        case when ncount > 0 then uids[1 + ((sch.k - 1) % ncount)] else creator end,
        case when ncount > 0 then unames[1 + ((sch.k - 1) % ncount)] else creator_nm end,
        now() - (sch.k || ' days')::interval,
        now() - (sch.k || ' days')::interval
      );
    end if;
  end loop;

  -- Fuer jede (Demo-)Meldung ohne "created"-Ereignis einen Zeitstrahl-Eintrag anlegen
  insert into schaden_events (ticket_id, kind, detail, created_by, created_by_name, created_at)
  select t.id, 'created', 'Schaden gemeldet', t.created_by, t.created_by_name, t.created_at
  from schaden_tickets t
  where not exists (select 1 from schaden_events e where e.ticket_id = t.id and e.kind = 'created');

  -- 3) Saubermachtag am 19.09.2026 (September = 4. Putztag / slot4) ----------------
  if not exists (select 1 from smt_events where event_date = '2026-09-19') then
    insert into smt_events (event_date, start_time, end_time, slot, cook_name, cook_dish, notes, creator_user_id, creator_name)
    values ('2026-09-19', '10:00', '15:00', 4,
            case when ncount > 0 then unames[1] else creator_nm end,
            'Kuerbissuppe & Flammkuchen (auch vegan)',
            'Bitte Eimer und Handschuhe mitbringen.',
            creator,
            case when ncount > 0 then unames[1] else creator_nm end)
    returning id into ev_id;

    -- Aufgaben aus der Standard-Vorlage fuer den September
    insert into smt_tasks (event_id, template_id, bereich, title, sort_order)
    select ev_id, tpl.id, tpl.bereich, tpl.title, tpl.sort_order
    from smt_task_templates tpl
    where tpl.active and tpl.slot4;

    -- feste Inspektionsgang-Aufgabe
    insert into smt_tasks (event_id, bereich, title, sort_order)
    values (ev_id, 'Inspektion', 'Inspektionsgang (Rundgang + Doku in der Inspektionsliste)', 9999);

    if ncount > 0 then
      -- Essensabfrage: mehrere Test-User mit gemischter Ernaehrung
      for seq in 0 .. (least(ncount, 8) - 1) loop
        insert into smt_food (event_id, user_id, user_name, diet)
        values (ev_id, uids[seq + 1], unames[seq + 1], diets[1 + (seq % array_length(diets, 1))])
        on conflict (event_id, user_id) do nothing;
      end loop;

      -- Helfer zu den ersten Aufgaben eintragen (teils mehrere pro Aufgabe)
      seq := 0;
      for tsk in select id from smt_tasks where event_id = ev_id order by sort_order limit 8 loop
        insert into smt_task_signups (task_id, user_id, user_name)
        values (tsk.id, uids[1 + (seq % ncount)], unames[1 + (seq % ncount)])
        on conflict (task_id, user_id) do nothing;
        if seq % 2 = 0 and ncount > 1 then
          insert into smt_task_signups (task_id, user_id, user_name)
          values (tsk.id, uids[1 + ((seq + 1) % ncount)], unames[1 + ((seq + 1) % ncount)])
          on conflict (task_id, user_id) do nothing;
        end if;
        seq := seq + 1;
      end loop;

      -- ein paar Aufgaben schon als erledigt markieren
      update smt_tasks set done = true, done_by = uids[1], done_by_name = unames[1], done_at = now()
      where id in (select id from smt_tasks where event_id = ev_id order by sort_order limit 3);
    end if;

    raise notice 'Saubermachtag 19.09.2026 angelegt (Test-Logins gefunden: %).', ncount;
  else
    raise notice 'Saubermachtag am 19.09.2026 existiert bereits - uebersprungen.';
  end if;
end $$;
