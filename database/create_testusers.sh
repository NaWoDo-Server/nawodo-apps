#!/bin/bash
# Legt 10 echte Login-Accounts (Testuser1-10) über die offizielle Supabase-Admin-API an
# (genau der Weg, den auch "Neuer Benutzer" in Settings intern nutzt) und dazu passende
# Mitglieder-Profile mit fiktiven Adressen/Telefonnummern/Geburtstagen.
# Login-Email jeweils: testuser<N>@testnawodo.de
# Passwort (für alle 10 gleich, nur zum Testen): NaWoDoTest2026!
#
# Ersetzt die alten Platzhalter-Testuser ohne Login (@nawodo-test.local) aus dem vorherigen
# Lauf - die werden zuerst gelöscht.
#
# Rechte/Rollen NICHT gesetzt - das übernimmt Lars von Hand in Settings.
#
# Ausführen: bash ~/nawodo-apps/database/create_testusers.sh

set -e
SUPABASE_URL="https://api.nawodo.de"
PASSWORD="NaWoDoTest2026!"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq wird benötigt, installiere..."
  apt-get update -qq && apt-get install -y -qq jq
fi

SERVICE_ROLE_KEY=""
for c in supabase-auth supabase-kong supabase-rest supabase-storage; do
  SERVICE_ROLE_KEY=$(docker inspect "$c" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^SERVICE_ROLE_KEY=' | head -1 | cut -d= -f2-)
  if [ -n "$SERVICE_ROLE_KEY" ]; then break; fi
done

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Konnte SERVICE_ROLE_KEY nicht automatisch finden (in keinem der Container supabase-auth/kong/rest/storage)."
  echo "Bitte in diesem Skript oben SERVICE_ROLE_KEY manuell eintragen und erneut ausführen."
  exit 1
fi

echo "Service-Role-Key gefunden. Entferne alte Platzhalter-Testuser (falls vorhanden)..."
curl -s -X DELETE "$SUPABASE_URL/rest/v1/members?email=like.*@nawodo-test.local" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" > /dev/null

VORNAME=(Testuser1 Testuser2 Testuser3 Testuser4 Testuser5 Testuser6 Testuser7 Testuser8 Testuser9 Testuser10)
NACHNAME=(Ahrens Bergmann Cordes Dietrich Ehlers Frank Gerlach Hartmann Imhoff Jansen)
STRASSE=("Kölner Straße" "Further Straße" "Nievenheimer Straße" "Chempark Allee" "Rheinstraße" "Sankt-Michael-Straße" "Bahnhofstraße" "Zonser Straße" "Delrather Straße" "Hackenbroicher Straße")
HAUSNR=(12 7 23 5 18 3 41 9 27 14)
TELEFON=("02133 100001" "02133 100002" "02133 100003" "02133 100004" "02133 100005" "02133 100006" "02133 100007" "02133 100008" "02133 100009" "02133 100010")
HANDY=("0170 1000001" "0170 1000002" "0170 1000003" "0170 1000004" "0170 1000005" "0170 1000006" "0170 1000007" "0170 1000008" "0170 1000009" "0170 1000010")
GEBURTSTAG=("1985-03-14" "1990-07-22" "1978-11-02" "1995-01-30" "1982-09-09" "1988-05-17" "1973-12-24" "1992-06-06" "1980-02-19" "1997-10-11")

for i in $(seq 0 9); do
  n=$((i+1))
  email="testuser${n}@testnawodo.de"
  vorname="${VORNAME[$i]}"
  echo "Lege $vorname an ($email)..."

  created=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"name\":\"$vorname\"}}")

  user_id=$(echo "$created" | jq -r '.id // empty')
  if [ -z "$user_id" ]; then
    echo "  Fehler beim Anlegen von $email:"
    echo "  $created"
    continue
  fi

  curl -s -X POST "$SUPABASE_URL/rest/v1/members" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" -H "Prefer: return=minimal" \
    -d "{\"user_id\":\"$user_id\",\"vorname\":\"$vorname\",\"nachname\":\"${NACHNAME[$i]}\",\"strasse\":\"${STRASSE[$i]}\",\"hausnummer\":\"${HAUSNR[$i]}\",\"plz\":\"41540\",\"wohnort\":\"Dormagen\",\"telefon\":\"${TELEFON[$i]}\",\"handy\":\"${HANDY[$i]}\",\"geburtstag\":\"${GEBURTSTAG[$i]}\",\"email\":\"$email\",\"is_child\":false,\"mitgliedstyp\":\"mitglied\",\"created_by\":\"$user_id\"}" > /dev/null

  echo "  OK: $vorname -> $user_id"
done

echo "Fertig."
