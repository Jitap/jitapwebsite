# JiTap public website — Vercel deployment checklist

**Repository:** https://github.com/Jitap/jitapwebsite

## Hosting
1. Connect the **Vercel** account and select **Add New Project → Import Git Repository → Jitap/jitapwebsite**.
2. Use the Next.js framework preset, project root `./`, Node.js 22, `npm install` and `npm run build`.
3. Set environment variables for **Production** (and Preview for isolated test credentials): `NEXT_PUBLIC_SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `INTAKE_HASH_SECRET`.
4. Add domain `www.jitap.app` in Vercel project settings, inspect the DNS target Vercel actually provides, then update the domain's DNS records at the registrar. Do not assume or invent DNS values. If there is an existing live website, plan cutover to avoid downtime.
5. Wait for domain ownership verification and HTTPS certificate to be issued, then inspect TLS, redirects and canonical URLs.
6. Run smoke tests of landing pages, service category, request, provider, contact and early-access forms. Verify records appear in Supabase for each. Set up alerts and incident response.

## Database
Run `supabase/migrations/20261028_website_intake.sql` on the authorized Supabase project. Configured service-role credentials stay in Vercel secrets only.

## Important
- The live domain is **not** connected merely because `vercel.json` exists.
- No production credentials or infrastructure are provisioned by committing source.
- The form may return 503 until Supabase + environment variables are configured.
- Rate limits are enforced transactionally by the Supabase database function, not by local serverless memory.
- Provider acceptance, payments and dispatch remain separate product/backend work.
- Review privacy/terms text for Kenya's applicable data-protection obligations and the operational process for receiving and responding to enquiries.
- Website publishing and intake acceptance are distinct milestones. Both must be verified separately before advertising the site as live.

### Server-only RPC token
The Vercel backend authenticates intake requests with the server-only `INTAKE_RPC_TOKEN`. The Supabase `jitap_private.intake_tokens` table stores a SHA-256 hash of that token. `SUPABASE_ANON_KEY` is used only from server code alongside this token. Never publish the token or embed it in browser JavaScript. Rotate it by provisioning a new hashed token, changing the Vercel secret, redeploying, and retiring the old hash.
