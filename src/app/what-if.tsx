import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RISK_META } from '@/domain/advice';
import { formatMoney, parseAmount, type Minor } from '@/domain/money';
import { evaluateWhatIf } from '@/domain/what-if';
import { useFinancial } from '@/store/use-financial';
import { AmountField, AppText, Button, Card, MoneyLine, SheetScreen } from '@/ui/components';
import { riskColors, Space, usePalette } from '@/ui/theme';

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
  const colors = result ? riskColors(palette, result.riskLevel) : null;

  return (
    <SheetScreen
      title="What if?"
      closeLabel="Close"
      footer={
        <View style={styles.buttons}>
          <Button label="Cancel" variant="secondary" style={styles.flex} onPress={() => router.back()} />
          <Button
            label="Record purchase"
            style={styles.flex}
            disabled={!amount}
            onPress={() => router.replace({ pathname: '/expense', params: { amount: amountText } })}
          />
        </View>
      }>
      <View style={styles.intro}>
        <AppText variant="title">Can I afford this?</AppText>
        <AppText tone="secondary">Try an amount. Nothing is recorded unless you choose to.</AppText>
      </View>

      <AmountField value={amountText} onChangeText={setAmountText} currency={currency} autoFocus />

      {result && colors ? (
        <Card tint={colors.bg}>
          <AppText variant="heading">
            {RISK_META[result.riskLevel].emoji} {result.title}
          </AppText>
          <AppText tone="secondary">{result.detail}</AppText>
          <MoneyLine label="Safe pace" value={`${m(result.paceBefore)} → ${m(result.paceAfter)}/day`} strong />
        </Card>
      ) : (
        <Card>
          <MoneyLine label="Your safe pace now" value={`${m(status.dailyAllowance)}/day`} strong />
          <MoneyLine label="Flexible money until your next income" value={m(Math.max(0, status.flexibleNow))} />
        </Card>
      )}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', gap: Space.sm },
  intro: { gap: Space.xs },
});
