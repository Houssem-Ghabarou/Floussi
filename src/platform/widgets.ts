/** Home-screen widgets exist on iOS and Android only (see widgets.ios.ts and widgets.android.ts). */
import type { LocalDate } from '@/domain/dates';
import type { AppData } from '@/domain/types';

export function syncWidgets(_data: AppData | null, _today: LocalDate) {}
