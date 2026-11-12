import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const url=process.env.JITAP_TEST_URL||'http://127.0.0.1:3000';
const base=new URL(url);
const tokenless={caseId:'00000000-0000-0000-0000-000000000001',recipientKind:'provider',assignmentId:'00000000-0000-0000-0000-000000000002',confirm:true};
const rejected=await fetch(base+'/api/coordinator/whatsapp',{method:'POST',headers:{'content-type':'application/json','origin':base.origin},body:JSON.stringify(tokenless),signal:AbortSignal.timeout(7000)});
assert.equal(rejected.status,401,'SOC WhatsApp cannot be used without verified staff session');
const forged=await fetch(base+'/api/coordinator/whatsapp',{method:'POST',headers:{'content-type':'application/json','origin':'https://malicious.example'},body:JSON.stringify(tokenless),signal:AbortSignal.timeout(7000)});
assert.equal(forged.status,403,'WhatsApp endpoint requires same-origin request');
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
assert.match(workflow,/Send provider WhatsApp now via Kapso/);
assert.match(workflow,/Send customer WhatsApp now via Kapso/);
console.log('PASS SOC authorization, origin, protected cron, consent and notification contracts');
