# Mobile API (pilot)

Hybrid auth: **web** uses httpOnly cookies (`jt_access`, `jt_refresh`, `jt_mode`); **native** uses `Authorization: Bearer <access_token>` plus optional headers below.

Protected routes use `resolveAccessSession`: a valid Bearer is preferred; if Bearer is missing or invalid, cookie session is used (web + hybrid clients).

## Headers (native)

| Header | Use |
|--------|-----|
| `Authorization` | `Bearer` + Supabase access JWT |
| `X-JiTap-Client` | `mobile` — required on OTP verify and refresh to return tokens in JSON |
| `X-JiTap-Mode` | `customer` when a provider account calls customer APIs (replaces `jt_mode` cookie) |

## Auth flow (native)

1. `POST /api/auth/phone` `{ "action": "send", "phone", "role", "consent": true }`
2. `POST /api/auth/phone` `{ "action": "verify", "phone", "role", "code" }` with `X-JiTap-Client: mobile`  
   Response includes `accessToken`, `refreshToken`, `expiresIn` (cookies are still set; native should ignore them).
3. `GET /api/auth/session` with `Authorization: Bearer …`
4. `POST /api/auth/refresh` `{ "refreshToken": "…" }` with `X-JiTap-Client: mobile` when access JWT expires
5. `POST /api/auth/mode` with Bearer (and `X-JiTap-Mode` on later customer calls if user switches mode)

## Endpoints

See JiTap backend `docs/PILOT_API.md` for the full route inventory.

## Testing

| Layer | Command | Secrets |
|-------|---------|---------|
| Unit | `npm run test:auth` | None |
| Live HTTP | `./scripts/pilot-auth-smoke.sh` | `PILOT_API_BASE`, test phone, OTP from SMS |

Full credential list: `jiTap-backend/docs/PILOT_AUTH_TESTING.md`.
