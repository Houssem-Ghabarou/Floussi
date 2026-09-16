import { useRouter } from 'expo-router';
import { useState } from 'react';

import { statusLabel } from '@/domain/advice';
import { savingsMovedInCycle } from '@/domain/derive';
import { calculateFinancialStatus } from '@/domain/engine';
import { amountToInput, defaultDailyNeed, formatMoney, parseAmount, type Minor } from '@/domain/money';
import { t, type TranslationKey } from '@/i18n';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import {
  AmountField,
  AppText,
  Button,
  Card,
  Chip,
  ChipGroup,
  Field,
  haptics,
  MoneyLine,
  SheetScreen,
  StatusPill,
} from '@/ui/components';
import { showToast } from '@/ui/toast';

const SAVE_OPTIONS: { percent: number; label: TranslationKey }[] = [
  { percent: 0, label: 'protections.useIt' },
  { percent: 50, label: 'protections.saveHalf' },
  { percent: 100, label: 'protections.saveAll' },
];

export default function ProtectionsScreen() {
  const router = useRouter();
  const financial = useFinancial();
  const updateCycle = useApp((state) => state.updateCycle);
  const updateSettings = useApp((state) => state.updateSettings);
  const addTransaction = useApp((state) => state.addTransaction);
  const deleteTransaction = useApp((state) => state.deleteTransaction);

  const [savingsText, setSavingsText] = useState(() =>
    financial ? amountToInput(financial.data.cycle.savingsTarget, financial.currency) : '',
  );
  const [minimumText, setMinimumText] = useState(() =>
    financial ? amountToInput(financial.data.settings.minimumBalance, financial.currency) : '',
  );
  const [dailyNeedText, setDailyNeedText] = useState(() =>
    financial?.data.settings.dailyNeed ? amountToInput(financial.data.settings.dailyNeed, financial.currency) : '',
  );
  const [savePercent, setSavePercent] = useState(financial?.data.settings.unexpectedIncomeSavePercent ?? 0);
  const [moveText, setMoveText] = useState('');

  if (!financial) return null;
  const { currency, data, input, status, today } = financial;
  const m = (value: Minor) => formatMoney(value, currency);
  const moved = savingsMovedInCycle(data.cycle, data.transactions);
  const savingsTarget = parseAmount(savingsText, currency) ?? 0;
  const minimumBalance = parseAmount(minimumText, currency) ?? 0;
  const moveAmount = parseAmount(moveText, currency);

  // An empty field means "no figure of my own": the routines decide, or the currency default.
  const dailyNeed = parseAmount(dailyNeedText, currency);
  const routineAverage = status.hasRoutines && status.expectedDailyAverage > 0 ? status.expectedDailyAverage : null;

  const preview = calculateFinancialStatus({
    ...input,
    savingsReserve: Math.max(0, savingsTarget - moved),
    minimumBalance,
    dailyNeed: dailyNeed ?? defaultDailyNeed(currency),
    dailyNeedIsDefault: dailyNeed === null,
  });

  const save = () => {
    updateCycle({ savingsTarget });
    updateSettings({ minimumBalance, dailyNeed, unexpectedIncomeSavePercent: savePercent });
    haptics.success();
    router.back();
    showToast(
      t('protections.saved', {
        pace: t('common.perDay', { amount: formatMoney(preview.dailyAllowance, currency, { whole: true }) }),
      }),
    );
  };

  const recordTransfer = () => {
    if (!moveAmount) return;
    const transfer = addTransaction({ kind: 'savings_transfer', amount: -moveAmount, date: today });
    haptics.success();
    setMoveText('');
    showToast(t('protections.moved', { amount: m(moveAmount) }), {
      label: t('common.undo'),
      onPress: () => deleteTransaction(transfer.id),
    });
  };

  return (
    <SheetScreen title={t('protections.title')} footer={<Button label={t('common.save')} onPress={save} />}>
      <AppText tone="secondary">{t('protections.intro')}</AppText>

      <Field
        label={t('protections.savings')}
        hint={moved > 0 ? t('protections.movedHint', { amount: m(moved) }) : t('protections.keptHint')}>
        <AmountField value={savingsText} onChangeText={setSavingsText} currency={currency} size="medium" />
      </Field>

      <Card>
        <AppText variant="bodyStrong">{t('protections.movedQuestion')}</AppText>
        <AppText variant="small" tone="secondary">
          {t('protections.movedBody')}
        </AppText>
        <AmountField value={moveText} onChangeText={setMoveText} currency={currency} size="medium" />
        <Button
          label={t('protections.recordTransfer')}
          variant="secondary"
          compact
          disabled={!moveAmount}
          onPress={recordTransfer}
        />
      </Card>

      <Field label={t('protections.minimum')} hint={t('protections.minimumHint')}>
        <AmountField value={minimumText} onChangeText={setMinimumText} currency={currency} size="medium" />
      </Field>

      <Field
        label={t('protections.normalDay')}
        hint={
          routineAverage
            ? t('protections.normalDayRoutineHint', {
                amount: formatMoney(routineAverage, currency, { whole: true }),
              })
            : t('protections.normalDayHint')
        }>
        <AmountField value={dailyNeedText} onChangeText={setDailyNeedText} currency={currency} size="medium" />
        {routineAverage ? (
          <ChipGroup>
            <Chip
              label={t('protections.followRoutines', {
                amount: formatMoney(routineAverage, currency, { whole: true }),
              })}
              selected={dailyNeed === null}
              onPress={() => setDailyNeedText('')}
            />
            <Chip
              label={t('protections.useDefault', {
                amount: formatMoney(defaultDailyNeed(currency), currency, { whole: true }),
              })}
              selected={dailyNeed === defaultDailyNeed(currency)}
              onPress={() => setDailyNeedText(amountToInput(defaultDailyNeed(currency), currency))}
            />
          </ChipGroup>
        ) : null}
      </Field>

      <Field label={t('protections.unexpected')} hint={t('protections.unexpectedHint')}>
        <ChipGroup>
          {SAVE_OPTIONS.map((option) => (
            <Chip
              key={option.percent}
              label={t(option.label)}
              selected={savePercent === option.percent}
              onPress={() => setSavePercent(option.percent)}
            />
          ))}
        </ChipGroup>
      </Field>

      <Field label={t('protections.unspent')}>
        <AppText variant="small" tone="secondary">
          {t('protections.unspentBody')}
        </AppText>
      </Field>

      <Card>
        <MoneyLine
          label={t('protections.pacePreview')}
          value={t('common.paceShift', {
            before: formatMoney(status.dailyAllowance, currency, { whole: true }),
            after: formatMoney(preview.dailyAllowance, currency, { whole: true }),
          })}
          strong
        />
        <StatusPill level={preview.riskLevel} label={statusLabel(preview.reason)} />
      </Card>
    </SheetScreen>
  );
}
