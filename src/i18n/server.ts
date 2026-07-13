/**
 * Server-side locale read. The root layout calls `getLocale()` / `getDictionary`
 * and passes the dictionary down; reading the cookie makes rendering dynamic,
 * which the app already is (auth-aware header, force-dynamic data routes).
 */
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, type Locale, defaultLocale, isLocale } from './config';
import { type Dictionary, getDictionary } from './dictionary';

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

/** The active locale's dictionary (falls back to the default locale). */
export async function getMessages(): Promise<Dictionary> {
  return getDictionary(await getLocale());
}
