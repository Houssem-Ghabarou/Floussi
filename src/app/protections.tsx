import { useRouter } from 'expo-router';
import { useState } from 'react';

import { STATUS_LABELS } from '@/domain/advice';
import { savingsMovedInCycle } from '@/domain/derive';
import { calculateFinancialStatus } from '@/domain/engine';
import { amountToInput, defaultDailyNeed, formatMoney, parseAmount, type Minor } from '@/domain/money';
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

const SAVE_OPTIONS = [
  { percent: 0, label: 'Use it' },
  { percent: 50, label: 'Save half' },
  { percent: 100, label: 'Save it all' },
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
    financial
      ? amountToInput(financial.data.settings.dailyNeed ?? defaultDailyNeed(financial.currency), financial.currency)
      : '',
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

  // Keep following the currency default unless the user picks their own figure; clearing the field resets it.
  const typedDailyNeed = parseAmount(dailyNeedText, currency);
  const followsDefault =
    data.settings.dailyNeed == null && (typedDailyNeed === null || typedDailyNeed === defaultDailyNeed(currency));
  const dailyNeed = followsDefault ? null : typedDailyNeed;

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
    showToast(`Saved. Your safe pace is ${formatMoney(preview.dailyAllowance, currency, { whole: true })}/day.`);
  };

  const recordTransfer = () => {
    if (!moveAmount) return;
    const transfer = addTransaction({ kind: 'savings_transfer', amount: -moveAmount, date: today });
    haptics.success();
    setMoveText('');
    showToast(`${m(moveAmount)} moved to savings`, { label: 'Undo', onPress: () => deleteTransaction(transfer.id) });
  };

  return (
    <SheetScreen title="Protections" footer={<Button label="Save" onPress={save} />}>
      <AppText tone="secondary">
        Protected money is kept out of your safe pace. You're always in control of these numbers.
      </AppText>

      <Field
        label="🐷 Savings this cycle"
        hint={moved > 0 ? `${m(moved)} already moved to savings this cycle.` : 'Kept aside inside your balance until you move it.'}>
        <AmountField value={savingsText} onChangeText={setSavingsText} currency={currency} size="medium" />
      </Field>

      <Card>
        <AppText variant="bodyStrong">Moved money to your savings account?</AppText>
        <AppText variant="small" tone="secondary">
          Record it here. Your balance goes down, but your safe pace stays the same.
        </AppText>
        <AmountField value={moveText} onChangeText={setMoveText} currency={currency} size="medium" />
        <Button label="Record transfer" variant="secondary" compact disabled={!moveAmount} onPress={recordTransfer} />
      </Card>

      <Field label="🛟 Minimum balance" hint="A cushion you never want to go below. It's never part of your safe pace.">
        <AmountField value={minimumText} onChangeText={setMinimumText} currency={currency} size="medium" />
      </Field>

      {status.normalDaySource === 'routines' ? (
        <Field label="☀️ Normal day">
          <AppText variant="small" tone="secondary">
            Based on your routines: about {formatMoney(status.normalDay, currency, { whole: true })} a day. Your status
            color compares your safe pace with it.
          </AppText>
        </Field>
      ) : (
        <Field
          label="☀️ A normal day costs me about"
          hint="Your status color compares your safe pace with it: 🟢 it covers a normal day, 🟡 it's under a normal day, 🔴 it's under half.">
          <AmountField value={dailyNeedText} onChangeText={setDailyNeedText} currency={currency} size="medium" />
        </Field>
      )}

      <Field label="🎁 Unexpected income" hint="Suggested choice when you add money that isn't your main income.">
        <ChipGroup>
          {SAVE_OPTIONS.map((option) => (
            <Chip
              key={option.percent}
              label={option.label}
              selected={savePercent === option.percent}
              onPress={() => setSavePercent(option.percent)}
            />
          ))}
        </ChipGroup>
      </Field>

      <Field label="🔄 Unspent money">
        <AppText variant="small" tone="secondary">
          What you don't spend spreads evenly over the remaining days, so tomorrow gets a little more without tempting
          you to spend it all at once.
        </AppText>
      </Field>

      <Card>
        <MoneyLine
          label="Safe pace with these settings"
          value={`${formatMoney(status.dailyAllowance, currency, { whole: true })} → ${formatMoney(preview.dailyAllowance, currency, { whole: true })}/day`}
          strong
        />
        <StatusPill level={preview.riskLevel} label={STATUS_LABELS[preview.reason]} />
      </Card>
    </SheetScreen>
  );
}
