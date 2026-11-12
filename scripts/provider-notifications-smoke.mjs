import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const url=process.env.JITAP_TEST_URL||'http://127.0.0.1:3000';
const base=new URL(url);
const tokenless={caseId:'00000000-0000-0000-0000-000000000001',recipientKind:'provider',assignmentId:'00000000-0000-0000-0000-000000000002',confirm:true};
const rejected=await fetch(base+'/api/coordinator/whatsapp',{method:'POST',headers:{'content-type':'application/json','origin':'https://'+base.host},body:JSON.stringify(tokenless),signal:AbortSignal.timeout(7000)});
assert.equal(rejected.status,401,'SOC WhatsApp cannot be used without verified staff session');
const forged=await fetch(base+'/api/coordinator/whatsapp',{method:'POST',headers:{'content-type':'application/json','origin':'https://malicious.example'},body:JSON.stringify(tokenless),signal:AbortSignal.timeout(7000)});
assert.equal(forged.status,403,'WhatsApp endpoint requires same-origin request');
const kapsoRead=await fetch(base+'/api/coordinator/kapso?caseId=00000000-0000-0000-0000-000000000001',{signal:AbortSignal.timeout(7000)});
assert.equal(kapsoRead.status,401,'Booking lifecycle template statuses must require SOC authentication');
const kapsoSend=await fetch(base+'/api/coordinator/kapso',{method:'POST',headers:{'content-type':'application/json','origin':'https://'+base.host},body:JSON.stringify({caseId:'00000000-0000-0000-0000-000000000001',action:'dispatch_due',confirm:true}),signal:AbortSignal.timeout(7000)});
assert.equal(kapsoSend.status,401,'Manual lifecycle sends must require SOC authentication');
const kapsoSource=readFileSync('src/app/api/coordinator/kapso/route.ts','utf8');
const kapsoClaim=readFileSync('supabase/migrations/20261112_kapso_case_scoped_soc_dispatch.sql','utf8');
for(const kind of ['booking','reminder','cancellation','rematch','reschedule'])
 assert.ok(kapsoSource.includes("'"+kind+"'"),'All five approved templates must appear in SOD: '+kind);
assert.match(kapsoClaim,/consent_confirmed=true/,'Due-only template sending must require customer consent');
assert.match(kapsoClaim,/due_at<=now\(\)/,'Future reminders must not send early');
assert.match(kapsoClaim,/for update skip locked/i,'SOC and cron must never double-claim the same booking event');
const confirmUnauthenticated=await fetch(base+'/api/coordinator/kapso',{method:'POST',headers:{'content-type':'application/json','origin':'https://'+base.host},body:JSON.stringify({caseId:'00000000-0000-0000-0000-000000000001',action:'confirm_accepted_booking',confirm:true}),signal:AbortSignal.timeout(7000)});
assert.equal(confirmUnauthenticated.status,401,'SOD booking confirmation must require staff sign-in');
const acceptedTrigger=readFileSync('supabase/migrations/20261112_sod_accepted_booking_whatsapp.sql','utf8');
const backfill=readFileSync('supabase/migrations/20261112_sod_reconcile_existing_booking_whatsapp.sql','utf8');
const providerSource=readFileSync('src/lib/provider-alerts.ts','utf8');
assert.ok(acceptedTrigger.includes("new.state<>'accepted'"),'SOD booking trigger must reject non-accepted states');
assert.match(acceptedTrigger,/jitap_kapso_queue_event/,'Use five approved booking templates');
assert.match(acceptedTrigger,/preferredDate/,'Do not confirm unscheduled requests');
assert.match(backfill,/whatsappOptIn/,'Explicit confirmations require customer WhatsApp consent');
assert.match(backfill,/event_key='sod-booking:'/,'Do not duplicate booking notifications');
assert.match(providerSource,/sms_previously_attempted_via_soc/,'Already-sent provider SMS must not conflict with existing links');
const reminder=await fetch(base+'/api/coordinator/provider-reminder',{method:'POST',
 headers:{'content-type':'application/json','origin':'https://'+base.host},
 body:JSON.stringify({caseId:'00000000-0000-0000-0000-000000000001',assignmentId:'00000000-0000-0000-0000-000000000002',confirm:true}),
 signal:AbortSignal.timeout(7000)});
