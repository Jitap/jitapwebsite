import {NextRequest, NextResponse} from 'next/server';
import {goTrue, setAuthCookies} from '@/lib/jitap-auth';
import {isMobileClient, parseBearerAuthorization} from '@/lib/jitap-session';

export const runtime = 'nodejs';
const noStore = {'Cache-Control': 'no-store'};

export async function POST(req: NextRequest) {
  const bearer = parseBearerAuthorization(req);
  if (!bearer && !isMobileClient(req)) {
    return NextResponse.json({error: 'Mobile client or refresh body required.'}, {status: 403, headers: noStore});
  }

  let refreshToken = '';
  try {
    const body = (await req.json()) as {refreshToken?: unknown};
    refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : '';
  } catch {
    return NextResponse.json({error: 'Invalid request.'}, {status: 400, headers: noStore});
  }

  if (!refreshToken) {
    return NextResponse.json({error: 'Refresh token required.'}, {status: 422, headers: noStore});
  }

  const renewed = await goTrue('token?grant_type=refresh_token', {refresh_token: refreshToken});
  const data = renewed.data as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!renewed.ok || !data.access_token || !data.refresh_token) {
    return NextResponse.json({error: 'Invalid or expired refresh token.'}, {status: 401, headers: noStore});
  }

  const user = await goTrue('user', undefined, data.access_token, 'GET');
  if (!user?.ok) {
    return NextResponse.json({error: 'Unable to confirm refreshed session.'}, {status: 401, headers: noStore});
  }

  const expiresIn = Number(data.expires_in) || 3600;
  const payload = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn,
  };

  const response = NextResponse.json(payload, {headers: noStore});

  if (!isMobileClient(req)) {
    setAuthCookies(response, data.access_token, data.refresh_token, expiresIn);
  }

  return response;
}
