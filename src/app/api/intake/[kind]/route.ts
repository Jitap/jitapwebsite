import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { schemas,requestSchema, type FormKind } from '@/lib/validators';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {setAuthCookies} from '@/lib/jitap-auth';
import {sendRequestReceiptSms,serviceReference} from '@/lib/request-receipt-sms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const kinds = new Set<FormKind>(['request', 'provider', 'contact', 'early-access']);
const MAX_BYTES = 12_000;
const jsonHeaders = { 'Cache-Control': 'no-store' };

function respond(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: jsonHeaders });
}
function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function configured() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  const token = process.env.INTAKE_RPC_TOKEN?.trim();
  const salt = process.env.INTAKE_HASH_SECRET?.trim();
  return url && url.startsWith('https://') && key && token && token.length === 64 && salt && salt.length >= 32
    ? { url, key, token, salt } : null;
}
function allowedOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // server-to-server clients are still subject to DB rate limits
  try {
    const parsed = new URL(origin);
    const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const forwardedProto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':','');
    const candidates = [req.nextUrl.origin, `${forwardedProto}://${forwardedHost}`, process.env.NEXT_PUBLIC_SITE_URL];
    return candidates.filter(Boolean).some(candidate => {
      try { return new URL(candidate!).origin === parsed.origin; } catch { return false; }
    });
  } catch { return false; }
}

/**
 * Stores validated website enquiries in Supabase PostgreSQL via a server-token-authenticated
 * RPC. No direct public database writes, no demo success, no pretend dispatch.
 */

const inboxByType: Record<string, string> = {
  general: 'hello@jitap.app',
  support: 'support@jitap.app',
  service: 'support@jitap.app',
  provider: 'providers@jitap.app',
  partnership: 'partners@jitap.app',
  business: 'info@jitap.app'
};