assert.equal(reminder.status,401,'SOC SMS reminder must require authentication');
const forgedReminder=await fetch(base+'/api/coordinator/provider-reminder',{method:'POST',
 headers:{'content-type':'application/json','origin':'https://malicious.example'},
 body:JSON.stringify({caseId:'00000000-0000-0000-0000-000000000001',assignmentId:'00000000-0000-0000-0000-000000000002',confirm:true}),
 signal:AbortSignal.timeout(7000)});
assert.equal(forgedReminder.status,403,'SOC SMS reminder must enforce same-origin');
const etaUnauthenticated=await fetch(base+'/api/provider/calendar',{method:'POST',
 headers:{'content-type':'application/json','origin':'https://'+base.host},
 body:JSON.stringify({action:'confirm_eta',appointmentId:'00000000-0000-0000-0000-000000000001',eta:'2026-11-19T12:00:00+03:00'}),
 signal:AbortSignal.timeout(7000)});
assert.equal(etaUnauthenticated.status,401,'ETA updates must require provider session');
const followupSql=readFileSync('supabase/migrations/20261112_communication_followups_eta_soc_escalation.sql','utf8');
const smsFirstSql=readFileSync('supabase/migrations/20261112_sms_first_whatsapp_followups.sql','utf8');
const followupDispatcher=readFileSync('src/lib/service-followup-dispatcher.ts','utf8');
const templateSource=readFileSync('src/lib/provider-whatsapp-template.ts','utf8');
const nativeAccept=readFileSync('src/app/api/provider/workspace/route.ts','utf8');
assert.match(followupSql,/event_key text not null unique/,'Follow-up event must have unique key');
assert.match(followupSql,/after insert or update of status,provider_eta_at/,'Provider status and ETA must trigger communication');
assert.match(followupSql,/jitap_claim_followup_events/,'Private queue must claim with row locks');
assert.ok(smsFirstSql.includes("select new.id,new.case_id,'sms'"),'BUZZ contact starts with SMS only');
assert.match(followupDispatcher,/consentStillValid/,'Recheck consent at send');
assert.match(followupDispatcher,/notification_outdated/,'Do not send stale ETA updates');
assert.match(templateSource,/KAPSO_TEMPLATE_CUSTOMER_PROGRESS/,'On My Way must use an approved customer-progress template');
assert.ok(!nativeAccept.includes('notifyProviderAccepted('),'Provider acceptance must not send duplicate customer SMS');
const followupUnauthenticated=await fetch(base+'/api/coordinator/service-followup',{method:'POST',
 headers:{'content-type':'application/json','origin':'https://'+base.host},
 body:JSON.stringify({caseId:'00000000-0000-0000-0000-000000000001',eventId:'00000000-0000-0000-0000-000000000002',confirm:true}),
 signal:AbortSignal.timeout(7000)});
assert.equal(followupUnauthenticated.status,401,'SOC follow-up WhatsApp requires verified coordinator session');
const templateCode=readFileSync('src/lib/provider-whatsapp-template.ts','utf8');
const eventSql=readFileSync('supabase/migrations/20261112_communication_followups_eta_soc_escalation.sql','utf8');
const consentDispatcher=readFileSync('src/lib/service-followup-dispatcher.ts','utf8');
const reminderRoute=readFileSync('src/app/api/coordinator/provider-reminder/route.ts','utf8');
const receiptCode=readFileSync('src/app/api/webhooks/kapso/route.ts','utf8');
assert.ok(templateCode.includes("eta:'KAPSO_TEMPLATE_CUSTOMER_PROGRESS'"));
assert.ok(templateCode.includes("on_my_way:'KAPSO_TEMPLATE_CUSTOMER_PROGRESS'"));
assert.ok(templateCode.includes("arrived:'KAPSO_TEMPLATE_CUSTOMER_PROGRESS'"));
assert.ok(templateCode.includes("completed:'KAPSO_TEMPLATE_CUSTOMER_PROGRESS'"));
assert.ok(templateCode.includes("provider_accepted:'KAPSO_TEMPLATE_PROVIDER_ACCEPTED'"));
assert.match(eventSql,/event_key text not null unique/);
assert.match(eventSql,/after insert or update of status,provider_eta_at/);
assert.match(consentDispatcher,/consentStillValid/);
assert.match(consentDispatcher,/notification_outdated/);
assert.match(reminderRoute,/Date\.now\(\)-Date\.parse\(a\.assigned_at\)<5\*60000/);
assert.match(reminderRoute,/jitap_soc_provider_reminders/);
assert.match(receiptCode,/jitap_followup_record_receipt/);
const externalBooking=await fetch(base+'/api/provider/calendar/create',{method:'POST',
 headers:{'content-type':'application/json','origin':'https://'+base.host},
 body:JSON.stringify({title:'QA test job',customerName:'QA Customer',phone:'0700000000',location:'QA location',date:'2026-12-12',startTime:'10:00',endTime:'11:00',smsNotificationConsent:true}),
 signal:AbortSignal.timeout(7000)});
