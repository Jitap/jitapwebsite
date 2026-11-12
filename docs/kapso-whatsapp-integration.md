# JiTap · Kapso WhatsApp deployment and approval

Kapso is JiTap's WhatsApp Business API integration. Wasiliana remains responsible for SMS and OTP. Do not reintroduce SMSLeopard.

## Runtime

Production environment (Vercel project `jitapwebsite`):
- `KAPSO_API_KEY` (sensitive, server-only, configured)
- `KAPSO_PHONE_NUMBER_ID` (server-only, configured)
- `KAPSO_WEBHOOK_SECRET` (sensitive, server-only, configured)
- `KAPSO_API_BASE_URL=https://api.kapso.ai/meta/whatsapp`
- `KAPSO_ENABLED=false` (enabled in production once approved templates and signed webhooks were verified)
- `KAPSO_TEMPLATE_LANGUAGE=en_US`
- `KAPSO_TEMPLATE_BOOKING=jitap_booking_confirmed`
- `KAPSO_TEMPLATE_REMINDER=jitap_appointment_reminder`
- `KAPSO_TEMPLATE_CANCELLATION=jitap_booking_cancelled`
- `KAPSO_TEMPLATE_REMATCH=jitap_rematch_approved`
- `KAPSO_TEMPLATE_RESCHEDULE=jitap_booking_rescheduled`
- `CRON_SECRET` (existing; used by the Vercel cron dispatcher)

## Create and obtain approval for Utility templates

Create five **Utility**, **English (US)** templates. All templates have exactly **three body text variables**:
`{{1}}` customer name, `{{2}}` JiTap ticket ID (such as JT-342C1191), and `{{3}}` service name/title.

Add one **Call to Action → Visit Website** button, index 0, to **every** template:
- Button label: `View Booking`
- Dynamic website URL: `https://www.jitap.app/track?ref={{1}}`
- Button URL example/suffix: `JT-342C1191`

**Do not add the entire URL as a body variable.** Meta may reject full URLs in text placeholders. The button parameter is sent separately using the Service ID.

Create these templates with the exact names:

**jitap_booking_confirmed**
`Hi {{1}}, your JiTap booking {{2}} for {{3}} is confirmed. View your provider and job details using the button below.`

**jitap_appointment_reminder**
`Hi {{1}}, this is a reminder about your JiTap booking {{2}} for {{3}}. Check your appointment time and location using the button below.`

**jitap_booking_cancelled**
`Hi {{1}}, the provider for JiTap booking {{2}} ({{3}}) has cancelled. Please review your request and approve or decline a rematch using the button below.`

**jitap_rematch_approved**
`Hi {{1}}, JiTap is looking for a replacement provider for booking {{2}} ({{3}}). Track your request using the button below.`

**jitap_booking_rescheduled**
`Hi {{1}}, the scheduled time for JiTap booking {{2}} ({{3}}) has changed. See the updated schedule using the button below.`

Use sample body values `Peter`, `JT-342C1191`, `Plumbing` and the button URL suffix `JT-342C1191`. All five templates must be **APPROVED** by Meta before setting `KAPSO_ENABLED=true`. Keep Header none, Footer optional, and avoid promotional content.

## Register the signed webhook at Kapso

In Kapso's phone-number webhook settings, add:
`https://www.jitap.app/api/webhooks/kapso`

Select delivery events (sent, delivered, read, failed) and incoming messages. Select **Kapso signed webhooks** with the secret that matches Vercel's `KAPSO_WEBHOOK_SECRET`. The receiver validates the `X-Webhook-Signature` HMAC on the raw request body and deduplicates events. Do not paste credentials or secret values into code.

## Delivery lifecycle

- A provider accepting a customer request queues a booking event.
- A directly scheduled customer booking queues a booking event and a reminder (30 minutes before start).
- Cancelling a job queues a cancellation notice and suppresses the pending reminder.
- When the customer approves rematching, a rematch notice is queued.
- A confirmed schedule change queues a rescheduling update.
- A verification of explicit WhatsApp consent is required at queue creation; requests without consent are saved as `skipped` for audit.
- Supabase pg_cron calls `GET /api/cron/kapso` every 2 minutes with `Authorization: Bearer <CRON_SECRET>`. Job actions additionally request immediate dispatch.
- The signed Kapso webhook records delivery receipts and customer replies in SOD. Failed delivery or inbound customer follow-up may flag SOC intervention.

## Enable

1. Confirm all five templates remain **APPROVED** in Kapso. Each has **three body text variables plus one dynamic URL button parameter** (the fourth item in stored queue parameters).
2. Confirm the webhook is configured on the correct phone number, has a matching signature secret, and a signed test event succeeds.
3. Set `KAPSO_ENABLED=true` in Vercel Production.
4. Trigger a redeployment. Create a **consented synthetic test booking** on an authorized test WhatsApp number and verify sent, delivered, read (when read) and SOC audit.
5. Leave Wasiliana SMS and Supabase OTP unchanged. Keep SMSLeopard credentials unused until final clean-up.

**Do not enable live traffic before templates and webhook are verified.**

## Notes
- The provider calendar's own browser reminders are independent of the transactional customer WhatsApp reminders.
- Kapso endpoints and Meta policies can evolve; check https://kapso.com/whatsapp-cloud-api for current sending requirements.
- The SOD case details include the WhatsApp delivery audit. The queue contains no API keys.

## SOD lifecycle template controls (12 Nov 2026)

SOC has a five-template panel on each website request showing the latest booking, reminder, cancellation, rematch and reschedule event status. These five templates are **customer booking lifecycle messages**, not the provider BUZZ template or a generic free-form coordinator chat message.

The **Send due WhatsApp now** control dispatches only queued, consented events belonging to that request whose scheduled due time has arrived. It does not create fictional lifecycle events or send the same notification twice. The automatic signed scheduler remains enabled independently.

All five template types previously produced signed `read` receipts during authorized test sends on 10 November 2026. This verifies historical connectivity, **not** every future recipient's delivery or that a customer booking was made during the tests.
