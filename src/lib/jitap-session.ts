import type {NextRequest} from 'next/server';
import {goTrue} from '@/lib/jitap-auth';

export type ResolvedAccess = {
  accessToken: string;
  userId: string;
  authPhone?: string;
  rotated?: {access: string; refresh: string; expires: number};
  fromCookies: boolean;
};

/** Bearer token for native clients (`Authorization: Bearer <jwt>`). */
export function parseBearerAuthorization(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function isMobileClient(req: NextRequest): boolean {
  return req.headers.get('x-jitap-client')?.toLowerCase() === 'mobile';
}

/** Customer UI for a provider account (cookie `jt_mode` or mobile header). */
export function actingAsCustomer(req: NextRequest): boolean {
  if (req.cookies.get('jt_mode')?.value === 'customer') return true;
  return req.headers.get('x-jitap-mode')?.toLowerCase() === 'customer';
}

async function verifyAccessToken(token: string): Promise<{userId: string; phone?: string} | null> {
  const user = await goTrue('user', undefined, token, 'GET');
  if (!user?.ok) return null;
  const data = user.data as {id?: string; phone?: string};
  if (!data.id) return null;
  return {userId: data.id, phone: data.phone};
}

async function resolveCookieSession(req: NextRequest): Promise<ResolvedAccess | null> {
  let access = req.cookies.get('jt_access')?.value || '';
  const refresh = req.cookies.get('jt_refresh')?.value || '';
  if (!access && !refresh) return null;

  let verified = access ? await verifyAccessToken(access) : null;
  let rotated: ResolvedAccess['rotated'];

  if (!verified && refresh) {
    const renewed = await goTrue('token?grant_type=refresh_token', {refresh_token: refresh});
    const data = renewed.data as {access_token?: string; refresh_token?: string; expires_in?: number};
    if (renewed.ok && data.access_token && data.refresh_token) {
      access = data.access_token;
      verified = await verifyAccessToken(access);
      if (verified) {
        rotated = {
          access,
          refresh: data.refresh_token,
          expires: Number(data.expires_in) || 3600,
        };
      }
    }
  }

  if (!verified) return null;
  return {
    accessToken: access,
    userId: verified.userId,
    authPhone: verified.phone,
    rotated,
    fromCookies: true,
  };
}

/**
 * Verified Supabase access from Bearer (mobile) or cookies (web).
 * Invalid Bearer falls back to cookies when both are present.
 */
export async function resolveAccessSession(req: NextRequest): Promise<ResolvedAccess | null> {
  const bearer = parseBearerAuthorization(req);
  if (bearer) {
    const verified = await verifyAccessToken(bearer);
    if (verified) {
      return {accessToken: bearer, userId: verified.userId, authPhone: verified.phone, fromCookies: false};
    }
  }
  return resolveCookieSession(req);
}
