# JiTap Provider Location Requirement — Android & iOS (Aly)

## Product decision (15 November 2026)

**Providers must grant precise location permission before switching Online and receiving nearby Wave Buzz requests.** This is an availability prerequisite, **not** a condition for creating an account, completing KYC, opening a profile, viewing existing bookings, or going Offline. Do not force an OS permission grant: if declined, display a short explanation and leave the provider Offline.

Provider-facing copy, short and calm:

> To receive jobs near you, allow JiTap to use your precise location while you're available.

If declined:

> Enable precise location in your phone settings to go online and receive nearby jobs.

If permission is revoked or location becomes stale, suspend live matching and show Offline. Explain how to re-enable GPS. Provider can always turn Online off, which deletes their live GPS location row.

## Existing web implementation

- Provider Online switch: `src/app/provider/page.tsx` requests a high-accuracy GPS fix via the device's location permission dialog before calling `POST /api/provider/workspace`.
- Online API: `{ "action": "availability", "online": true, "latitude": -4.0, "longitude": 39.7 }`. Server verifies approved provider and saves the position with `observed_at`. Backend trigger denies any attempt to set `is_online=true` without fresh, opted-in GPS.
- Offline API: `{ "action": "availability", "online": false }`. Server marks the provider Offline and deletes the stored Wave Buzz GPS.
- GPS refresh for already-online providers: `POST /api/provider/wave-buzz` with `{ "action":"location", "sharing":true, "latitude": ..., "longitude": ... }`; geolocation is automatically refreshed in a visible web tab about every four minutes.
- A minute-based Supabase job marks sessions Offline when precise location updates are older than 15 minutes and cleans up stale location rows. Only fresh, verified, online provider positions qualify for waves.
- A provider may also send `{ "action":"location", "sharing":false }` to remove location sharing, but the native client should call **availability Offline** to keep displayed status synchronized.
- Provider notification polling: `GET /api/provider/wave-buzz`. Response includes a limited job brief, countdown deadline and rounded straight-line distance; no other providers' GPS positions.
- Response: `POST /api/provider/wave-buzz` with `{ "action":"respond","requestId":"uuid","decision":"accepted"|"declined" }`. Backend locks first acceptance atomically.

## Android app implementation checklist

1. Request fine/precise location only when the provider explicitly taps Online, using the OS permission prompt and a brief purpose explanation.
2. If permission denied, approximate-only, device Location Services off, GPS timeout, or an invalid fix: remain Offline. Provide a link to the app's OS permission settings.
3. On success send precise coordinates and switch Online through the server API; do not set Online locally before server confirmation.
4. When Online, update coordinates while the app is active at intervals comfortably below the 15-minute validity limit. Show a clear availability/GPS indicator.
5. Push notification delivery for locked/background Android phones will require FCM, notification permission where required, securely registered device tokens and server-side notification dispatch; never assume a background JS timer is reliable. Evaluate background location necessity and Android foreground-service restrictions separately before requesting background location.
6. When switching Offline, remove active location and stop background updates. Do not collect GPS for providers who have not opted in.

## iOS app implementation checklist

1. Ask for **When In Use** precise location when provider taps Online, with a clear `NSLocationWhenInUseUsageDescription`; do not request Always by default.
2. Handle reduced-accuracy location, denied/restricted permission, disabled Location Services, and errors gracefully; keep provider Offline until precise permission and a usable fix are available.
3. Refresh location while the app is active and Online. For background operation, separately assess Apple's background-location entitlement and justification. Never rely on a suspended app's JavaScript loop.
4. For locked-screen alerts, add APNs registration, notification authorization, secure token storage and delivery handling; implement expiry/first-to-accept lock server-side so stale notifications never confirm a job.
5. Switching Offline should stop tracking, call the server Offline API, and delete current location.

## Native acceptance tests — Aly

- Both platforms: grant precise permission -> provider goes Online -> fresh coordinates recorded -> eligible wave arrives.
- Deny permission -> remains Offline, with actionable guidance and no new GPS record.
- Disable location/revoke permission after going Online -> no new eligible waves; within 15 minutes plus scheduler delay, provider automatically Offline.
- Go Offline -> no retained active GPS row; existing jobs/profile remain accessible.
- Native alert triggered while app is foreground/background/locked (only after FCM/APNs work is implemented). Verify wave acceptance is rejected if a different provider won or deadline expired.
- Do not claim Android/iOS notification delivery production-ready before testing on physical devices.
