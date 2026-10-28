# JiTap website database setup

1. Connect JiTap's Supabase organization/project, or create a new project.
2. Open SQL Editor as project administrator and execute `migrations/20261028_website_intake.sql`.
3. Confirm `public.website_intake` exists, RLS is enabled, and function `public.submit_website_intake` is executable **only by service_role**.
4. In Vercel (not GitHub), set `SUPABASE_URL` and `SUPABASE_ANON_KEY`, plus `INTAKE_HASH_SECRET` containing at least 32 random characters.
5. Redeploy, then test all four forms with consent and observe an inserted `website_intake` record for each kind: `request`, `provider`, `contact`, `early-access`.
6. Test malformed content (422), unavailable credentials (503), repeated submissions/rate-limit (429), and the honeypot field (400).
7. Ensure only authorized JiTap personnel have access to the personal information in the table. Adopt an appropriate retention/deletion procedure.

The endpoint stores form data; it does not notify staff or dispatch providers. JiTap must add an authorized internal operations dashboard and/or notification integration before treating enquiries as operationally handled.

The unique `reference` returned by the API confirms storage, **not provider assignment or booking**.

A database backup and monitoring policy should be established before launch. Do not use the anon key or expose a service-role credential in client code.

### Server-only RPC token
The Vercel backend authenticates intake requests with the server-only `INTAKE_RPC_TOKEN`. The Supabase `jitap_private.intake_tokens` table stores a SHA-256 hash of that token. `SUPABASE_ANON_KEY` is used only from server code alongside this token. Never publish the token or embed it in browser JavaScript. Rotate it by provisioning a new hashed token, changing the Vercel secret, redeploying, and retiring the old hash.
