import type {NextRequest} from 'next/server';
import {goTrue} from '@/lib/jitap-auth';

export type ResolvedAccess = {
  accessToken: string;
  rotated?: {access: string; refresh: string; expires: number};
  /** Web cookie path may rotate tokens on the response. */
  fromCookies: boolean;
};

/** Bearer token for native clients (`Authorization: Bearer <jwt>`). */
export function parseBearerAuthorization(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/** Customer UI for a provider account (cookie `jt_mode` or mobile header). */
export function actingAsCustomer(req: NextRequest): boolean {
  if (req.cookies.get('jt_mode')?.value === 'customer') return true;
  return req.headers.get('x-jitap-mode')?.toLowerCase() === 'customer';
}

/**
 * Resolve a verified Supabase access token from cookies (web) or Bearer (mobile).
 * Cookie clients may refresh via `jt_refresh`; Bearer clients refresh via `/api/auth/refresh` (PR-W2).
 */
export async function resolveAccessSession(req: NextRequest): Promise<ResolvedAccess | null> {
  const bearer = parseBearerAuthorization(req);
  if (bearer) {
    const user = await goTrue('user', undefined, bearer, 'GET');
    if (!user?.ok) return null;
    return {accessToken: bearer, fromCookies: false};
  }

  let access = req.cookies.get('jt_access')?.value || '';
  const refresh = req.cookies.get('jt_refresh')?.value || '';
  if (!access && !refresh) return null;

  let user = access ? await goTrue('user', undefined, access, 'GET') : null;
  let rotated: ResolvedAccess['rotated'];

  if (!user?.ok && refresh) {
    const renewed = await goTrue('token?grant_type=refresh_token', {refresh_token: refresh});
    const data = renewed.data as {access_token?: string; refresh_token?: string; expires_in?: number};
    if (renewed.ok && data.access_token && data.refresh_token) {
      access = data.access_token;
      user = await goTrue('user', undefined, access, 'GET');
      if (user?.ok) {
        rotated = {
          access: access,
          refresh: data.refresh_token,
          expires: Number(data.expires_in) || 3600,
        };
      }
    }
  }

  if (!access || !user?.ok) return null;
  return {accessToken: access, rotated, fromCookies: true};
}
