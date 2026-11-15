# JiTap Wave Buzz — Geographic dispatch pilot

## Architecture

- New requests with **validated customer GPS** (and no explicitly selected provider) create a separate `jitap_wave_dispatch_jobs` row.
- A Supabase `pg_cron` job runs `jitap_wave_dispatch_tick(20)` every **5 seconds**.
- An approved provider must be online and explicitly tap **Enable precise location** in the provider dashboard. Coordinates are stored privately and only considered fresh for 15 minutes; no exact coordinates are returned to customers or other providers.
- Dispatch uses straight-line Haversine GPS distance. Wave 1 is **0–2 km, 0–15 seconds**; Wave 2 is **2–5 km, 15–30 seconds**; Wave 3 is **5–10 km, 30–45 seconds**. Each ring selects up to eight eligible providers, ordered by recorded average rating, review count and then proximity. Missing GPS is not approximated from neighborhood names.
- The provider app polls every 3 seconds **while open, online and approved**. A green incoming overlay includes sonar animation, countdown, distance, location, brief and Accept/Decline. Chimes require a user to enable sound due to browser autoplay restrictions; vibration works only in supported browsers.
- `jitap_wave_respond` serializes first acceptance with a PostgreSQL lock on the original customer request, creates the normal confirmed appointment and updates the request status to `scheduled`. All other wave offers are dismissed. Existing SMS and provider feed acceptances also dismiss competing wave offers.
- If the last active provider declines, the next geographic ring starts immediately. When the 45-second search completes without a winner, the JiTap Service Operations case is marked `needs_sourcing`. The customer request remains open.
- Existing selected-provider SMS BUZZ and 59-second offer logic are retained as separate workflows. Wave BUZZ neither invents routing ETA nor sends SMS to providers without consent.
- Privacy: GPS tables and wave rows have RLS enabled and are restricted to service-role server access. The provider endpoint gets authenticated identity from the session, not user-submitted IDs; dashboard API never shares another provider's location.
- **Simulation:** `/provider/wave-buzz` has a **Simulate New Customer Request** button with synthetic providers and GPS distances. It triggers no real notifications, messages, location requests or jobs.

## Pilot readiness / known constraints

- A provider must enable precise GPS while online. If no providers opt in, no wave notifications are created; SOD continues through the existing case workflow.
- Backgrounded browsers, closed apps, or locked phones will not reliably play audio or receive browser-page-only alerts. Background Web Push / native push plus consent, device tokens, delivery acknowledgements and reconciliation is a distinct follow-up.
- Audio is user-gesture gated; default live mode is muted until enabled. Haptics depend on device support and browser permissions.
- The live UI polls at ~3-second intervals and the server runs the dispatch tick every ~5 seconds; first accept is locked immediately in the database, while other visible overlays dismiss upon their next poll.
- Distance is GPS straight-line, **not travel ETA**. Only show an actual ETA once a grounded routing API supplies one.
- Ensure the approved provider uses real GPS opt-in during Android testing before treating production coverage as ready.

## Verification

- Automated TypeScript and routing regression checks in GitHub Actions.
- Rolled-back Supabase SQL transactions tested all three distance bands, expiry without altering a customer request, first acceptance, confirmed appointment creation, and duplicate acceptance rejection.
- Supabase `pg_cron` job checked active and successfully executing.
- Outstanding: real-provider Android camera/GPS permission, screen-off notification behaviour, direct SMS coexistence and acceptance race across multiple devices, customer confirmation, and network-failure recovery.

## Operational URLs

- Demo: https://jitap.app/provider/wave-buzz
- Provider dashboard: https://jitap.app/provider
- Asana QA: https://app.asana.com/1/1219189470858057/project/1219440805809664/task/1220447182540527
