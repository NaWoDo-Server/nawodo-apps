#!/usr/bin/env python3
"""
Holt alle Buchungen von der alten Seite (dazzling-fox-0afe11.netlify.app)
und gleicht sie mit der neuen Datenbank ab:
- neue/geänderte Buchungen von der alten Seite -> werden angelegt/aktualisiert
- auf der alten Seite gelöschte Buchungen -> werden auch hier entfernt
- Buchungen, die direkt in der neuen App angelegt wurden (ohne Herkunft von
  der alten Seite), werden NIEMALS angefasst.

Läuft per Cronjob alle 15 Minuten. Läuft still (kein Output), außer bei Fehlern.
"""
import json
import subprocess
import sys
import urllib.request

OLD_URL = "https://ciwtapsxxdjmklmehyby.supabase.co"
OLD_KEY = "sb_publishable_-9YhpmfPD5zIues_UA6Nsw_Kdehmbqk"


def fetch(path):
    req = urllib.request.Request(OLD_URL + path, headers={"apikey": OLD_KEY})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def esc(s):
    return (s or "").replace("'", "''")


def main():
    cats = fetch("/rest/v1/categories?select=id,name")
    resources = fetch("/rest/v1/resources?select=id,name,category_id")
    res_by_id = {r["id"]: r["name"] for r in resources}
    bookings = fetch("/rest/v1/bookings?select=*")

    values = []
    ids = []
    skipped = []
    for b in bookings:
        rname = res_by_id.get(b.get("resource_id"))
        if not rname:
            skipped.append(b.get("id"))
            continue
        ids.append(f"'{b['id']}'")
        end_date = f"'{b['end_date']}'" if b.get("end_date") else "null"
        title = f"'{esc(b.get('title'))}'" if b.get("title") else "null"
        note = f"'{esc(b.get('note'))}'" if b.get("note") else "null"
        all_day = "true" if b.get("all_day") else "false"
        values.append(
            "('{eid}', (select id from resources where name = '{rname}' limit 1), "
            "'{date}', {end_date}, '{start}', '{end}', {all_day}, '{name}', {title}, {note})".format(
                eid=b["id"],
                rname=esc(rname),
                date=b["date"],
                end_date=end_date,
                start=b["start_time"],
                end=b["end_time"],
                all_day=all_day,
                name=esc(b["name"]),
                title=title,
                note=note,
            )
        )

    sql_parts = []

    if values:
        sql_parts.append(
            "insert into bookings (external_id, resource_id, date, end_date, start_time, "
            "end_time, all_day, name, title, note) values\n"
            + ",\n".join(values)
            + "\n"
            "on conflict (external_id) do update set\n"
            "  resource_id = excluded.resource_id, date = excluded.date, end_date = excluded.end_date,\n"
            "  start_time = excluded.start_time, end_time = excluded.end_time, all_day = excluded.all_day,\n"
            "  name = excluded.name, title = excluded.title, note = excluded.note;"
        )

    id_list = ",".join(ids) if ids else "'00000000-0000-0000-0000-000000000000'"
    sql_parts.append(
        f"delete from bookings where external_id is not null and external_id not in ({id_list});"
    )

    full_sql = "\n\n".join(sql_parts)

    proc = subprocess.run(
        ["docker", "exec", "-i", "supabase-db", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
        input=full_sql,
        capture_output=True,
        text=True,
    )

    if proc.returncode != 0:
        print("FEHLER beim Sync:", proc.stderr, file=sys.stderr)
        sys.exit(1)

    if skipped:
        print(f"Warnung: {len(skipped)} Buchung(en) übersprungen, Ressource nicht gefunden: {skipped}")


if __name__ == "__main__":
    main()
