'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function MagicLinkForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/sign-in/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage((data as { message?: string }).message ?? 'Something went wrong.');
        setStatus('error');
        return;
      }

      setStatus('success');
    } catch {
      setErrorMessage('Network error. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-400 text-center">
        Check your inbox — a magic link is on its way to <strong>{email}</strong>.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === 'loading'}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      />
      {status === 'error' && <p className="text-xs text-red-400">{errorMessage}</p>}
      <Button type="submit" className="w-full" disabled={status === 'loading'}>
        {status === 'loading' ? 'Sending…' : 'Send magic link'}
      </Button>
    </form>
  );
}