async function notifyInbox(kind: FormKind, payload: Record<string, unknown>, reference: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.JITAP_EMAIL_FROM;
  if (!apiKey || !sender) {
    console.error('JiTap intake email not configured', { kind, reference });
    return false;
  }
  const destination = kind === 'contact'
    ? inboxByType[String(payload.type || 'general')] || 'hello@jitap.app'
    : kind === 'provider' ? 'providers@jitap.app'
    : kind === 'request' ? 'support@jitap.app' : 'hello@jitap.app';
  const lines = Object.entries(payload)
    .filter(([key]) => key !== 'consent' && key !== 'website')
    .map(([key, value]) => key + ': ' + (Array.isArray(value) ? value.join(', ') : String(value)));
  const body = ['New JiTap website submission', 'Reference: ' + reference, 'Type: ' + kind, '', ...lines].join('\n');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'jitap-' + reference
      },
      body: JSON.stringify({
        from: sender,
        to: [destination],
        reply_to: kind === 'contact' && typeof payload.email === 'string' ? payload.email : undefined,
        subject: '[JiTap ' + kind + '] Submission ' + reference.slice(0, 8),
        text: body
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      console.error('JiTap intake email rejected', { kind, reference, status: response.status });
      return false;
    }
    return true;
  } catch {
    console.error('JiTap intake email transport failed', { kind, reference });
    return false;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{kind: string}> }) {
  const { kind } = await params;
  if (!kinds.has(kind as FormKind)) return respond({ error: 'Unknown form.' }, 404);
  if (!allowedOrigin(req)) return respond({ error: 'Invalid request origin.' }, 403);
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return respond({ error: 'Expected JSON content.' }, 415);
  const advertisedLength = Number(req.headers.get('content-length') || 0);
  if (advertisedLength > MAX_BYTES) return respond({ error: 'Submission too long.' }, 413);

  let payload: unknown;
  try {
    const body = await req.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BYTES) return respond({ error: 'Submission too long.' }, 413);
    payload = JSON.parse(body);
  } catch { return respond({ error: 'Invalid JSON request.' }, 400); }

  // Resolve the server-verified session before validating contact fields.
  // Authenticated customers only supply job details and location: identity
  // comes from Supabase, never from name/phone/user_id in the browser payload.
  const customer = kind === 'request' ? await getCustomerIdentity(req) : {kind:'guest' as const};
  if(customer.kind === 'invalid') return respond({error:'Please sign in again to submit this request.'},401);
  if(customer.kind === 'provider') return respond({error:'Please use a customer account to submit service requests.'},403);
  if(customer.kind === 'customer' && kind === 'request' && payload && typeof payload === 'object' && !Array.isArray(payload)){
    payload = {...payload,phone:customer.identity.phone,name:customer.identity.fullName?.trim() || 'JiTap Customer'};
  }
  const validated = schemas[kind as FormKind].safeParse(payload);
  if (!validated.success) {
    return respond({ error: 'Please correct the form fields.', issues: validated.error.flatten().fieldErrors }, 422);
  }
  const data = validated.data;
  if ('website' in data && data.website) return respond({ error: 'Submission rejected.' }, 400);

  const cfg = configured();
  if (!cfg) return respond({ error: 'JiTap online intake is not configured. Please contact JiTap by email.' }, 503);

  const ip = (req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for')
    || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim().slice(0, 100);
  const clientHash = fingerprint(cfg.salt + ':' + ip);
  const fiveMinuteWindow = Math.floor(Date.now() / 300000);
  const requestKey = fingerprint(JSON.stringify({ kind, data, clientHash, fiveMinuteWindow }));

  try {
    const result = await fetch(`${cfg.url}/rest/v1/rpc/${customer.kind === 'customer' && kind === 'request' ? 'submit_website_intake_customer_authorized' : 'submit_website_intake_authorized'}`, {
      method: 'POST',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        p_kind: kind,
        p_payload: data,
        p_source_hash: clientHash,
        p_request_key: requestKey,
        p_token: cfg.token,
        ...(customer.kind === 'customer' && kind === 'request' ? {p_customer_user_id:customer.identity.userId}: {})
      })
    });

    if (!result.ok) {
      const detail = await result.text();
      if (result.status === 429 || detail.includes('submission rate exceeded')) {
        return respond({ error: 'Too many requests. Try again later.' }, 429);
      }
      // Keep server-side diagnostics minimal and never log submitted personal data or API credentials.
      console.error('JiTap intake database unavailable', { status: result.status });
      return respond({ error: 'Your submission could not be saved. Please try again.' }, 502);
    }
    const identifier: unknown = await result.json();
    if (typeof identifier !== 'string' || !/^[a-f0-9-]{36}$/i.test(identifier)) {
      console.error('JiTap intake received an unexpected response');
      return respond({ error: 'We could not confirm receipt. Please contact JiTap.' }, 502);
    }
    const emailAccepted = await notifyInbox(kind as FormKind, data, identifier);
    // The request has already been committed. A Wasiliana failure must never
    // lose the job or cause the customer to re-submit it.
    const requestDetails=kind==='request'?requestSchema.parse(data):null;
    const isSyntheticQA=!!requestDetails
      &&requestDetails.name==='JiTap Automated QA TEST'
      &&requestDetails.phone==='0700000000'
      &&requestDetails.description.startsWith('Automated QA TEST only');
    const smsState=requestDetails&&!isSyntheticQA
      ?await sendRequestReceiptSms({
        reference:identifier,name:requestDetails.name,phone:requestDetails.phone,
        category:requestDetails.category,linkedToAccount:customer.kind==='customer',
        token:cfg.token,url:cfg.url,key:cfg.key
       })
      :'skipped';
    const receipt=respond({
      ok: true,
      reference: identifier,
      ...(kind==='request'?{serviceId:serviceReference(identifier),smsAcknowledgement:smsState==='submitted'?'submitted':smsState}:{}),
      linkedToAccount:customer.kind === 'customer' && kind === 'request',
      emailNotificationAccepted: emailAccepted,
      message: kind === 'provider' ? 'Your provider application has been received successfully. JiTap will review it and contact you.' : 'Thank you for contacting JiTap. Your enquiry has been received successfully. Our team will review it and get back to you.'
    }, 201);
    if(customer.kind === 'customer' && customer.identity.rotated){
      const rotated=customer.identity.rotated;
      setAuthCookies(receipt,rotated.access,rotated.refresh,rotated.expires);
    }
    return receipt;
  } catch {
    console.error('JiTap intake transport failure');
    return respond({ error: 'JiTap could not confirm your submission. Please try again later.' }, 502);
  }
}

export async function GET() {
  return respond({ error: 'Method not allowed.' }, 405);
}
