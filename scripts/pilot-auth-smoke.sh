#!/usr/bin/env bash
# Auth golden path — local or staging. Requires a fresh OTP after `action: send`.
#
#   cp .env.production.example .env.local   # SUPABASE_* for `npm run dev`
#   npm run dev
#
#   PILOT_API_BASE=http://localhost:3000 \
#   PILOT_TEST_PHONE=+2547XXXXXXXX \
#   PILOT_TEST_OTP=123456 \
#   ./scripts/pilot-auth-smoke.sh
#
# Against Vercel preview (env already on host):
#   PILOT_API_BASE=https://jitapwebsite-xxx.vercel.app ...
set -euo pipefail

BASE="${PILOT_API_BASE:-http://localhost:3000}"
PHONE="${PILOT_TEST_PHONE:-}"
CODE="${PILOT_TEST_OTP:-}"
ROLE="${PILOT_TEST_ROLE:-customer}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

json_field() {
  node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      const j=JSON.parse(d);
      const v=j['$1'];
      if(v===undefined||v===null) process.exit(2);
      console.log(String(v));
    });
  "
}

echo "== JiTap auth smoke =="
echo "Base: $BASE"

CODE_NOAUTH="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/auth/session")"
if [[ "$CODE_NOAUTH" != "401" ]]; then
  echo "FAIL: GET /api/auth/session without auth expected 401, got $CODE_NOAUTH"
  exit 1
fi
echo "OK  unauthenticated session → 401"

if [[ -z "$PHONE" || -z "$CODE" ]]; then
  echo "Set PILOT_TEST_PHONE and PILOT_TEST_OTP to run live auth (send OTP first via POST .../phone action send)."
  echo "Unit tests only: npm run test:auth"
  exit 0
fi

echo "-- Mobile OTP verify --"
MOBILE_RESP="$(curl -sfS -X POST "$BASE/api/auth/phone" \
  -H 'Content-Type: application/json' \
  -H 'X-JiTap-Client: mobile' \
  -d "{\"phone\":\"$PHONE\",\"action\":\"verify\",\"code\":\"$CODE\",\"role\":\"$ROLE\",\"consent\":true}")"

ACCESS="$(echo "$MOBILE_RESP" | json_field accessToken)" || {
  echo "FAIL: mobile verify missing accessToken"
  exit 1
}
REFRESH="$(echo "$MOBILE_RESP" | json_field refreshToken)" || {
  echo "FAIL: mobile verify missing refreshToken"
  exit 1
}
echo "$MOBILE_RESP" | json_field expiresIn >/dev/null || {
  echo "FAIL: mobile verify missing expiresIn"
  exit 1
}
echo "OK  mobile verify returns token triple"

SESSION_MOBILE="$(curl -sfS "$BASE/api/auth/session" -H "Authorization: Bearer $ACCESS")"
echo "$SESSION_MOBILE" | json_field authenticated | grep -qx true || {
  echo "FAIL: Bearer session not authenticated"
  exit 1
}
echo "OK  GET /api/auth/session with Bearer"

echo "-- Refresh --"
REFRESH_RESP="$(curl -sfS -X POST "$BASE/api/auth/refresh" \
  -H 'Content-Type: application/json' \
  -H 'X-JiTap-Client: mobile' \
  -d "{\"refreshToken\":\"$REFRESH\"}")"
ACCESS2="$(echo "$REFRESH_RESP" | json_field accessToken)" || exit 1
echo "$REFRESH_RESP" | json_field refreshToken >/dev/null || exit 1
echo "OK  POST /api/auth/refresh"

SESSION2="$(curl -sfS "$BASE/api/auth/session" -H "Authorization: Bearer $ACCESS2")"
echo "$SESSION2" | json_field authenticated | grep -qx true || {
  echo "FAIL: refreshed Bearer session not authenticated"
  exit 1
}
echo "OK  GET /api/auth/session with refreshed Bearer"

# Provider accounts need X-JiTap-Mode: customer for /api/account/* (mirrors jt_mode cookie).
REQ_CODE="$(curl -sS -o /tmp/jitap-smoke-requests.json -w '%{http_code}' \
  "$BASE/api/account/requests" \
  -H "Authorization: Bearer $ACCESS2" \
  -H 'X-JiTap-Mode: customer')"
if [[ "$REQ_CODE" == "200" ]]; then
  echo "OK  protected route /api/account/requests with refreshed Bearer"
elif [[ "$REQ_CODE" == "401" || "$REQ_CODE" == "403" ]]; then
  echo "FAIL: /api/account/requests auth rejected → HTTP $REQ_CODE"
  head -c 400 /tmp/jitap-smoke-requests.json; echo
  exit 1
else
  # Local often lacks coordinator service-role secret → 500 after auth succeeds.
  echo "WARN /api/account/requests → HTTP $REQ_CODE (auth passed; non-auth env/data issue)"
  head -c 200 /tmp/jitap-smoke-requests.json; echo
fi

if [[ "${PILOT_SMOKE_WEB:-1}" == "1" ]]; then
  echo "-- Web cookie path (same OTP; may fail if code already consumed — set PILOT_SMOKE_WEB=0) --"
  WEB_RESP="$(curl -sfS -c "$JAR" -X POST "$BASE/api/auth/phone" \
    -H 'Content-Type: application/json' \
    -d "{\"phone\":\"$PHONE\",\"action\":\"verify\",\"code\":\"$CODE\",\"role\":\"$ROLE\",\"consent\":true}")" 2>/dev/null || true
  if [[ -n "$WEB_RESP" ]] && echo "$WEB_RESP" | json_field authenticated 2>/dev/null | grep -qx true; then
    echo "$WEB_RESP" | json_field accessToken 2>/dev/null && {
      echo "WARN: web verify returned accessToken in body (unexpected)"
    } || true
    COOKIE_SESSION="$(curl -sfS -b "$JAR" "$BASE/api/auth/session")"
    echo "$COOKIE_SESSION" | json_field authenticated | grep -qx true || {
      echo "FAIL: cookie session"
      exit 1
    }
    echo "OK  web cookies + GET /api/auth/session"
  else
    echo "SKIP web cookie path (OTP single-use — run send+verify again with PILOT_SMOKE_WEB=1)"
  fi
fi

echo "Smoke complete."
