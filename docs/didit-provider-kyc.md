# JiTap Provider KYC — Didit (V3)

## Status
The integration is installed. Live identity verification stays **disabled** until JiTap authorizes it with real Vercel production secrets, a published Didit workflow, and a signed test webhook.

## Configure Didit
Sign in at https://business.didit.me, select the intended Live application, and open **Identity Verification → Workflows**. Publish a KYC workflow with **ID Document Verification**, **Passive Liveness**, and **Face Match**. Optional device/IP analysis may be enabled if it is included in the intended plan; do not enable chargeable registry checks unintentionally. Copy the **workflow ID**.

Under **API & Webhooks** create an API key for this application. Create a **v3 webhook destination**:
- URL: `https://www.jitap.app/api/webhooks/didit`
- Events: `status.updated` (and optionally `data.updated` if later needed)
- Copy the *destination signing secret*, different from your API key.
- Use **Try Webhook** to send a signed test event; test events are ignored for production status updates.

## Vercel Production secrets
Open JiTap's Vercel project **Settings → Environment Variables** and add:

- `DIDIT_API_KEY` — API key from the Live application, **Sensitive**.
- `DIDIT_WORKFLOW_ID` — published KYC workflow UUID.
- `DIDIT_WEBHOOK_SECRET` — webhook destination's signing secret, **Sensitive**.
- `DIDIT_ENVIRONMENT=live` — already configured.
- `DIDIT_ENABLED=false` — already configured; change to **true** only after the above are configured and verification is authorized.

No Didit secret belongs in GitHub, public client JavaScript, Supabase tables, or ChatGPT messages. Vercel changes require a redeployment for the updated runtime environment.

## User journey
1. Provider signs in using existing SMS OTP and submits full name, services and service areas.
2. Provider opens **Verification** and consents to sensitive-identity processing.
3. JiTap's authenticated server creates a Didit V3 session using the provider UUID as `vendor_data`.
4. Provider is redirected to Didit's hosted capture for ID OCR, selfie/liveness and face match.
5. Didit redirects to `https://www.jitap.app/provider?identity_return=1` and sends a signed `status.updated` webhook.
6. The provider can refresh the real Didit decision. Browser URL parameters are never accepted as proof.
7. JiTap SOC sees status and (for new providers) can only approve a **live Didit Approved** identity. SOC must still independently review professional suitability.
8. Existing previously approved providers remain approved. A future Didit identity expiry triggers review.

## Security and compliance
- Persist only Didit session ID, workflow ID, status, timestamps and event IDs, never raw ID images, identification numbers or face images.
- Validate HMAC SHA-256 over the full webhook payload, enforce five-minute replay window, dedupe Didit's event UUID, require matching session/workflow/environment/vendor data.
- Provider can read only their own session under RLS; only server-side service-role operations can write.
- Provider consent must be informed, with an approved Kenyan privacy notice and retention/deletion policy before processing real users.
- Sandbox and Live applications have separate credentials and workflows. Do not test real ID images against a sandbox key.
- Use Didit's official console to investigate suspicious or declined verifications; do not copy biometric evidence into SOC or ChatGPT.

## Reference
https://docs.didit.me/integration/api-full-flow
https://docs.didit.me/integration/webhooks
https://docs.didit.me/integration/verification-statuses
