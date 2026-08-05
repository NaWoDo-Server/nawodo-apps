#!/usr/bin/env bash
# Laedt die Inspektions-Fotos in den Storage-Bucket "saubermachtag-media".
# Ausfuehren NACH schema + seed, im Ordner ~/nawodo-apps/database/:
#   bash upload_inspektion_fotos.sh
set -e
ENV=/root/supabase/docker/.env
KEY=$(grep -E '^SERVICE_ROLE_KEY=' "$ENV" | head -1 | cut -d= -f2-)
[ -z "$KEY" ] && KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV" | head -1 | cut -d= -f2-)
URL="https://api.nawodo.de"
BUCKET="saubermachtag-media"
DIR="$(dirname "$0")/seed_media/inspektion"
count=0
for path in "$DIR"/*/*; do
  rel="inspektion/$(basename "$(dirname "$path")")/$(basename "$path")"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$URL/storage/v1/object/$BUCKET/$rel" \
    -H "Authorization: Bearer $KEY" -H "apikey: $KEY" \
    -H "x-upsert: true" -H "Content-Type: image/jpeg" \
    --data-binary "@$path")
  echo "$rel -> HTTP $code"
  count=$((count+1))
done
echo "★ $count Fotos hochgeladen."