assert.equal(externalBooking.status,401,'Only a signed-in provider can create an externally sourced booking');
const publicTrack=await fetch(base+'/api/track/preview?ref=JT-88EEA7BC&invite=invalid',{signal:AbortSignal.timeout(7000)});
assert.equal(publicTrack.status,403,'A short reference without signed invite must not expose tracking status');
const invalidTrack=await fetch(base+'/api/track/preview?ref=invalid&invite=invalid',{signal:AbortSignal.timeout(7000)});
assert.equal(invalidTrack.status,400,'Invalid references must not be queryable');
const acquisition=readFileSync('src/lib/provider-booking-acquisition.ts','utf8');
const createRoute=readFileSync('src/app/api/provider/calendar/create/route.ts','utf8');
const trackingPage=readFileSync('src/app/track/page.tsx','utf8');
const providerForm=readFileSync('src/components/ProviderNewJob.tsx','utf8');
assert.ok(acquisition.includes('timingSafeEqual'),'Tracking link must validate MAC using constant-time comparison');
assert.ok(acquisition.includes('30*86400'),'Tracking invitations must have 30-day expiry');
assert.ok(acquisition.includes('jitap_provider_booking_sms'),'One-time SMS sends are auditable');
assert.ok(createRoute.includes('smsNotificationConsent:z.literal(true)'),'Provider must confirm SMS permission');
assert.ok(createRoute.includes('sendProviderCreatedBookingSms'),'Provider-created booking must send customer SMS');
assert.ok(trackingPage.includes('View full service details'),'Tracking landing must invite customer login/signup');
assert.ok(trackingPage.includes('/api/track/preview'),'Signed preview must precede private ticket');
assert.ok(providerForm.includes('data.smsStatus'),'Provider calendar must surface SMS gateway status');
const cron=await fetch(base+'/api/cron/kapso',{signal:AbortSignal.timeout(7000)});
assert.equal(cron.status,401,'Automated provider dispatch requires protected cron credentials');

const content=readFileSync('src/lib/provider-alerts.ts','utf8');
const template=readFileSync('src/lib/provider-whatsapp-template.ts','utf8');
const workflow=readFileSync('src/components/CoordinatorWorkflow.tsx','utf8');
const sql=readFileSync('supabase/migrations/20261112_auto_provider_alerts_soc_whatsapp.sql','utf8');
assert.match(content,/sms_opt_in.*whatsapp_opt_in/,'Per-channel opt-in remains distinct');
assert.match(content,/provider_response_links/,'Both provider channels need secure ticket link');
assert.match(content,/coordinator_sms_attempts/,'Automatic SMS must be auditable');
assert.match(sql,/unique \(assignment_id,channel\)/,'Notification jobs must be unique per assignment+channel');
assert.match(sql,/for update skip locked/i,'Queue workers must not double-claim jobs');
assert.match(sql,/after insert or update of state/i,'Alert queue must be event driven');
assert.match(template,/type:'template'/,'Business initiated WhatsApp messages require approved templates');
assert.match(workflow,/Send eligible WhatsApp via Kapso/,'SOC can send a real approved milestone');
assert.match(workflow,/Send customer WhatsApp now via Kapso/);
console.log('PASS SOC authorization, origin, protected cron, consent and notification contracts');
