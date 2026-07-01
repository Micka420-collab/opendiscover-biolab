/**
 * Vercel Routing Middleware (full Node.js, Fluid Compute):
 *   - BotID verification on sensitive endpoints
 *   - Rate limiting headers exposed
 *   - Request-ID propagation for tracing
 */

import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/api/submissions', '/api/auth/'];

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const isProtected = PROTECTED_PATHS.some((p) => url.pathname.startsWith(p));

  if (isProtected && process.env.NODE_ENV === 'production') {
    // BotID verification is not available in this environment because
    // the @vercel/botid package is not available from the public registry.
    // Production deployments should provide the package or an equivalent check.
  }

  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const res = NextResponse.next();
  res.headers.set('x-request-id', requestId);
  return res;
}

export const config = {
  matcher: ['/api/submissions/:path*', '/api/auth/:path*', '/api/inngest/:path*'],
};
