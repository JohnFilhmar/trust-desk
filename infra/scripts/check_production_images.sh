#!/bin/sh
# Exercises the PRODUCTION images through the ports they publish.
#
# Start the stack first, from the repository root:
#   docker compose -f docker-compose.prod.yml -f docker-compose.prod-test.yml up --build -d
#   docker compose -f docker-compose.prod.yml -f docker-compose.prod-test.yml run --rm migrate bin/rails db:seed
# The Compose command needs every variable of docs/env-reference.md set in
# the shell, with made-up values, plus IMAGE_PREFIX and IMAGE_TAG.
#
# Then run this file. Every line prints what it got and what to expect.
# It suspends one account, so seed again afterwards.

API=${API:-http://localhost:18787}
WEB=${WEB:-http://localhost:18080}
ORIGIN=${ORIGIN:-http://localhost:18080}
JAR=$(mktemp)
KEY=0f8fad5b-d9cb-469f-a165-70867728950e
RING=9f2c4e6a8b0d1f3e5a7c9e1b3d5f7a90

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
post() { curl -s -b "$JAR" -X POST -H "Origin: $ORIGIN" -H 'Content-Type: application/json' "$@"; }

echo " 1 health, expect 200:                 $(code "$API/api/health")"
echo " 2 page, expect 200:                   $(code "$WEB/")"
echo " 3 deep link, expect 200:              $(code "$WEB/accounts/1")"
echo " 4 no session, expect 401:             $(code "$API/api/accounts")"
echo " 5 foreign origin, expect 403:         $(code -X POST -H 'Origin: https://evil.example.org' -H 'Content-Type: application/json' -d '{}' "$API/api/login")"
echo " 6 wrong password, expect 401:         $(code -X POST -H "Origin: $ORIGIN" -H 'Content-Type: application/json' -d '{"email":"enforcer@example.com","password":"wrong"}' "$API/api/login")"
echo " 7 login, expect 200:                  $(code -c "$JAR" -X POST -H "Origin: $ORIGIN" -H 'Content-Type: application/json' -d '{"email":"enforcer@example.com","password":"trust-desk-demo-2026"}' "$API/api/login")"
echo " 8 cookie is HttpOnly, expect 1:       $(grep -c '#HttpOnly_.*td_session' "$JAR")"
echo " 9 fingerprint ring, expect 12:        $(curl -s -b "$JAR" "$API/api/accounts?fingerprint=$RING&limit=50" | grep -o '"id"' | wc -l | tr -d ' ')"
echo "10 email is masked, expect ***@:       $(curl -s -b "$JAR" "$API/api/accounts?limit=1&status=active" | grep -o '"email":"[^"]*"')"

ID=$(curl -s -b "$JAR" "$API/api/accounts?limit=1&status=active" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
BODY='{"reason":"Production image check: signed call to Rails."}'

echo "11 risk of account $ID:                $(curl -s -b "$JAR" "$API/api/accounts/$ID/risk" | grep -o '"score":[0-9]*,"band":"[a-z]*"')"
echo "12 suspend, expect 201:                $(post -o /dev/null -w '%{http_code}' -H "Idempotency-Key: $KEY" -d "$BODY" "$API/api/accounts/$ID/suspend")"
echo "13 same key again, expect 201:         $(post -o /dev/null -w '%{http_code}' -H "Idempotency-Key: $KEY" -d "$BODY" "$API/api/accounts/$ID/suspend")"
echo "14 new key, expect already_suspended:  $(post -H 'Idempotency-Key: 1f8fad5b-d9cb-469f-a165-70867728950e' -d '{"reason":"Production image check: second attempt."}' "$API/api/accounts/$ID/suspend" | grep -o '"code":"[a-z_]*"')"
echo "15 suspend audit rows, expect 1:       $(curl -s -b "$JAR" "$API/api/audit_logs?account_id=$ID" | grep -o '"action":"account.suspend"' | wc -l | tr -d ' ')"
echo "16 reveal, expect true:                $(post -d '{"reason":"Production image check: reveal path."}' "$API/api/accounts/$ID/reveal" | grep -o '"pii_revealed":[a-z]*')"
echo "17 Rails from the host, expect 000:    $(code --max-time 3 http://localhost:3000/up)"
echo "18 MySQL from the host, expect closed: $( (exec 3<>/dev/tcp/127.0.0.1/3306) 2>/dev/null && echo open || echo closed)"

rm -f "$JAR"
