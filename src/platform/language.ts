/**
 * Picks the language to use and applies it to every text.
 *
 * The layout always stays left to right, in every language: only the words are translated. A build
 * that previously mirrored the layout for Arabic needs one relaunch for that to be undone, because
 * React Native stores the direction natively.
 */
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import type { Language } from '@/domain/types';
import { LANGUAGES, setLanguage } from '@/i18n';

/** The first language of the phone that Spnday speaks, English otherwise. */
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

/** Keeps the layout left to right, and undoes the mirroring older builds turned on. */
export function lockLeftToRight() {
  I18nManager.allowRTL(false);
  if (I18nManager.isRTL) I18nManager.forceRTL(false);
}

/** Applies a language to every text. Nothing about the layout changes, so no restart is needed. */
export function applyLanguage(language: Language) {
  setLanguage(language);
}

/** Texts only: used by background code (widgets), which never lays out screens. */
export function applyTextLanguage(language: Language) {
  setLanguage(language);
}
