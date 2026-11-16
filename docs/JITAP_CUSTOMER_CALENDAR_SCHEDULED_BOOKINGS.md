# JiTap Customer Calendar — Scheduled service bookings

## Current implementation (16 November 2026)

The homepage's middle quick action is **Calendar**, not Track Requests. Tracking still exists in bottom navigation **Requests** and in individual tracking links.

Customer: `/account?tab=calendar`.
Provider: `/provider/calendar` (pending invitations shown above existing appointments).
All times displayed in **Africa/Nairobi (EAT, UTC+3)**.

### Customer flow
1. Open Calendar, choose a date and EAT start/end time (up to 12 hours, 20 minutes–180 days ahead).
2. Choose an existing, customer-owned service request. Its trade and service area determine the eligible provider list.
3. **Save for later** makes a private draft only, no notifications.
4. **Find matching providers** lists approved provider workspaces matching **both** the request's service trade and area. Previously saved providers rank first where their verified names match; the customer can still browse the eligible list.
5. **Invite provider** creates exactly one pending asynchronous calendar invitation per request. Notification delivery requires opt-in. **No Wave BUZZ notifications are dispatched**, and any previously pending Wave BUZZ offers for the request are dismissed.
6. Provider can Accept, Decline or Propose New Time. The customer approves/rejects a proposed time in Calendar. Only confirmed decisions create a normal JiTap provider appointment. Service Operations and existing booking tracking continue to work.
7. After provider declines, the customer can select another provider; a new notification version prevents an older notification reservation from suppressing the later invitation.

### Security and integrity
- Customer signs in via verified Supabase-backed session; customer ownership of the request is checked with account ID and verified phone.
- Provider signs in via verified session; the calendar invitation endpoint is scoped to `provider_user_id` from that session.
- PostgreSQL functions are service-role-only. Mutations lock request/offer rows, reject existing accepted provider matches, incompatible provider categories/areas, schedule overlaps, invalid times, and duplicate appointments.
- The scheduled-booking table and notification-attempt ledger use RLS, with no direct public/anon/authenticated table grants.
- Before confirmation, provider invitations show category, approximate area and brief. No customer phone or exact GPS coordinate appears.
- Physical customer/provider handset tests still required. Database synthetic tests (rolled back) passed two flows: draft→invite→propose→customer accept and invite→decline→re-invite→direct accept; both created exactly one confirmed booking and no Wave BUZZ.

### Notifications
- Provider SMS is sent through the existing Wasiliana gateway **only if** the provider opted into SMS. The provider's response link opens their JiTap Calendar; service state is not dependent on SMS delivery.
- WhatsApp is designed to use the existing Kapso/Meta WhatsApp template gateway with distinct, approved **customer scheduled booking** and **provider calendar invitation** templates, only for separately opted-in accounts.
- **Important deployment blocker (verified 16 Nov):** Vercel currently has `KAPSO_TEMPLATE_BOOKING` and related legacy variables but does **not** contain the new `KAPSO_TEMPLATE_PROVIDER_CALENDAR` or `KAPSO_TEMPLATE_CUSTOMER_CALENDAR`. DO NOT substitute the legacy customer tracking template or claim WhatsApp delivery is live. Missing templates generate `needs_template` notification-ledger entries; the in-app invitation remains fully available.
- Register and get Meta approval for two templates with 3 body text variables (reference, EAT date/time, status) and a dynamic URL button respectively targeting:
  - Provider: `https://jitap.app/provider/calendar?booking={{1}}`
  - Customer: `https://jitap.app/account?tab=calendar&booking={{1}}`
  Set the approved names as Vercel production env values, and verify with consenting Android devices. Never expose API tokens.
- SMS `submitted` indicates gateway acceptance, not confirmed handset delivery; WhatsApp submission/receipt states are similarly distinct from seeing an alert.
- Attempts have a unique booking + invitation version + event + channel + role key. An ambiguous transport timeout never auto-resends (avoids duplicate notifications).
- Native Android/iOS scheduled push notifications are **not** configured in this feature; native work is separate with Aly.

### Android acceptance test
- Calendar shortcut replaces Track Requests and is visible on customer homepage.
- A customer creates a fresh service request, then chooses the Calendar, date/time, and a matching provider; Save for later does not alert anyone.
- Invite provider appears immediately on provider Calendar, even when provider is Offline; **no Wave BUZZ**.
- Consented provider receives SMS; after Meta approval, test approved WhatsApp invitation. Verify signed-in deep link, Accept→customer Confirmed, Decline→customer can select another provider, Reschedule→customer approves new time→both calendars correct.
- Confirm an already accepted request cannot be double-booked, another user's request cannot be scheduled, phone/GPS not leaked before acceptance, and invalid times or provider mismatch are rejected.
