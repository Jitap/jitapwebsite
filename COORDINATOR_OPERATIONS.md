# JiTap Service Operations Coordinator Queue

## Production audit — 5 November 2026

Supabase project: `jitap-website-intake`.

| Existing source | Records | Action |
| --- | ---: | --- |
| `website_intake` kind=request | 40 | Backfilled into `coordinator_cases` as New |
| `website_intake` kind=provider | 28 | Not included in customer request queue |
| `website_intake` kind=contact | 6 | Not included |
| `website_intake` kind=early-access | 2 | Not included |
| `moving_leads` | 13 | Backfilled as Incomplete, since these lack customer_phone and intake_reference |

For the 40 website requests: 40 have description, phone and area; 8 have preferredDate; 5 have locationLabel. These are **record counts**, not confirmation that every request represents a genuine job. Coordinator must triage historical entries.

## Implemented

- Private tables `coordinator_cases`, `coordinator_activity`, `coordinator_staff`, all RLS enabled and direct SELECT/UPDATE revoked from `anon`/`authenticated`.
- Automatic triggers queue newly submitted website requests and create/update moving lead cases while keeping drafts marked Incomplete.
- Transactional RPC `coordinator_update_case` verifies staff allowlist, validates status/priority/actions, and records audited changes. Granted to service_role, not public roles.
- Server-only coordinator API `/api/coordinator/cases` reads the private queue and writes changes. Verifies actual Supabase Auth user via GoTrue + active staff email allowlist per request, not merely a cookie claim. All traffic is no-store and read-only for anonymous users.
- Staff OTP login `/coordinator` with `/api/coordinator/auth`, HTTPS-only HttpOnly cookie, one-hour access token, explicit sign-out. No refresh token persisted.
- Dashboard lists cases, triage flags (phone/location/date), status, priority, follow-up, activity notes; it does not publish customer contacts.
- Outbox / WhatsApp notifications are **not activated**.

## Staff activation (required)

Initially, `coordinator_staff` contains zero email addresses; access is deliberately locked.

After obtaining an **approved individual staff work email**, authorize that one address using the Supabase SQL editor, e.g.:

```sql
insert into public.coordinator_staff(email,role,active)
values ('approved-individual@jitap.app','admin',true)
on conflict(email) do update set active=true,role=excluded.role;
```

Use only a real email authorized by JiTap. Do not add shared customer-support inboxes unless a designated, trusted person controls them. Never reveal the service-role key in client code.

Supabase email OTP must be configured to deliver a verification code. In Supabase dashboard, Auth → Email Templates → Magic Link: use `{{ .Token }}` in the email body if OTP code is desired instead of a clickable magic link. Ensure SMTP delivery and the correct email sender. These settings have not been changed by the implementation.

Access `https://jitap.app/coordinator`, enter the exact allowlisted email and request the code. The request API responds generically to unknown emails to prevent obvious staff enumeration.

## Workflow

- New → Matching / Needs sourcing → Provider contacted → Awaiting quote → Scheduled → In progress → Completed
- Incomplete moving lead = no confirmed customer phone; do not contact until validated
- Notes and follow-up dates are auditable. Direct public provider contact listings remain private.

## Security and operations to check next

- Complete authenticated login test with the first approved staff email and actual email OTP.
- Test customer request → queue arrival → staff status update → activity history in the deployed UI.
- Review legacy Supabase SECURITY DEFINER RPC warnings on older intake functions. Existing anonymous RPC calls use application tokens, but their usage should be periodically audited and rotated.
- Add scheduled coordinator follow-up/escalation and provider responses after the verified pilot.
- Periodically examine RLS advisors. `rls_enabled_no_policy` is intentional for private server-only coordinator tables. 

No historical source record was deleted or modified during the backfill, and the transaction validation rolled back its synthetic test row.
