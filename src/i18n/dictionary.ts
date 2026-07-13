/**
 * The dictionary type is derived from the English catalog (the source of truth),
 * so every locale must supply exactly the same keys or the build fails.
 */
import type { Locale } from './config';
import { defaultLocale } from './config';
import { de } from './messages/de';
import { en } from './messages/en';
import { es } from './messages/es';
import { fr } from './messages/fr';
import { it } from './messages/it';
import { pt } from './messages/pt';

/** A deeply-readonly message catalog with the exact shape of the English one. */
export type Dictionary = typeof en;

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, es, de, it, pt };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[defaultLocale];
}
