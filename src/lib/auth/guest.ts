import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const GUEST_COOKIE_NAME = 'opendiscover.guest_session';
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const GUEST_HANDLE_MIN_LENGTH = 2;
const GUEST_HANDLE_MAX_LENGTH = 24;

interface GuestSessionPayload {
  id: string;
  handle: string;
  createdAt: string;
  expiresAt: string;
}

export interface GuestSession {
  guest: true;
  session: {
    id: string;
    token: string;
    createdAt: Date;
    expiresAt: Date;
  };
  user: {
    id: string;
    handle: string;
    name: string;
    reputation: number;
  };
}

const secret = process.env.BETTER_AUTH_SECRET ?? 'dev-secret';

function signPayload(payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url') as string;
}

function encodePayload(payload: GuestSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(payload: string): GuestSessionPayload {
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GuestSessionPayload;
}

export function createGuestSessionToken(handle: string) {
  const safeHandle = handle.trim();
  if (safeHandle.length < GUEST_HANDLE_MIN_LENGTH || safeHandle.length > GUEST_HANDLE_MAX_LENGTH) {
    throw new Error(
      `Guest handle must be ${GUEST_HANDLE_MIN_LENGTH}-${GUEST_HANDLE_MAX_LENGTH} characters.`,
    );
  }

  const payload: GuestSessionPayload = {
    id: randomUUID(),
    handle: safeHandle,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + GUEST_COOKIE_MAX_AGE * 1000).toISOString(),
  };

  const encoded = encodePayload(payload);
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

function getCookieHeader(headers: Headers | Request['headers'] | HeadersInit | undefined) {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get('cookie');
  const maybeHeaders = headers as { get?: unknown };
  if (maybeHeaders?.get && typeof maybeHeaders.get === 'function') {
    return maybeHeaders.get('cookie') as string | null;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      if (key.toLowerCase() === 'cookie') return value;
    }
  }
  return null;
}

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((part) => part.trim().split('='));
  const cookieMap = new Map<string, string>();
  for (const [name, ...rest] of cookies) {
    cookieMap.set(name ?? '', rest.join('='));
  }
  return cookieMap;
}

export function parseGuestSessionToken(token: string): GuestSession | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;
  const expected = signPayload(encoded);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== signatureBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) return null;

  let payload: GuestSessionPayload;
  try {
    payload = decodePayload(encoded);
  } catch {
    return null;
  }

  if (Date.now() > new Date(payload.expiresAt).getTime()) return null;

  return {
    guest: true,
    session: {
      id: payload.id,
      token: `guest-${payload.id}`,
      createdAt: new Date(payload.createdAt),
      expiresAt: new Date(payload.expiresAt),
    },
    user: {
      id: payload.id,
      handle: payload.handle,
      name: payload.handle,
      reputation: 1,
    },
  };
}

export function getGuestSession(
  headers: Headers | Request['headers'] | HeadersInit | undefined,
): GuestSession | null {
  const cookieHeader = getCookieHeader(headers);
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies?.get(GUEST_COOKIE_NAME);
  if (!token) return null;
  return parseGuestSessionToken(token);
}

export function getGuestCookieName() {
  return GUEST_COOKIE_NAME;
}

export function getGuestCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    maxAge: GUEST_COOKIE_MAX_AGE,
  };
}
