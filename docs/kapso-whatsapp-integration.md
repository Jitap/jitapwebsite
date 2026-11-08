# JiTap · Kapso WhatsApp deployment and approval

Kapso is JiTap's WhatsApp Business API integration. Wasiliana remains responsible for SMS and OTP. Do not reintroduce SMSLeopard.

## Runtime

Production environment (Vercel project `jitapwebsite`):
- `KAPSO_API_KEY` (sensitive, server-only, configured)
- `KAPSO_PHONE_NUMBER_ID` (server-only, configured)
- `KAPSO_WEBHOOK_SECRET` (sensitive, server-only, configured)
- `KAPSO_API_BASE_URL=https://api.kapso.ai/meta/whatsapp`
- `KAPSO_ENABLED=false` until Meta approves the templates below and Kapso webhook is registered
- `KAPSO_TEMPLATE_LANGUAGE=en_US`
- `KAPSO_TEMPLATE_BOOKING=jitap_booking_confirmed`
- `KAPSO_TEMPLATE_REMINDER=jitap_appointment_reminder`
- `KAPSO_TEMPLATE_CANCELLATION=jitap_booking_cancelled`
- `KAPSO_TEMPLATE_REMATCH=jitap_rematch_approved`
- `KAPSO_TEMPLATE_RESCHEDULE=jitap_booking_rescheduled`
- `CRON_SECRET` (existing; used by the Vercel cron dispatcher)

## Create and obtain approval for Utility templates

Create five templates in the Kapso templates area for the connected WhatsApp Business Account; select **Utility** and **English (US)**. All templates have **four text body parameters**, in this exact order:
`{{1}}` customer name, `{{2}}` JiTap reference, `{{3}}` service title, `{{4}}` secure customer tracking link.

Suggested bodies, edit if required by Meta policy:

**jitap_booking_confirmed**
`Hi {{1}}, your JiTap booking {{2}} for {{3}} is confirmed. View your provider and job details: {{4}}`

**jitap_appointment_reminder**
`Hi {{1}}, this is a reminder about your JiTap booking {{2}} for {{3}}. Check your scheduled time and job details: {{4}}`

**jitap_booking_cancelled**
`Hi {{1}}, the provider for JiTap booking {{2}} ({{3}}) has cancelled. Please review your request and approve or decline a rematch: {{4}}`

**jitap_rematch_approved**
`Hi {{1}}, JiTap is looking for a replacement provider for booking {{2}} ({{3}}). Track the request here: {{4}}`

**jitap_booking_rescheduled**
`Hi {{1}}, the scheduled time for JiTap booking {{2}} ({{3}}) has changed. See the current confirmed schedule: {{4}}`

The API does not bypass WhatsApp's 24-hour customer service window. All business-initiated notifications are sent as Meta-approved template messages. Template names and parameter counts must match the **approved** versions.

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
- Vercel calls `GET /api/cron/kapso` every 5 minutes with `Authorization: Bearer <CRON_SECRET>`. Job actions additionally request immediate dispatch.
- The signed Kapso webhook records delivery receipts and customer replies in SOD. Failed delivery or inbound customer follow-up may flag SOC intervention.

## Enable

1. Confirm all five templates show **APPROVED** in Kapso and match the four body variables.
2. Confirm the webhook is configured on the correct phone number, has a matching signature secret, and a signed test event succeeds.
3. Set `KAPSO_ENABLED=true` in Vercel Production.
4. Trigger a redeployment. Create a **consented synthetic test booking** on an authorized test WhatsApp number and verify sent, delivered, read (when read) and SOC audit.
5. Leave Wasiliana SMS and Supabase OTP unchanged. Keep SMSLeopard credentials unused until final clean-up.

**Do not enable live traffic before templates and webhook are verified.**

## Notes
- The provider calendar's own browser reminders are independent of the transactional customer WhatsApp reminders.
- Kapso endpoints and Meta policies can evolve; check https://kapso.com/whatsapp-cloud-api for current sending requirements.
- The SOD case details include the WhatsApp delivery audit. The queue contains no API keys.
