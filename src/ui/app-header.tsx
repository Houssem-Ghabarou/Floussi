import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatShortDate } from '@/domain/dates';
import { t } from '@/i18n';
import { useFinancial } from '@/store/use-financial';

import { AppText, Screen } from './components';
import { Icon } from './icon';
import { riskColors, Space, usePalette } from './theme';

const LOGO = require('../../assets/images/logo-mark.png');

/** A tab screen: the Spnday header (logo, section, today, status badge) above scrollable content. */
export function TabScreen({ section, children }: { section: string; children: ReactNode }) {
  return <Screen header={<AppHeader section={section} />}>{children}</Screen>;
}

function AppHeader({ section }: { section: string }) {
  const financial = useFinancial();
  const router = useRouter();
  const palette = usePalette();
  const level = financial?.status.riskLevel ?? 'on_track';
  const colors = riskColors(palette, level);
  const calm = level === 'comfortable' || level === 'on_track';

  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <Image source={LOGO} style={styles.logo} accessibilityLabel={t('header.logo')} />
        <View style={styles.titles}>
          <AppText variant="heading" style={styles.brand}>
            Spnday
          </AppText>
          <View style={styles.crumbs}>
            <AppText variant="caption" tone="secondary">
              {section}
            </AppText>
            <View style={[styles.crumbDot, { backgroundColor: palette.outline }]} />
            <View style={[styles.crumbPill, { backgroundColor: palette.surfaceMuted }]}>
              <AppText variant="caption" tone="secondary">
                {financial ? t('header.today', { date: formatShortDate(financial.today) }) : t('nav.today')}
              </AppText>
            </View>
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => router.push('/breakdown')}
        accessibilityRole="button"
        accessibilityLabel={t('header.statusHint')}
        hitSlop={6}
        style={({ pressed }) => [styles.statusButton, pressed && styles.pressed]}>
        <View style={[styles.statusRing, { borderColor: colors.bg, backgroundColor: colors.fg }]}>
          <Icon name={calm ? 'check' : 'info'} size={18} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  logo: { width: 36, height: 36, borderRadius: 9 },
  titles: { gap: 2 },
  brand: { letterSpacing: -0.45, lineHeight: 22 },
  crumbs: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  crumbDot: { width: 4, height: 4, borderRadius: 2 },
  crumbPill: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  statusButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  statusRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
