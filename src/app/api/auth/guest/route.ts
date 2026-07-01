import { NextRequest, NextResponse } from 'next/server';
import { createGuestSessionToken, getGuestCookieOptions } from '@/lib/auth/guest';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const handle = String(form.get('handle') ?? '').trim();

  if (!handle || handle.length < 2 || handle.length > 24) {
    const redirectUrl = new URL('/auth/sign-in', req.url);
    redirectUrl.searchParams.set('guestError', 'invalid_handle');
    return NextResponse.redirect(redirectUrl);
  }

  const cookie = createGuestSessionToken(handle);
  const response = NextResponse.redirect(new URL('/dashboard', req.url));
  response.cookies.set('opendiscover.guest_session', cookie, getGuestCookieOptions());
  return response;
}
