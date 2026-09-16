import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { statusLabel } from '@/domain/advice';
import { amountToInput, formatAmount, formatMoney, fromMajor, parseAmount, type Minor } from '@/domain/money';
import { evaluateWhatIf } from '@/domain/what-if';
import { t, tn } from '@/i18n';
import { useFinancial } from '@/store/use-financial';
import {
  AmountField,
  AppText,
  Badge,
  Button,
  Callout,
  Card,
  Divider,
  haptics,
  IconCircle,
  LegendDot,
  SegmentBar,
  SheetScreen,
} from '@/ui/components';
import type { IconName } from '@/ui/icon';
import { CardShadow, Radius, riskColors, Space, usePalette } from '@/ui/theme';

type Guard = 'safe' | 'touched' | 'at_risk';

export default function WhatIfScreen() {
  const router = useRouter();
  const palette = usePalette();
  const financial = useFinancial();
  const [amountText, setAmountText] = useState('');

  if (!financial) return null;
  const { currency, status } = financial;
  const amount = parseAmount(amountText, currency);
  const result = amount ? evaluateWhatIf(status, amount, currency) : null;
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });
  const resultColors = result ? riskColors(palette, result.riskLevel) : null;

  // Quick amounts: a day, a few days, a week and two weeks of safe pace, rounded to 5.
  const step = fromMajor(5, currency);
  const base = status.dailyAllowance > 0 ? status.dailyAllowance : status.normalDay;
  const presets = [...new Set([1, 3, 7, 14].map((days) => Math.max(step, Math.round((base * days) / step) * step)))];

  const flexibleAfter = status.flexibleNow - (amount ?? 0);
  const dip = Math.max(0, -flexibleAfter);
  const billsGuard: Guard = result && (result.level === 'touches_bills' || result.level === 'exceeds_balance') ? 'at_risk' : 'safe';
  const savingsGuard: Guard = billsGuard === 'at_risk' ? 'at_risk' : dip > 0 && status.savingsReserve > 0 ? 'touched' : 'safe';
  const cushionGuard: Guard =
    billsGuard === 'at_risk' ? 'at_risk' : dip > status.savingsReserve && status.minimumBalance > 0 ? 'touched' : 'safe';

  return (
    <SheetScreen
      title={t('whatIf.title')}
      closeLabel={t('common.close')}
      footer={
        <View style={styles.footer}>
          <Button
            label={
              amount ? t('whatIf.record', { amount: formatMoney(amount, currency) }) : t('whatIf.recordPlain')
            }
            icon="shopping"
            disabled={!amount}
            onPress={() => router.replace({ pathname: '/expense', params: { amount: amountText } })}
          />
          <Button label={t('whatIf.keepPlan')} variant="secondary" onPress={() => router.back()} />
        </View>
      }>
      <View style={styles.intro}>
        <AppText variant="title">{t('whatIf.simulator')}</AppText>
        <AppText variant="small" tone="secondary">
          {t('whatIf.simulatorHint')}
        </AppText>
      </View>

      <Card style={styles.inputCard}>
        <View style={[styles.glow, { backgroundColor: palette.accentSoft }]} />
        <View style={styles.spaceBetween}>
          <AppText variant="caption" tone="muted">
            {t('whatIf.simulatedAmount')}
          </AppText>
          <AppText variant="label" tone="secondary">
            {t('whatIf.dryRun')}
          </AppText>
        </View>
        <AmountField value={amountText} onChangeText={setAmountText} currency={currency} autoFocus />
        <View style={styles.presets}>
          {presets.map((preset) => {
            const selected = amount === preset;
            return (
              <Pressable
                key={preset}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  haptics.tap();
                  setAmountText(amountToInput(preset, currency));
                }}
                style={[
                  styles.preset,
                  { backgroundColor: selected ? palette.brandDeep : palette.surfaceMuted },
                  selected && CardShadow,
                ]}>
                <AppText variant="caption" color={selected ? '#FFFFFF' : palette.textSecondary} style={styles.strong}>
                  {m(preset)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={styles.spaceBetween}>
          <AppText variant="heading">{t('whatIf.paceShift')}</AppText>
          <AppText variant="caption" tone="muted">
            {t('whatIf.daysRemaining', { days: tn('count.days', status.daysRemaining) })}
          </AppText>
        </View>
        <View style={styles.tiles}>
          <View style={[styles.tile, { backgroundColor: palette.surfaceLow }]}>
            <AppText variant="caption" tone="muted">
              {t('whatIf.currentPace')}
            </AppText>
            <PaceValue color={palette.brand} value={m(status.dailyAllowance)} />
            <AppText variant="caption" tone="brand">
              {statusLabel(status.reason)}
            </AppText>
          </View>
          <View style={[styles.tile, { backgroundColor: resultColors?.bg ?? palette.surfaceLow }]}>
            <AppText variant="caption" color={resultColors?.fg} tone="muted">
              {t('whatIf.afterPurchase')}
            </AppText>
            {result ? (
              <>
                <PaceValue color={resultColors?.fg ?? palette.accent} value={m(result.paceAfter)} />
                <AppText variant="caption" color={resultColors?.fg}>
                  {t('whatIf.shift', {
                    amount: formatMoney(result.paceAfter - result.paceBefore, currency, {
                      whole: true,
                      signed: true,
                    }),
                  })}
                </AppText>
              </>
            ) : (
              <>
                <AppText variant="number" tone="muted">
                  —
                </AppText>
                <AppText variant="caption" tone="muted">
                  {t('whatIf.enterAmount')}
                </AppText>
              </>
            )}
          </View>
        </View>
        <View style={styles.allocation}>
          <View style={styles.spaceBetween}>
            <AppText variant="caption" tone="secondary">
              {t('whatIf.moneyUntilIncome')}
            </AppText>
            <AppText variant="caption" style={styles.strong}>
              {t('whatIf.flexibleAmount', { amount: m(Math.max(0, flexibleAfter)) })}
            </AppText>
          </View>
          <SegmentBar
            segments={[
              { value: status.protectedTotal, color: palette.inverse },
              { value: Math.max(0, flexibleAfter), color: palette.brand },
              { value: amount ?? 0, color: palette.accent },
            ]}
          />
          <View style={styles.spaceBetween}>
            <LegendDot color={palette.inverse} label={t('whatIf.legendProtected')} />
            <LegendDot color={palette.brand} label={t('whatIf.legendFlexible')} />
            <LegendDot color={palette.accent} label={t('whatIf.legendSimulation')} />
          </View>
        </View>
      </Card>

      <Card style={styles.guards}>
        <AppText variant="label" tone="muted">
          {t('whatIf.protectionsCheck')}
        </AppText>
        <GuardRow
          icon="receipt"
          title={t('whatIf.upcomingBills')}
          subtitle={
            status.billsProtected > 0
              ? t('whatIf.billsDue', { amount: m(status.billsProtected) })
              : t('whatIf.noneDue')
          }
          guard={billsGuard}
        />
        <Divider />
        <GuardRow
          icon="savings"
          title={t('whatIf.savings')}
          subtitle={
            status.savingsReserve > 0
              ? t('whatIf.savingsThis', { amount: m(status.savingsReserve) })
              : t('whatIf.noneSet')
          }
          guard={savingsGuard}
        />
        <Divider />
        <GuardRow
          icon="shield"
          title={t('whatIf.cushion')}
          subtitle={
            status.minimumBalance > 0
              ? t('whatIf.minimumBalance', { amount: m(status.minimumBalance) })
              : t('whatIf.noneSet')
          }
          guard={cushionGuard}
          safeLabel={t('whatIf.untouched')}
        />
      </Card>

      {result && resultColors ? (
        <View style={[styles.verdict, { backgroundColor: resultColors.bg }]}>
          <View style={styles.inline}>
            <View style={[styles.verdictDot, { backgroundColor: resultColors.fg }]} />
            <AppText variant="heading" style={styles.flex}>
              {result.title}
            </AppText>
          </View>
          <AppText variant="small" tone="secondary">
            {t('whatIf.verdict', {
              detail: result.detail,
              before: m(result.paceBefore),
              after: m(result.paceAfter),
            })}
          </AppText>
        </View>
      ) : (
        <Callout icon="info" title={t('whatIf.tryTitle')}>
          <AppText variant="small" tone="secondary">
            {t('whatIf.tryBody', {
              amount: formatAmount(Math.max(0, status.flexibleNow), currency, { whole: true }),
              currency: currency.label,
            })}
          </AppText>
        </Callout>
      )}
    </SheetScreen>
  );
}

function PaceValue({ color, value }: { color: string; value: string }) {
  return (
    <View style={styles.inline}>
      <View style={[styles.paceDot, { backgroundColor: color }]} />
      <AppText variant="number">
        {value}
        <AppText variant="small" tone="secondary">
          {t('whatIf.perDaySuffix')}
        </AppText>
      </AppText>
    </View>
  );
}

function GuardRow({
  icon,
  title,
  subtitle,
  guard,
  safeLabel,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  guard: Guard;
  safeLabel?: string;
}) {
  const palette = usePalette();
  const badge = {
    safe: {
      label: safeLabel ?? t('whatIf.guardProtected'),
      color: palette.onBrandSoft,
      background: palette.comfortableSoft,
      icon: 'checkCircle' as const,
    },
    touched: {
      label: t('whatIf.guardTouched'),
      color: palette.watch,
      background: palette.watchSoft,
      icon: 'info' as const,
    },
    at_risk: {
      label: t('whatIf.guardAtRisk'),
      color: palette.atRisk,
      background: palette.atRiskSoft,
      icon: 'info' as const,
    },
  }[guard];
  return (
    <View style={styles.guardRow}>
      <IconCircle icon={icon} size={32} background={palette.surfaceMuted} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" tone="muted">
          {subtitle}
        </AppText>
      </View>
      <Badge {...badge} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strong: { fontWeight: '600' },
  intro: { gap: Space.xs },
  footer: { gap: Space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  inputCard: { overflow: 'hidden' },
  glow: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, opacity: 0.5 },
  presets: { flexDirection: 'row', gap: 6 },
  preset: { flex: 1, alignItems: 'center', paddingVertical: Space.sm, borderRadius: Radius.xs },
  tiles: { flexDirection: 'row', gap: Space.sm },
  tile: { flex: 1, borderRadius: Radius.xs, padding: Space.md, gap: 4 },
  paceDot: { width: 8, height: 8, borderRadius: 4 },
  allocation: { gap: Space.sm },
  guards: { gap: Space.sm },
  guardRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 2 },
  verdict: { borderRadius: Radius.md, padding: Space.lg, gap: Space.sm },
  verdictDot: { width: 10, height: 10, borderRadius: 5 },
});
