# JiTap Mobile Development Specification
**Version:** 0.1 — initial engineering handoff  
**Date:** 11 November 2026  
**Mobile lead:** Aly Mtsumi (Cursor / React Native + Expo)  
**Web pilot & product validation:** Paul Picasso (Next.js web / ChatGPT)  
**Status:** Proposed architecture and implementation plan; not an assertion that native components or mobile APIs have already been shipped.

## 1. Purpose and boundaries
Build an Android-first JiTap mobile application using **React Native + Expo + TypeScript**, then extend the *same* codebase to iOS. Keep https://www.jitap.app (Next.js/React) running throughout. Both clients operate against the *same authoritative JiTap backend, customer/provider identities, request state, and Supabase project*. Do not duplicate business rules, create a second production database, or move secrets into the mobile binary.

Pilot acceptance: A customer can sign in, submit a service brief (with optional photos), complete guided intake with preferred date/time, choose a precise location, receive/track provider matching and updates, and open a request from an SMS/deep link. A provider can receive relevant opportunities, respond, and update job progress with authorization enforced server-side.

## 2. Existing verified web codebase
- Repository: `Jitap/jitapwebsite`; web: `Next.js ^15.5.0`, `React ^19.1.0`, `TypeScript ^5.9.0`, `zod ^3.25.0`, Lucide React.
- Deployment: Vercel; storage, data and identities: existing Supabase.
- Selected existing server routes (inspect implementation before making mobile assumptions):
  - `/api/ai/intake` (assisted question generation; validate its security)
  - `/api/intake/request` via `/api/intake/[kind]` (service submission)
  - `/api/request/photos` (private service photo upload, currently short-lived request-scoped token)
  - `/api/account/requests`, `/api/account/track`, `/api/account/rematch`
  - `/api/auth/session`, `/api/auth/phone`, `/api/auth/mode`
  - `/api/provider/workspace`, `/api/provider/profile`, `/api/provider-buzz`
  - `/api/places`, `/api/notifications/dispatch`.
- Shared candidates for extracting after auditing browser/server dependencies: `src/lib/validators.ts`, `trade-categories.ts`, `fast-intake.ts`, `provider-options.ts`, `provider-schedule.ts`, `customer-progress.ts`, `data.ts`.
- Important limitation: existing Next.js APIs can depend on browser cookies, origin checks, or privileged server helpers. Their existence **does not mean** that calling them from Expo will work or that they are safe for native use. A mobile-aware authentication/authorization contract is a prerequisite.

## 3. Repository layout recommendation (agree before migration)
Initial low-risk option: a dedicated `jitap-mobile` repository for Aly while keeping the current web repo intact; publish or workspace-link shared types/validators as versioned packages. If the team agrees to a monorepo, migrate deliberately to `apps/web`, `apps/mobile`, `packages/domain`, `packages/api-contracts`, `packages/ui-tokens`; require CI for both apps before moving code. Do not refactor the production web structure merely to create mobile folders.

**Shared TypeScript:** Zod input/output schemas, category taxonomy, service status enum/state transitions, money/date utilities, matching request/response types, UI tokens. **Not shared verbatim:** Next.js routes, React DOM components, CSS, localStorage/IndexedDB logic, cookie-dependent authentication, privileged server modules.

## 4. Mobile stack
- Expo SDK compatible with the currently selected React Native release; TypeScript.
- Expo Router for screen/deep-link routing; TanStack Query (optional) for cached server state; React Hook Form + Zod (optional) for typed inputs.
- Expo SecureStore for suitable session material, expo-image-picker for camera/gallery, expo-location for permissioned coordinates, expo-notifications + EAS for device pushes, expo-linking / Router for deep links.
- Map/location display should use a reviewed provider integration; show exact place labels and coordinates only as needed; always request user permission.
- EAS build profiles: development, preview/internal, production. Android application ID and iOS bundle ID to be confirmed by founders before release.

## 5. Screen map and acceptance criteria
### Customer mode — Android MVP
1. **Login and mode:** phone OTP; persistent secure session; switch customer/provider without losing approved provider status.
2. **Ask JiTap:** minimalist emerald chat composer with '+' image picker, messages and question choices in one scrollable screen, keyboard-safe layout, subtle 'Understanding your request...' loading state. Do not perform image analysis on selection; attach photos to request.
3. **Scheduling:** original boxed date/time selector in East Africa Time (EAT), preferred time not misrepresented as booked availability.
4. **Matching:** emerald staggered sonar animation; display grounded provider matches and real backend statuses; respect categories and service areas.
5. **Location/contact:** select exact place/building and optional directions; **do not reconfirm already selected date/time** or repeatedly seek unchanged consents.
6. **Requests and tracking:** current status/progress, request history, matching/contact gating, provider offer/decline, cancellation/rematch, deep links from SMS.
7. **Account/network:** saved providers and My Network; verified contact information only revealed at authorized matching stage.

