import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const origin = process.env.JITAP_TEST_URL || 'https://www.jitap.app';
const run = randomUUID().replaceAll('-', '').slice(0, 12);
const email = `jitap-e2e-${run}@example.invalid`;
const base = { name: 'JiTap Automated QA TEST', phone: '0700000000', consent: true, website: '' };

async function submit(kind, payload) {
  const response = await fetch(`${origin}/api/intake/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'User-Agent': 'JiTap-integration-tests/1.0' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000)
  });
  const data = await response.json();
  return { status: response.status, data };
}

console.log('JiTap production API integration test run:', run);
const provider = await submit('provider', {
  ...base,
  email,
  category: 'other-services',
  skills: `Automated QA TEST only — IT support and laptop repair ${run}`,
  areas: ['Bamburi', 'Nyali'],
  experience: '10+',
  contactChannel: 'whatsapp'
});
console.log('provider', JSON.stringify(provider));
assert.equal(provider.status, 201, 'Provider request must be persisted');
assert.equal(provider.data.ok, true);
assert.match(provider.data.reference, /^[a-f\d-]{36}$/i);

const customer = await submit('request', {
  ...base,
  category: 'plumbing',
  description: `Automated QA TEST only — leaking sink in Bamburi ${run}`,
  area: 'Bamburi',
  timing: 'today'
});
console.log('customer', JSON.stringify(customer));
assert.equal(customer.status, 201, 'Customer request must be persisted');
assert.equal(customer.data.ok, true);
assert.match(customer.data.reference, /^[a-f\d-]{36}$/i);

const invalid = await submit('provider', {
  ...base,
  phone: '123',
  email,
  category: 'other-services',
  skills: 'Automated QA invalid phone test',
  areas: ['Bamburi'],
  experience: '10+',
  contactChannel: 'whatsapp'
});
console.log('validation', JSON.stringify(invalid));
assert.equal(invalid.status, 422);
assert.ok(Array.isArray(invalid.data.issues?.phone));
console.log('PASS: live API persisted both forms and rejected invalid provider phone');
