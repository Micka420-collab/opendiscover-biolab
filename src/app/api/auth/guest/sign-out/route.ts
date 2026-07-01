import { NextRequest, NextResponse } from 'next/server';
import { getGuestCookieOptions } from '@/lib/auth/guest';

export async function POST(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/auth/sign-in', req.url));
  response.cookies.delete('opendiscover.guest_session');
  return response;
}
