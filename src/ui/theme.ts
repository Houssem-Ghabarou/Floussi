import { useColorScheme } from 'react-native';

import type { RiskLevel } from '@/domain/engine';

const light = {
  background: '#F6F5F1',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEEE8',
  border: '#E4E2DA',
  text: '#16201B',
  textSecondary: '#56625B',
  textMuted: '#88918B',
  brand: '#1F6F50',
  brandText: '#FFFFFF',
  brandSoft: '#DCEFE5',
  income: '#1D7A4B',
  danger: '#B84A33',
  comfortable: '#17735A',
  comfortableSoft: '#DCF0E7',
  onTrack: '#2A7A4C',
  onTrackSoft: '#E2F1E5',
  watch: '#9A6206',
  watchSoft: '#FAEDD3',
  atRisk: '#B8452D',
  atRiskSoft: '#FAE2DA',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0E1311',
  surface: '#171D1A',
  surfaceMuted: '#1F2723',
  border: '#2A332E',
  text: '#EEF2EF',
  textSecondary: '#A9B4AD',
  textMuted: '#7A857E',
  brand: '#4CB88A',
  brandText: '#06140D',
  brandSoft: '#1B3328',
  income: '#5BC48F',
  danger: '#F08A70',
  comfortable: '#5BC49A',
  comfortableSoft: '#17302A',
  onTrack: '#6CC58C',
  onTrackSoft: '#1A2E22',
  watch: '#F0B44C',
  watchSoft: '#35291A',
  atRisk: '#F08A70',
  atRiskSoft: '#3A221D',
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

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const MaxContentWidth = 640;
