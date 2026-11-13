# Mobile API (pilot)

Hybrid auth: web uses cookies; native uses `Authorization: Bearer <access_token>`.

**PR-W1 (this branch):** Session resolution on protected routes via `resolveAccessSession`.  
**PR-W2 (next):** Token body on OTP verify, `POST /api/auth/refresh`.

## Headers (native)

| Header | Use |
|--------|-----|
| `Authorization` | `Bearer` + Supabase access JWT |
| `X-JiTap-Client` | `mobile` (required for token response after W2) |
| `X-JiTap-Mode` | `customer` when a provider account uses customer APIs |

## Endpoints

See JiTap backend `docs/PILOT_API.md` for the full route inventory.
