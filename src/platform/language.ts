/** Picks the language to use and applies it, including right-to-left mirroring for Arabic. */
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import type { Language } from '@/domain/types';
import { isRightToLeft, LANGUAGES, setLanguage } from '@/i18n';

/** The first language of the phone that Flousey speaks, English otherwise. */
export function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    const code = locale.languageCode;
    if (code && (LANGUAGES as readonly string[]).includes(code)) return code as Language;
  }
  return 'en';
}

/** Falls back to the phone when nothing was chosen, or when a stored value isn't a language we speak. */
export function resolveLanguage(chosen: string | null | undefined): Language {
  if (chosen && (LANGUAGES as readonly string[]).includes(chosen)) return chosen as Language;
  return deviceLanguage();
}

/**
 * Applies a language to every text. Mirroring the layout needs a restart, so this returns true when
 * the app has to be reopened for the change to look right.
 */
export function applyLanguage(language: Language): boolean {
  setLanguage(language);
  const rightToLeft = isRightToLeft(language);
  if (rightToLeft === I18nManager.isRTL) return false;
  I18nManager.allowRTL(rightToLeft);
  I18nManager.forceRTL(rightToLeft);
  return true;
}

/** Texts only: used by background code (widgets), which never lays out screens. */
export function applyTextLanguage(language: Language) {
  setLanguage(language);
}
