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


## Provider assignment + human intervention (November 2026)

New private RLS tables:
- `coordinator_provider_assignments`: one provider proposal per case/provider, tracked as Proposed → Contacted → Accepted / Declined / Needs clarification / Quote requested / Quote received. Prevents two concurrently accepted providers on one case. Records quoted KES, response notes, actor and timestamps.
- `coordinator_customer_updates`: drafts prepared by staff, manually sent confirmation and sending channel. Keeps history private. There is NO automatic SMS/WhatsApp delivery yet.
- `coordinator_workflow_action`: atomic server-only RPC, accessible to service_role, validates active JiTap staff and eligible existing case/provider IDs, logs every update in coordinator_activity.

New coordinator UI sections:
- Assign a verified, public JiTap provider to a request (initially Urban Movers where relevant).
- Log a provider's acceptance, decline, information request and quotation.
- Declined or unclear provider responses change the request to Needs sourcing for human follow-up.
- Compose, edit, save and copy customer updates. Click Open WhatsApp only if the coordinator chooses; that opens a draft in WhatsApp and **does not send it**. 'Confirm sent' requires an explicit coordinator acknowledgment after actual delivery.
- Human sourcing for service types without onboarded verified providers remains driven by Needs sourcing, coordinator notes, priorities and follow-up dates.

**Important limitations:** The provider directory is not a verified private provider-contact roster. Before automatic provider outreach, onboard private provider phone/consent records and have Meta approve the pending JiTap WhatsApp templates; do not expose provider numbers in public listings. SMSLeopard dispatch remains disabled.

**Validation:** PostgreSQL RLS and private RPC privileges reviewed; Next.js production build checked. Real customer messaging and a real provider response have not been executed in an automated test.
