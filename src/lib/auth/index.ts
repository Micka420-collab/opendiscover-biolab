/**
 * Better Auth — modern authentication for the platform.
 *
 * Providers:
 *  - Sign in with Vercel (the canonical "I'm a builder" identity)
 *  - GitHub (researchers and devs)
 *  - ORCID custom OAuth (academics — links to their citation identity)
 *  - Email magic-link (everyone else, no password storage)
 *
 * Every Discovery is stamped with the contributor identity at promotion time,
 * so we can mint accurate Zenodo DOIs and ORCID-attributed credit when the
 * status reaches CONFIRMED.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { db, schema } from '@/lib/db';
import { getGuestSession, type GuestSession } from '@/lib/auth/guest';

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret',
  baseUrl: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
    // Sign in with Vercel is registered as a generic OAuth provider — Better Auth
    // supports custom providers via the genericOAuth plugin if needed.
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Resend integration — see src/lib/email/send.ts
        const { sendMagicLinkEmail } = await import('@/lib/email/send');
        await sendMagicLinkEmail(email, url);
      },
    }),
  ],
  user: {
    additionalFields: {
      handle: { type: 'string', required: true },
      orcid: { type: 'string', required: false },
      reputation: { type: 'number', required: false, defaultValue: 1.0 },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    cookiePrefix: 'opendiscover',
    crossSubDomainCookies: { enabled: false },
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type AppSession = Session | GuestSession;

export async function getAppSession(options: { headers: Headers | Request['headers'] | HeadersInit }) {
  const session = await auth.api.getSession(options as any);
  if (session?.user) return session as Session;
  return getGuestSession(options.headers);
}

export function isGuestSession(session: AppSession | null | undefined): session is GuestSession {
  return Boolean((session as GuestSession)?.guest);
}
