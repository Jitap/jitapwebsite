# JiTap SMSLeopard Notifications — Implementation and activation checklist

## Current implementation (4 November 2026)

- Configured Vercel environment variable names confirmed: SMSLEOPARD_API_KEY, SMSLEOPARD_API_SECRET, SMSLEOPARD_SENDER_ID, SMSLEOPARD_WA_PHONE_NUMBER_ID, JITAP_NOTIFICATIONS_ENABLED. Existing JiTap_WhatsApp_Key is not used by the new integration.
- Server-only SMSLeopard transport: `src/lib/smsleopard.ts`, using Basic authentication. SMS uses GET to `https://api.smsleopard.com/v1/sms/send` with query parameters; WhatsApp templates use POST to `https://whatsapp.smsleopard.com/v1/whatsapp/send`.
- Customer request and moving request forms show an optional, separate notification opt-in. New opted-in requests create an **unsent draft** SMS receipt in the private outbox; the request remains successful even when dispatch is disabled.
- Tables: `notification_outbox`, `notification_delivery_attempts`, `provider_notification_contacts`. These contain private data and do not grant public direct access.
- `POST /api/notifications/dispatch` requires a valid Bearer `CRON_SECRET` plus `JITAP_NOTIFICATIONS_ENABLED=true`. An atomic `claim_jitap_notifications` RPC is executable by service_role only. Each batch claims up to 5; attempts are audited. A timeout is not automatically retried.
- No public provider contact numbers are exposed by the matching UI.

## Extra Vercel Production variables needed before a controlled test

1. `SUPABASE_SERVICE_ROLE_KEY`: Supabase secret/service role key. Treat as highly privileged; server-only, no NEXT_PUBLIC prefix. Do not share in chat.
2. `CRON_SECRET`: a unique long random secret used to authenticate the dispatcher. Do not share in chat.
3. Keep `JITAP_NOTIFICATIONS_ENABLED=false` until testing and consent controls are complete.

## Operational steps before enabling live messages

1. Confirm the SMS sender ID is active and has sending credit. Confirm the WhatsApp phone number ID, not the database record ID.
2. Create Meta-approved utility templates for customer receipt, provider opportunity and acceptance confirmation. Inspect approved template IDs and required placeholder order in SMSLeopard.
3. Add provider telephone numbers and opt-in records to `provider_notification_contacts` using an authorized private administrative workflow. The public `provider_profiles` data must not contain contacts.
4. Establish job matching, response/expiry logic, and coordinator escalation. An in-app 59-second BUZZ must be controlled by server expiry, never by WhatsApp delivery timing.
5. Approve exactly one consenting test phone and move one approved draft to `pending` through an authorized operator action; trigger a protected dispatcher POST. Confirm recorded message ID, provider status and actual handset receipt.
6. Establish monitored invocation of the protected dispatcher, rate limits, retries, opt-out and authenticated delivery webhooks. Do not expose an unauthenticated send endpoint.

## IMPORTANT

A stored credential is not proof that the provider accepts the API or that WhatsApp templates have been approved. No real provider/customer notification is sent until pending work is intentionally queued and the protected dispatcher is activated. Requests currently generate drafts rather than automatically sending. Avoid running `JITAP_NOTIFICATIONS_ENABLED=true` just to 'see if it works'.

API reference:
- https://developers.smsleopard.com/sms-api/how-to-send-sms/send-sms-using-authorization-in-headers
- https://developers.smsleopard.com/whatsapp-api/sending-messages
