import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MagicLinkForm } from './magic-link-form';

function GitHubIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-start justify-center px-4">
      <div className="mt-20 w-full max-w-md">
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="pb-2 text-center space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">OpenDiscover</h1>
            <p className="text-sm text-muted-foreground">Citizen Science Platform</p>
          </CardHeader>

          <CardContent className="space-y-6 pt-4 pb-8 px-8">
            <a
              href="/api/auth/sign-in/github"
              className="flex w-full items-center justify-center gap-3 rounded-md bg-[#24292e] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <GitHubIcon />
              Continue with GitHub
            </a>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <MagicLinkForm />

            <div className="rounded-2xl border border-border bg-background/50 p-4">
              <p className="text-sm font-medium">Continue without an account</p>
              <p className="text-xs text-muted-foreground mb-3">
                Choose a nickname and keep exploring with a guest session.
              </p>
              <form action="/api/auth/guest" method="POST" className="space-y-3">
                <label className="block text-sm font-medium">
                  Pseudo
                  <input
                    name="handle"
                    type="text"
                    required
                    minLength={2}
                    maxLength={24}
                    placeholder="my-pseudo"
                    className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Continue as guest
                </button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
