'use client';

import { LOCALE_COOKIE, type Locale, localeNames, locales } from '@/i18n/config';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Top-left language switcher. Writes the chosen locale to a cookie and refreshes
 * so the server re-renders every component with the new dictionary — no page
 * reload, no URL change. `current`/`label` are provided by the (server) layout.
 */
export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Locale;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground" title={label}>
      <span aria-hidden className="text-sm leading-none">
        🌐
      </span>
      <span className="sr-only">{label}</span>
      <select
        value={current}
        onChange={onChange}
        disabled={pending}
        aria-label={label}
        className="cursor-pointer rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
