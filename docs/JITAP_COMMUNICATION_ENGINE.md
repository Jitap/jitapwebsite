# JiTap SMS-first communication engine — operational contract
**Implementation:** PR #99 · 12 November 2026
**Owners:** Paul (web/SOD), Aly (Expo Android/iOS)
**Event contract:** all clients share Supabase request IDs and service-state transitions.

## 1. Channel choreography

| Transition | Channel | Recipient | Origin | Repeats |
| --- | --- | --- | --- | --- |
| Customer creates request | Wasiliana SMS | Customer | `sendRequestReceiptSms` | One request receipt |
| Verified provider is assigned | Wasiliana SMS | Provider | `jitap_queue_provider_alerts` → `dispatchProviderAlerts` | One BUZZ per assignment |
| Provider accepts through app | Kapso approved Booking WhatsApp | Customer | `jitap_provider_appointments` → `jitap_kapso_booking_events` | Once |
| Provider accepts through SOD | Kapso approved Booking WhatsApp | Customer | `jitap_soc_accepted_booking_notification` | Once |
| Provider accepts | Kapso **new approved Utility** WhatsApp | Provider | `jitap_service_followups` | Once |
| Provider confirms ETA | Kapso **new approved Utility** WhatsApp | Customer | authenticated `jitap_provider_confirm_eta` | One per meaningful ETA change |
| Provider marks On My Way | Kapso **new approved Utility** WhatsApp | Customer | `jitap_provider_job_step` status transition | Once |
| Provider arrives | Kapso **new approved Utility** WhatsApp | Customer | arrival transition | Once |
| Appointment reminder, cancellation, rematch, reschedule | Kapso existing five approved templates | Customer | existing lifecycle triggers | Per event key |
| No provider response after five minutes | Wasiliana SMS, SOC manually | Provider | `/api/coordinator/provider-reminder` | At most one reminder |
| Provider marks completed | Kapso **new approved Utility** WhatsApp | Customer | completion transition | Once |

Existing five Meta-approved booking lifecycle templates are preserved. A new WhatsApp template MUST NOT be impersonated using an unrelated approved one. The provider name is included in the pending Booking template's existing service-summary variable, where consistent with the approved template wording.

## 2. Only two new Utility templates required for follow-up delivery
The following environment variables are **not yet configured** in production as of the initial integration. Each must be submitted for approval in Meta/Kapso and tested against its actual approved placeholder structure.

| Meta Utility template suggested name | Vercel production env key | Recipient and event |
| --- | --- | --- |
| `jitap_provider_accepted` | `KAPSO_TEMPLATE_PROVIDER_ACCEPTED` | Provider: accepted job acknowledgement |
| `jitap_customer_progress` | `KAPSO_TEMPLATE_CUSTOMER_PROGRESS` | Customer: ETA, On My Way, Arrived, Completed |

**Suggested provider acknowledgement body:** `JiTap request {{1}}: {{2}}. {{3}}. View job details in JiTap.`

**Suggested customer progress body:** `JiTap update for {{1}}. Provider: {{2}}. Status: {{3}}. View your request in JiTap.`

The customer progress variable `{{3}}` contains an explicit, truthful status such as “On the way for your plumbing service”, “Estimated arrival: 12 Nov 5:30 PM EAT”, or “Arrived at the service location”. The five existing lifecycle templates remain available for booking, reminder, cancellation, rematch and reschedule.

Template format used by current sender:
- Body `{{1}}` = `JT-XXXXXXXX` request reference.
- Body `{{2}}` = provider business name (customer message) or service name (provider message).
- Body `{{3}}` = short estimated arrival or context (not the intake transcript).
- Dynamic URL button `{{1}}` = `JT-XXXXXXXX`. Configure the correct verified customer ticket / authenticated provider destination URL as the static base in Meta. Verify behavior with an opted-in test recipient before production sending.
- Language `KAPSO_TEMPLATE_LANGUAGE` (default `en_US`).

**Templates pending approval are recorded as blocked, not sent.** A blocked event can be submitted from the SOD timeline once the corresponding template is approved and the env var configured, provided the event is still current. On My Way / ETA updates expire after two hours, provider acceptance acknowledgement after 24 hours. Do not retro-send stale milestones.

## 3. Idempotency and security
- Unique event keys in `jitap_service_followups`; separate unique provider SMS assignment; unique SOC reminder per assignment.
- HTTP actions are staff/provider authenticated and validated for same origin.
- `whatsappOptIn` on customer request; provider `whatsapp_updates_opt_in` (account) or `provider_notification_contacts.whatsapp_opt_in` (SOC).
- Recheck phone and consent **at dispatch time**, not only when creating the event.
- Sensitive provider/customer phone numbers are not included in SOD notification timelines.
- Gateway states: `pending, blocked, sending, submitted, delivered, read, failed, unknown, expired, skipped`. A `submitted` result means Kapso accepted the API request; delivery and reading rely on signed webhook receipts.
- An uncertain send outcome is **not** automatically retried.
- The 2-minute protected dispatcher uses `jitap_claim_followup_events` with row locks.
- Never send a booking confirmation for a past appointment, a declined assignment, or a booking which has not been confirmed.

## 4. SOC escalation
- 0–2 minutes: provider BUZZ submitted; no intervention.
- 2–5 minutes: warning on SOD if provider has not responded.
- At 5 minutes: SOC may manually send a **single** SMS reminder, but only if original SMS was submitted and provider still has no response.
- The reminder references the **original secure BUZZ link**. It never generates a second link or invalidates the first.
- If no response after 10 minutes, SOC should source another relevant provider. Do not automatically double-assign or contact providers after they decline.

## 5. Required manual QA (do not message uninvolved real recipients)
1. Consented request created → one customer SMS event.
2. Verified provider assigned → one SMS BUZZ, secure ticket link works.
3. Provider accepts in app and in SOD on separate test requests → one customer Booking WhatsApp per request, provider name visible if the approved template permits it, no duplicate acceptance SMS.
4. Provider acknowledgement WhatsApp once new approved template is configured → provider receives readably linked job.
5. Calendar ETA and On My Way → queue event, actual Kapso message when approved, signed webhook updates SOD state.
6. Delay five minutes with no provider response → one SOC reminder SMS, second attempt blocked; provider accepts → reminder disabled.
7. Revoke WhatsApp opt-in before dispatcher → no WhatsApp sent.
8. Failed/unknown gateway outcome → no unbounded automatic retry.
9. Both Android web and Expo must display a shared request state using exactly the same API-backed event IDs.

## 6. Technical implementation
- Provider calendar: `/api/provider/calendar` + `jitap_provider_confirm_eta` RPC.
- Service event outbox: `jitap_service_followups`; scheduler `/api/cron/kapso`.
- SOD status/actions: `/api/coordinator/workflow`, `/api/coordinator/provider-reminder`, `/api/coordinator/service-followup`.
- Signed gateway receipts: `/api/webhooks/kapso` → `jitap_followup_record_receipt`.
- Customer Booking WhatsApp remains on the original approved `jitap_kapso_messages` queue.

**Do not equate an accepted service request with a confirmed appointment time.** ETA is a separate provider-confirmed value.
