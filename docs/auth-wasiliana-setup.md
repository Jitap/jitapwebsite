# JiTap phone verification — Wasiliana + Supabase Auth

## Current integration
- Supabase Auth remains the ONLY issuer and verifier of OTPs.
- JiTap's signed endpoint: `https://www.jitap.app/api/auth/hooks/send-sms`.
- The endpoint validates the Supabase **Standard Webhooks** signature and timestamp before calling the server-side Wasiliana API.
- Wasiliana is the delivery gateway. The OTP is never generated in browser code or stored in a JiTap user table.
- No SMS is sent until **both** the hook secret and Wasiliana account credentials are configured. Never expose any of these in GitHub or frontend environment variables.

## Required Supabase Dashboard setup (not controlled by repository deployment)
1. Open Supabase project **jitap-website-intake** (`vqktiwdksmfkdbwmdyvl`).
2. In **Authentication > Providers > Phone**, enable phone signup and confirmation using SMS OTP; **do not enable auto-confirm**.
3. In **Authentication > Hooks > Send SMS**, select the HTTPS hook above. Supabase will generate/show a signing secret in Standard Webhooks format `v1,whsec_...`. Keep it secret.
4. In Vercel project **jitapwebsite**, set production environment variable `SUPABASE_SEND_SMS_HOOK_SECRET` to the *same* signing secret. Redeploy the production server.
5. Confirm Vercel production secrets `WASILIANA_API_KEY` and `WASILIANA_SENDER_ID` are populated with JiTap's actual authorized Wasiliana sender (do not reuse SMSLeopard credentials). The existing integration uses `POST https://api.wasiliana.com/api/v1/send/sms` and marks these messages as `is_otp: true`.
6. Set reasonable Supabase OTP send limits and expiration and enable the available abuse protections/CAPTCHA. Check SMS spending limits before launch.

## Test safely before public activation
- GET to the hook must fail; an unsigned POST must be rejected and **must not send an SMS**.
- Trigger one signup with an approved test mobile and monitor Wasiliana accepted response (do not log the OTP), SMS arrival, invalid-code rejection, successful Supabase OTP verification, HTTP-only session creation and logout.
- Test rate limits, expiry, wrong phone, sender identity, and non-delivery. Confirm the customer/provider choice does not grant provider verification or dispatch rights.
- Confirm SMS cost and authorization before testing any real number.

## Figma
The shared Figma file key is `93kvLfu9vfEEYSCUpMSIGu`. The Figma connector currently returns a permission error; request editor-level access for the connected account before mapping design nodes. Do not treat the uploaded mockup as final implementation of the provider dashboard.

## Google sign-in
Google OAuth requires Supabase Google provider configuration, OAuth Client ID/secret, approved redirect URIs and separate callback testing. It is **not enabled** by this SMS integration.
