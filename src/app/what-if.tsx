import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { STATUS_LABELS } from '@/domain/advice';
import { amountToInput, formatAmount, formatMoney, fromMajor, parseAmount, type Minor } from '@/domain/money';
import { evaluateWhatIf } from '@/domain/what-if';
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
      title="What if?"
      closeLabel="Close"
      footer={
        <View style={styles.footer}>
          <Button
            label={amount ? `Record purchase (−${formatMoney(amount, currency)})` : 'Record purchase'}
            icon="shopping"
            disabled={!amount}
            onPress={() => router.replace({ pathname: '/expense', params: { amount: amountText } })}
          />
          <Button label="Never mind, keep plan" variant="secondary" onPress={() => router.back()} />
        </View>
      }>
      <View style={styles.intro}>
        <AppText variant="title">Purchase simulator</AppText>
        <AppText variant="small" tone="secondary">
          Test a purchase before spending. Your balance won't change until you decide.
        </AppText>
      </View>

      <Card style={styles.inputCard}>
        <View style={[styles.glow, { backgroundColor: palette.accentSoft }]} />
        <View style={styles.spaceBetween}>
          <AppText variant="caption" tone="muted">
            Simulated amount
          </AppText>
          <AppText variant="label" tone="secondary">
            Dry run only
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
          <AppText variant="heading">Daily pace shift</AppText>
          <AppText variant="caption" tone="muted">
            {status.daysRemaining} {status.daysRemaining === 1 ? 'day' : 'days'} remaining
          </AppText>
        </View>
        <View style={styles.tiles}>
          <View style={[styles.tile, { backgroundColor: palette.surfaceLow }]}>
            <AppText variant="caption" tone="muted">
              Current safe pace
            </AppText>
            <PaceValue color={palette.brand} value={m(status.dailyAllowance)} />
            <AppText variant="caption" tone="brand">
              {STATUS_LABELS[status.reason]}
            </AppText>
          </View>
          <View style={[styles.tile, { backgroundColor: resultColors?.bg ?? palette.surfaceLow }]}>
            <AppText variant="caption" color={resultColors?.fg} tone="muted">
              After purchase
            </AppText>
            {result ? (
              <>
                <PaceValue color={resultColors?.fg ?? palette.accent} value={m(result.paceAfter)} />
                <AppText variant="caption" color={resultColors?.fg}>
                  {formatMoney(result.paceAfter - result.paceBefore, currency, { whole: true, signed: true })}/day shift
                </AppText>
              </>
            ) : (
              <>
                <AppText variant="number" tone="muted">
                  —
                </AppText>
                <AppText variant="caption" tone="muted">
                  Enter an amount
                </AppText>
              </>
            )}
          </View>
        </View>
        <View style={styles.allocation}>
          <View style={styles.spaceBetween}>
            <AppText variant="caption" tone="secondary">
              Money until your next income
            </AppText>
            <AppText variant="caption" style={styles.strong}>
              {m(Math.max(0, flexibleAfter))} flexible
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
            <LegendDot color={palette.inverse} label="Protected" />
            <LegendDot color={palette.brand} label="Flexible" />
            <LegendDot color={palette.accent} label="Simulation" />
          </View>
        </View>
      </Card>

      <Card style={styles.guards}>
        <AppText variant="label" tone="muted">
          Protections check
        </AppText>
        <GuardRow
          icon="receipt"
          title="Upcoming bills"
          subtitle={status.billsProtected > 0 ? `${m(status.billsProtected)} due before your income` : 'None due'}
          guard={billsGuard}
        />
        <Divider />
        <GuardRow
          icon="savings"
          title="Savings"
          subtitle={status.savingsReserve > 0 ? `${m(status.savingsReserve)} this cycle` : 'None set'}
          guard={savingsGuard}
        />
        <Divider />
        <GuardRow
          icon="shield"
          title="Safety cushion"
          subtitle={status.minimumBalance > 0 ? `${m(status.minimumBalance)} minimum balance` : 'None set'}
          guard={cushionGuard}
          safeLabel="Untouched"
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
            {result.detail} Your pace would go from {m(result.paceBefore)} to {m(result.paceAfter)} a day.
          </AppText>
        </View>
      ) : (
        <Callout icon="info" title="Try an amount">
          <AppText variant="small" tone="secondary">
            You have {formatAmount(Math.max(0, status.flexibleNow), currency, { whole: true })} {currency.label} of
            flexible money until your next income. Nothing is recorded unless you choose to.
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
          /day
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
  safeLabel = 'Protected',
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  guard: Guard;
  safeLabel?: string;
}) {
  const palette = usePalette();
  const badge = {
    safe: { label: safeLabel, color: palette.onBrandSoft, background: palette.comfortableSoft, icon: 'checkCircle' as const },
    touched: { label: 'Touched', color: palette.watch, background: palette.watchSoft, icon: 'info' as const },
    at_risk: { label: 'At risk', color: palette.atRisk, background: palette.atRiskSoft, icon: 'info' as const },
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
