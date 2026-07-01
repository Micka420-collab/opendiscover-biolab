import { getAppSession, isGuestSession } from '@/lib/auth';
import { headers } from 'next/headers';
import Link from 'next/link';

export async function NavAuth() {
  const session = await getAppSession({ headers: await headers() });

  if (!session?.user) {
    return (
      <Link
        href="/auth/sign-in"
        className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground hover:opacity-90"
      >
        Sign in
      </Link>
    );
  }

  const user = session.user as typeof session.user & {
    handle?: string;
    reputation?: number;
  };
  const handle =
    user.handle ??
    user.name ??
    ('email' in user ? user.email?.split('@')[0] : undefined) ??
    'contributor';

  const guest = isGuestSession(session);

  return (
    <div className="flex items-center gap-3">
      <Link href="/dashboard" className="text-sm hover:text-accent">
        @{handle}
      </Link>
      <form action={guest ? '/api/auth/guest/sign-out' : '/api/auth/sign-out'} method="POST">
        <button type="submit" className="text-xs text-muted-foreground hover:text-foreground">
          Sign out
        </button>
      </form>
    </div>
  );
}
