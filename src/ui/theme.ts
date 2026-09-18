import { useColorScheme } from 'react-native';

import type { RiskLevel } from '@/domain/engine';

/** Tokens follow the Spnday Figma file (Material-style tonal surfaces, emerald primary, warm amber accent). */
const light = {
  background: '#F8F9FF',
  surface: '#FFFFFF',
  /** Tinted panels inside or between cards. */
  surfaceLow: '#F0F4FD',
  surfaceMuted: '#EAEEF8',
  surfaceHigh: '#E4E8F2',
  surfaceHighest: '#DEE2EC',
  border: '#E4E8F2',
  outline: '#BFC9C2',
  text: '#171C23',
  textSecondary: '#404944',
  textMuted: '#707973',
  inverse: '#2C3138',
  brand: '#185B43',
  brandDeep: '#00422E',
  brandText: '#FFFFFF',
  brandSoft: '#AFF1D1',
  onBrandSoft: '#08513A',
  /** Text on the deep emerald hero. */
  onBrandDeep: '#90D1B2',
  income: '#185B43',
  danger: '#BA1A1A',
  accent: '#FE932C',
  accentSoft: '#FFDCC3',
  accentText: '#904D00',
  comfortable: '#185B43',
  comfortableSoft: '#D4F5E4',
  onTrack: '#185B43',
  onTrackSoft: '#DDF3E8',
  watch: '#904D00',
  watchSoft: '#FFE6D3',
  atRisk: '#BA1A1A',
  atRiskSoft: '#FFDAD6',
  onDanger: '#FFFFFF',
  shadow: '#000000',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0F1417',
  surface: '#181D21',
  surfaceLow: '#1C2227',
  surfaceMuted: '#242A30',
  surfaceHigh: '#2A3137',
  surfaceHighest: '#333A40',
  border: '#2A3137',
  outline: '#46504A',
  text: '#E8ECF3',
  textSecondary: '#BFC9C2',
  textMuted: '#8A938D',
  inverse: '#DEE2EC',
  brand: '#5FBF94',
  brandDeep: '#0D3527',
  brandText: '#00261A',
  brandSoft: '#1D4535',
  onBrandSoft: '#AFF1D1',
  onBrandDeep: '#90D1B2',
  income: '#6FD3A5',
  danger: '#FFB4AB',
  accent: '#FE932C',
  accentSoft: '#4A2E14',
  accentText: '#FFB77D',
  comfortable: '#6FD3A5',
  comfortableSoft: '#17362A',
  onTrack: '#6FD3A5',
  onTrackSoft: '#1A3328',
  watch: '#FFB77D',
  watchSoft: '#3D2A18',
  atRisk: '#FFB4AB',
  atRiskSoft: '#442420',
  onDanger: '#690005',
  shadow: '#000000',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function riskColors(palette: Palette, level: RiskLevel): { fg: string; bg: string } {
  switch (level) {
    case 'comfortable':
      return { fg: palette.comfortable, bg: palette.comfortableSoft };
    case 'on_track':
      return { fg: palette.onTrack, bg: palette.onTrackSoft };
    case 'watch':
      return { fg: palette.watch, bg: palette.watchSoft };
    case 'at_risk':
      return { fg: palette.atRisk, bg: palette.atRiskSoft };
  }
}

/** Deep background for the emerald hero cards, shifted to amber or red when the plan needs attention. */
export function heroColors(level: RiskLevel): { bg: string; glow: string; text: string; strong: string } {
  switch (level) {
    case 'watch':
      return { bg: '#5C3300', glow: '#904D00', text: '#FFDCC3', strong: '#FFB77D' };
    case 'at_risk':
      return { bg: '#6E1A12', glow: '#93000A', text: '#FFDAD6', strong: '#FFB4AB' };
    default:
      return { bg: '#00422E', glow: '#185B43', text: '#90D1B2', strong: '#AFF1D1' };
  }
}

export const Fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Custom fonts ignore fontWeight on Android: pick the matching file instead. */
export function fontFamilyFor(weight: string | number | undefined): string {
  switch (String(weight ?? '400')) {
    case '500':
      return Fonts.medium;
    case '600':
      return Fonts.semibold;
    case '700':
    case 'bold':
      return Fonts.bold;
    case '800':
    case '900':
      return Fonts.extrabold;
    default:
      return Fonts.regular;
  }
}

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { xs: 8, sm: 10, md: 12, lg: 20, pill: 999 } as const;
export const MaxContentWidth = 560;

/** The soft "paper" elevation used by cards in the design. */
export const CardShadow = {
  shadowColor: '#000000',
  shadowOpacity: 0.05,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;
