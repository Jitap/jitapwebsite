# JiTap provider BUZZ and SOC WhatsApp template setup
**Created:** 12 November 2026
**Status:** Code is implemented; Meta/Kapso template approval and Vercel configuration still required for WhatsApp API sending.

JiTap's SMS and WhatsApp provider alerts are dispatched automatically when a coordinator creates a NEW provider assignment and the provider's corresponding channel opt-in is recorded. Supabase trigger `jitap_auto_alert_new_assignment` creates a unique per-assignment, per-channel queue job. JiTap attempts immediate delivery and the protected `/api/cron/kapso` route processes pending notifications every five minutes.

## Provider SMS
Wasiliana `WASILIANA_API_KEY` and `WASILIANA_SENDER_ID` must be configured. SMS uses:
JiTap BUZZ | JT-XXXXXXXX
Service: Plumbing
Reported issue: Sink leaking
Respond: https://jitap.app/buzz#<unique 72h token>

Only reference, trade, issue, secure link; details remain in the ticket. WhatsApp and SMS consent are independent. Each assignment has at most one attempt per channel; transport uncertainty is not silently retried.

## Required provider WhatsApp template
1. Create and submit a **utility** template for review in Meta / Kapso, suggested name `jitap_provider_buzz`. Do not send until its approval is confirmed.
2. Language `en_US` (or coordinate with `KAPSO_TEMPLATE_LANGUAGE`).
3. Body uses **exactly 3 text variables** in this order: `{{1}}` = JT-reference, `{{2}}` = service category, `{{3}}` = short issue.
   Suggested approved body: `JiTap BUZZ {{1}}\nService: {{2}}\nReported issue: {{3}}\nTap Respond to review and respond to the service request.`
4. Add a dynamic **Visit Website** URL button at index 0 labeled `Respond` with static prefix `https://jitap.app/buzz#` and dynamic suffix `{{1}}` (the 43-character secret response token). Confirm Meta supports the secure URL configuration as intended. Do NOT use the public JT-reference as a bearer token.
5. Set `KAPSO_TEMPLATE_PROVIDER_BUZZ=jitap_provider_buzz` in Vercel production **only after approved**. Existing `KAPSO_ENABLED`, `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID` are also required.

## Required SOC customer-update WhatsApp template
1. Create a second approved **utility** template, e.g. `jitap_soc_update`.
2. Body uses `{{1}}`=JT-reference, `{{2}}`=update type, `{{3}}`=short update. Example: `JiTap update {{1}} ({{2}}): {{3}}. Open your request to see details.`
3. URL button at index 0 should open the existing **customer ticket** using the JT-reference suffix `{{1}}`. Check the URL base against the approved existing JiTap booking-template button contract.
4. Set `KAPSO_TEMPLATE_SOC_UPDATE=jitap_soc_update` in Vercel production once approved.
5. In SOD, save a customer update draft, select WhatsApp, and press **Send customer WhatsApp now via Kapso**. SOD records API submission and attempts; do not equate provider acceptance with handset delivery.

## Consent source of truth
`provider_notification_contacts.sms_opt_in` and `whatsapp_opt_in` determine separate channel eligibility. A verbal acceptance **must be recorded for the individual provider** by an authorized admin in SOD with a source note. Do not mass-enable WhatsApp based solely on earlier SMS consent.

## Operations / recovery
- SOD provider assignment shows current alert state `pending | sending | submitted | rejected | unknown | blocked | skipped`.
- `submitted` = the gateway accepted the message, **not** that the recipient handset received it.
- `blocked` due to unapproved template is safe to requeue by an SOC manual WhatsApp button after approval.
- `unknown` and `sending` require provider gateway reconciliation before any attempted resend.
- New assignments only; deployment intentionally does not bulk-notify historical assignments.
- Confirm actual Wasiliana sender and Kapso template approval with a **consenting test provider** before wider rollout.
