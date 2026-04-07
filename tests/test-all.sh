#!/usr/bin/env bash
# ==============================================================================
# Tests API rapides (bash + curl) - alignes sur l'API Gym Central actuelle
# Pour la suite complete avec compteurs : utiliser tests/test-all.ps1 sous Windows
# Prerequis : API sur http://localhost:5000, curl, jq (optionnel pour parser)
# ==============================================================================

set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:5000/api}"

echo ">>> Health <<<"
curl -sS "$BASE_URL/../" | head -c 200 || true
echo ""

TICKS="$(date +%s)"
PHONE1="06$(printf '%08d' $((RANDOM % 100000000)))"
PHONE2="07$(printf '%08d' $((RANDOM % 100000000)))"

echo ">>> Register gym 1 <<<"
GYM1_JSON=$(curl -sS -X POST "$BASE_URL/auth/register-gym" \
  -H "Content-Type: application/json" \
  -d "{\"gymName\":\"Gold Gym Bash\",\"gymPhone\":\"$PHONE1\",\"adminUsername\":\"admin_gold_$TICKS\",\"adminPassword\":\"password123\"}")
echo "$GYM1_JSON" | head -c 400
echo ""

LOGIN1=$(curl -sS -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" \
  -d "{\"username\":\"admin_gold_$TICKS\",\"password\":\"password123\"}")
TOKEN1=$(echo "$LOGIN1" | jq -r '.token')

if [[ -z "$TOKEN1" || "$TOKEN1" == "null" ]]; then
  echo "Echec login gym1 - installer jq ou verifier l'API"
  exit 1
fi

echo ">>> Subscriptions POST <<<"
SUB_JSON=$(curl -sS -X POST "$BASE_URL/subscriptions" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN1" \
  -d '{"name":"Pass Test","price":40,"features":"test"}')
SUB_ID=$(echo "$SUB_JSON" | jq -r '.subscription.id')
echo "subscription id=$SUB_ID"

echo ">>> Member POST /members <<<"
MEM_JSON=$(curl -sS -X POST "$BASE_URL/members" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN1" \
  -d "{\"firstName\":\"Bob\",\"lastName\":\"Test\",\"email\":\"bob_$TICKS@test.com\",\"subscriptionId\":$SUB_ID}")
MEM_ID=$(echo "$MEM_JSON" | jq -r '.member.id')
echo "member id=$MEM_ID"

echo ">>> Access verify MEMBER <<<"
curl -sS -X POST "$BASE_URL/access/verify" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN1" \
  -d "{\"qr_code\":\"MEMBER-$MEM_ID\"}" | jq .

echo ">>> Ticket Seance unique (JSON UTF-8) <<<"
# Types exacts : "Séance Unique" | "Pass Journée"
TICK_JSON=$(curl -sS -X POST "$BASE_URL/tickets" \
  -H "Content-Type: application/json; charset=utf-8" -H "Authorization: Bearer $TOKEN1" \
  -d '{"type":"Séance Unique","price":12}')
TICK_ID=$(echo "$TICK_JSON" | jq -r '.ticket.id')
curl -sS -X POST "$BASE_URL/access/verify" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN1" \
  -d "{\"qr_code\":\"TICKET-$TICK_ID\"}" | jq .

echo ">>> Fin (nettoyage manuel des entites si besoin) <<<"