### Provider mode (same codebase, can be phased after customer MVP)
- Online/offline toggle, radius/service areas, category-filtered relevant live opportunities with expiry, accept/decline, calendar, job progress, switch to customer mode.
- Explicit permission and server-side checks for provider-only actions; no relying on hidden buttons alone.

### Native UX
- Emerald palette: `#008a3e` / `#10b981`; accessible contrast, touch targets, safe areas, Android back handling, loading/error/offline states, reduced-motion support. No old blue navigation in the new request flow.
- Sonar: 3–4 rings behind centered avatar/icon, 3.2s cycle, 0.8s stagger, opacity/scale animation, status 'Finding providers near you...'; never imply availability is confirmed solely from an animation.

## 6. API and security contract — Aly owns design, Paul validates business behavior
Before native implementation, write OpenAPI/typed endpoint contracts for:
- authentication: OTP challenge/verify, refresh, logout, current identity/role, mode switch; bearer tokens or other reviewed native mechanism, not fragile browser cookies;
- intake: service category/options, AI question generation, validated answer submission, preferred date/time, precise location label, idempotent request creation;
- photos: secure scoped uploads, ownership, content type/size validation, error/retry, private signed viewing when authorized;
- matching: customer candidate list, provider availability/status, accept/decline, expiry, consent-based contact disclosure;
- tracking: current request state, paginated history, progress events, request updates and cancel/rematch;
- notifications: push token registration, device revoke, preferences, server-side scheduling and fallback SMS/WhatsApp;
- network: saved providers and customer/provider relationship permissions.

**Rules:** Same database and canonical IDs; enforce authentication/role and ownership on the server; RLS where appropriate; never ship Supabase service-role keys, Gemini keys, SMS provider credentials or Vercel secrets in the app. Use idempotency keys for mutation endpoints. Apply rate limits, clear consent and upload constraints. Do not log customer phone numbers, complete GPS addresses, sensitive images, or session tokens.

## 7. Milestones / preliminary sequence
- **11–13 Nov:** architecture decision, Expo setup in Cursor, Android development build, dependency audit, API contract inventory, Google Play account review (approval expected Friday 13 Nov, not assumed).
- **14–16 Nov:** shared typed contracts; mobile auth prototype, key backend API changes; successful end-to-end dev authentication.
- **17–20 Nov:** Ask JiTap + image picker + intake, boxed scheduling, request creation and tracking, Android internal test.
- **Following phase:** provider experience, push notifications, location and deep-link hardening, iOS provisioning/build, platform-specific tests and release submissions.

These are planning targets, not guaranteed shipping dates. If native auth/API adaptation is not complete, move downstream milestones rather than bypassing security.

## 8. Definition of Done
- CI: lint/typecheck, route contract tests, Android development build, basic navigation tests.
- Android physical-device QA: OTP/mode switch, keyboard, image upload with retry, exact location, request/accept/decline/match, push/SMS link, tracking updates, logout.
- Release readiness: Google Play organizational verification and applicable testing track, privacy policy, data-safety form, account deletion, permissions disclosure, signing/build credentials. Apple Developer enrollment, App Store privacy disclosures and TestFlight separately.
- Monitoring: crash reporting with privacy safeguards; request ID correlation from mobile to backend; actionable error messages.
- Versioned, reviewed specification plus a short cross-team API change log.

## 9. Ownership and collaboration
- **Paul:** pilot QA, source-of-truth business workflows, UX approval, acceptance tests, account/store paperwork and deployment decisions.
- **Aly:** Expo architecture, mobile UI, shared TypeScript modules, native auth/API contracts and implementation, Android/iOS builds and device features.
- **Both:** weekly 30-minute contract handoff, PR review for shared/backend breaking changes, one canonical issue tracker (Asana). Open API work must be communicated to the web owner before merge.

## 10. Decisions still open
Application ID and bundle ID, Expo SDK version, GitHub workspace approach, push provider/credentials, secure mobile auth token flow, exact API versioning, Android internal testers, Apple organizational enrollment, and whether provider mode ships in the first Android test or the next release. Record outcomes in Asana.
