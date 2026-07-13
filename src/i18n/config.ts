/**
 * Locale configuration for the app's language switcher.
 *
 * Locale is stored in a cookie (no URL prefixes, so no route restructuring):
 * the root layout reads it server-side and hands the matching dictionary down.
 * See ./dictionary for the message catalogs and ./server for the cookie read.
 */

export const locales = ['en', 'fr', 'es', 'de', 'it', 'pt'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** The name of each language, written in that language (for the switcher). */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
};

/** Cookie key holding the visitor's chosen locale. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}
