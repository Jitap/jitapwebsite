# JiTap notifications (SMSLeopard)

The notification transport is implemented in `src/lib/smsleopard.ts`. It is **disabled by default** and is **not yet wired into the request intake, provider matching, or automatic dispatcher**. No messages are automatically sent merely because credentials exist.

## Vercel Production environment variables

- `SMSLEOPARD_API_KEY`: API key generated in SMSLeopard.
- `SMSLEOPARD_API_SECRET`: matching API secret (keep secret).
- `SMSLEOPARD_SENDER_ID`: approved sender ID for SMS, e.g. JiTap when approved.
- `SMSLEOPARD_WA_PHONE_NUMBER_ID`: WhatsApp Business phone number ID, available after WhatsApp onboarding.
- `JITAP_NOTIFICATIONS_ENABLED`: `false` initially. Do **not** enable until opt-ins, recipient verification, rate limits, approval of templates, tests, and a protected dispatcher are implemented.

Existing `JiTap_WhatsApp_Key` does not match these names and should not be assumed to be either the API key or the secret. Use the proper named variables; never paste credentials into GitHub or chat.

## Data

`public.notification_outbox` stores private queued notification events, with RLS enabled and public roles revoked. This initial migration does not create a public sending endpoint or dispatcher. Customer and provider numbers must come from authorized private backend records, not the public provider directory.

## Next implementation milestones

1. Connect verified provider phone/WhatsApp consent records to the job matching model.
2. Create a server-only authenticated dispatch worker with idempotent claims, retries, expiry, rate limiting, audit log, and safe webhook validation.
3. Integrate template IDs and an approved test recipient for sandbox testing.
4. Enable transactional customer receipt and provider BUZZ only after production approval.
5. Protect the 59-second BUZZ deadline in JiTap's database, independently of message transport.

Official API docs: https://developers.smsleopard.com/sms-api and https://developers.smsleopard.com/whatsapp-api
