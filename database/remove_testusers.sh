#!/bin/bash
# Entfernt die 10 Testuser-Accounts (testuser1-10@testnawodo.de) wieder vollständig
# (Login-Account + Mitglieder-Profil). Bookings/Fahrtenbuch/Workshops mit "Testuser" im
# Namen bitte separat über migration_remove_testdata.sql entfernen.
#
# Ausführen: bash ~/nawodo-apps/database/remove_testusers.sh

set -e
SUPABASE_URL="https://api.nawodo.de"

if ! command -v jq >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq jq
fi

SERVICE_ROLE_KEY=""
for envfile in /root/supabase/docker/.env "$HOME/supabase/docker/.env"; do
  if [ -f "$envfile" ]; then
    SERVICE_ROLE_KEY=$(grep '^SERVICE_ROLE_KEY=' "$envfile" | head -1 | cut -d= -f2-)
    [ -n "$SERVICE_ROLE_KEY" ] && break
  fi
done

if [ -z "$SERVICE_ROLE_KEY" ]; then
  for c in supabase-auth supabase-kong supabase-rest supabase-storage; do
    SERVICE_ROLE_KEY=$(docker inspect "$c" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^SERVICE_ROLE_KEY=' | head -1 | cut -d= -f2-)
    [ -n "$SERVICE_ROLE_KEY" ] && break
  done
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Konnte SERVICE_ROLE_KEY nicht automatisch finden (weder in /root/supabase/docker/.env noch in den Containern)."
  exit 1
fi

ids=$(curl -s "$SUPABASE_URL/rest/v1/members?email=like.*@testnawodo.de&select=user_id" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" | jq -r '.[].user_id')

for id in $ids; do
  echo "Lösche Account $id..."
  curl -s -X DELETE "$SUPABASE_URL/rest/v1/members?user_id=eq.$id" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" > /dev/null
  curl -s -X DELETE "$SUPABASE_URL/auth/v1/admin/users/$id" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" > /dev/null
done

echo "Fertig."
