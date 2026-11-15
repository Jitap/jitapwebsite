# JiTap Native Background BUZZ — Aly integration handoff

**Status: backend deployed; native integration reference delivered.** Only the web repository is connected to this project. Aly must copy the two source templates into her React Native + Expo app, install dependencies, configure app identity/EAS push credentials, and produce tested Android/iOS builds. Do **not** claim physical device delivery until FCM/APNs tests pass.

## Implemented backend

- `POST /api/mobile/push-devices` — bearer-token-only verified provider register/revoke (no cookies, no client-supplied provider user ID). Max five devices per provider; encrypted transport; private RLS.
- `GET /api/mobile/wave-buzz?requestId=<uuid>` — checks the authenticated provider's exact offer and deadline every time a notification is opened; private brief excludes contact/coordinates.
- `POST /api/mobile/wave-buzz` — accepts/declines via existing transactional first-to-accept lock.
- `jitap_wave_push_outbox` — one row per provider offer/device, created atomically with GPS ring dispatch. Expired/matched/declined offers are never newly sent.
- Supabase Edge `jitap-wave-push` — short-lived Expo pushes (up to the underlying offer deadline), with Expo push-ticket and 15-minute receipt reconciliation; disables invalid devices.
- Supabase `pg_cron` `jitap-native-wave-push` every 5 seconds, authorized by private Supabase Vault secret. Do not copy the secret into mobile code.
- Android priority high with `jitap-buzz` notification channel; iOS default sound and time-sensitive level. Both depend on user preferences, device OS and valid FCM/APNs configuration.

## Native steps

1. Use Aly's **existing Expo app** and Supabase authenticated provider session. Install packages with `npx expo install expo-notifications expo-constants expo-crypto expo-secure-store`.
2. Configure Expo `app.json` plugin `expo-notifications`, real Android package and iOS bundle IDs, and immutable EAS project ID. Do not invent or change these IDs.
3. Configure FCM V1 credentials for Android and APNs credentials for iOS in EAS; build signed development/preview apps. Remote push does **not** work in Android Expo Go.
4. Copy `native-notifications.ts.txt` to the mobile codebase as `native-wave-buzz.ts`; copy `WaveBuzzOfferScreen.tsx.txt` as a component, wired to Expo Router's `/provider/buzz/[requestId]` route.
5. Ask for **notification permission** after verified provider login, preferably when the provider opts into receiving incoming job BUZZ. Request GPS when they tap Online as previously agreed; notification permission and GPS permission are separate.
6. Obtain Expo token using the EAS project ID, register it using a Supabase **access JWT** (not anon key or service-role key). Persist the stable per-install `deviceId` in SecureStore. Re-register rotated tokens and revoke the device on logout.
7. In the app root, configure foreground notification handler and register notification response/cold-start listeners. When a BUZZ is tapped, open the `/provider/buzz/[requestId]` screen. Call the GET route to confirm state/expiry before rendering Accept/Decline. Expired alerts must show "BUZZ ended".
8. On Accept/Decline, call POST and use the returned database status; never infer matching from receiving the push, sending a response, or playing an animation.
9. Set up optional Expo Push Service enhanced security: if enabled on the Expo dashboard, configure `EXPO_ACCESS_TOKEN` **only** as a Supabase Edge Function secret. Never embed that access token in the mobile app.
10. Test all paths in signed Android/iOS builds: foreground, background, locked screen, terminated app with notification tap, denial and revocation, stale push, two providers accepting at once, and 15-second offer expiry.

## Mobile transport contract

Register:
```http
POST https://jitap.app/api/mobile/push-devices
Authorization: Bearer <provider Supabase access JWT>
Content-Type: application/json

{"action":"register","deviceId":"<installation UUID>","platform":"android","expoPushToken":"ExpoPushToken[...]" }
```

Revoke:
```json
{"action":"revoke","deviceId":"<same installation UUID>"}
```

Tap: `GET /api/mobile/wave-buzz?requestId=UUID` with bearer JWT.

Respond:
```json
{"requestId":"UUID","decision":"accepted"}
```

The push contains only `{type:"jitap_wave_buzz",requestId,expiresAt}`, a generic service-category message, and an offer-bounded push expiry. It does **not** contain customer phones, complete service brief/photos or exact GPS addresses.

## Delivery guarantees and failure handling

Expo ticket `ok` means accepted by Expo, **not delivered to a handset**. Expo receipt `ok` means upstream FCM/APNs acknowledged, not necessarily visible on the phone. Confirm real delivery using device-side logging and physical testing. Expo does not guarantee immediate background delivery; OS battery restrictions and Focus/Do Not Disturb can delay notifications. JiTap's atomic first-to-accept and offer deadline remain authoritative regardless.

No automatic push retry follows an ambiguous transport timeout to avoid duplicate alerts. Existing SOD coordination and consented SMS remain available as fallback. Native OS push is not a guaranteed ringing full-screen incoming call.

**Do not request Android background location or iOS Always Location just to receive push notifications.** They are separate permissions with stricter platform review requirements.
