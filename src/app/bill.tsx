import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { newId } from '@/data/repository';
import { billOccurrences, nextDueAfter } from '@/domain/bills';
import { BILL_PRESETS } from '@/domain/categories';
import { addDays, formatShortDate, type LocalDate } from '@/domain/dates';
import { cycleBillOccurrences } from '@/domain/derive';
import { amountToInput, parseAmount } from '@/domain/money';
import type { Bill } from '@/domain/types';
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
  Segmented,
  SheetScreen,
  TextField,
} from '@/ui/components';
import { DateChoice } from '@/ui/date-picker';
import { usePalette } from '@/ui/theme';
import { showToast } from '@/ui/toast';

type BillKind = 'monthly' | 'once';

export default function BillScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const palette = usePalette();
  const financial = useFinancial();
  const saveBill = useApp((state) => state.saveBill);
  const deleteBill = useApp((state) => state.deleteBill);
  const payBill = useApp((state) => state.payBill);

  const existing = financial?.data.bills.find((bill) => bill.id === id);
  const today = financial?.today ?? '';

  const [name, setName] = useState(existing?.name ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? '🧾');
  const [amountText, setAmountText] = useState(() =>
    existing && financial ? amountToInput(existing.amount, financial.currency) : '',
  );
  const [kind, setKind] = useState<BillKind>(existing && !existing.recurring ? 'once' : 'monthly');
  const [dueDayText, setDueDayText] = useState(existing?.dueDay ? String(existing.dueDay) : '');
  const [dueDate, setDueDate] = useState<LocalDate | null>(existing?.dueDate ?? null);
  const [paidAnswer, setPaidAnswer] = useState<{ dueDate: LocalDate; paid: boolean } | null>(null);

  if (!financial) return null;
  const { currency, data } = financial;
  const amount = parseAmount(amountText, currency);
  const dueDay = Number(dueDayText);
  const validDueDay = Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31;

  const draft: Bill = {
    id: existing?.id ?? 'draft',
    name: name.trim(),
    emoji,
    amount: amount ?? 0,
    recurring: kind === 'monthly',
    dueDay: kind === 'monthly' && validDueDay ? dueDay : null,
    dueDate: kind === 'once' ? dueDate : null,
    archived: false,
    createdOn: existing?.createdOn ?? today,
  };
  const scheduleChanged =
    !existing ||
    existing.recurring !== draft.recurring ||
    existing.dueDay !== draft.dueDay ||
    existing.dueDate !== draft.dueDate;

  // A due date that already passed: ask instead of guessing whether it was paid.
  const pastDue =
    scheduleChanged && (kind === 'once' || validDueDay)
      ? (billOccurrences([draft], data.transactions, data.cycle.startDate, today)
          .filter((occurrence) => !occurrence.paid && occurrence.dueDate < today)
          .at(-1)?.dueDate ?? null)
      : null;
  const answer = paidAnswer && paidAnswer.dueDate === pastDue ? paidAnswer : null;

  const upcoming =
    !pastDue && (kind === 'once' || validDueDay)
      ? billOccurrences([draft], data.transactions, data.cycle.startDate, data.cycle.nextIncomeDate).find(
          (occurrence) => !occurrence.paid && occurrence.dueDate >= today,
        )
      : undefined;
  const laterDue = !pastDue && !upcoming ? nextDueAfter(draft, data.cycle.nextIncomeDate) : null;
  const scheduleHint = upcoming
    ? draft.recurring || draft.dueDate
      ? `Next due ${formatShortDate(upcoming.dueDate)} · protected before your income.`
      : 'Protected until you pay it.'
    : laterDue
      ? `Next due ${formatShortDate(laterDue)}, after your income · protected from next cycle.`
      : undefined;

  const unpaid =
    existing && !scheduleChanged
      ? cycleBillOccurrences(data, today).find((occurrence) => occurrence.bill.id === existing.id && !occurrence.paid)
      : undefined;

  const valid =
    draft.name.length > 0 && !!amount && (kind === 'once' || validDueDay) && (pastDue === null || answer !== null);

  const save = () => {
    if (!valid || !amount) return;
    const bill: Bill = { ...draft, id: existing?.id ?? newId() };
    saveBill(bill);
    if (pastDue && answer?.paid) {
      payBill({ billId: bill.id, dueDate: pastDue, amount: bill.amount, date: pastDue });
    }
    haptics.success();
    router.back();
    if (pastDue) {
      showToast(
        answer?.paid
          ? `${emoji} ${bill.name} saved · marked paid for ${formatShortDate(pastDue)}`
          : `${emoji} ${bill.name} saved · overdue since ${formatShortDate(pastDue)}, kept protected`,
      );
    } else {
      showToast(existing ? 'Bill updated' : `${emoji} ${bill.name} added`);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(`Remove ${existing.name}?`, 'Past payments stay in your history.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteBill(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SheetScreen
      title={existing ? 'Edit bill' : 'Add bill'}
      footer={<Button label={existing ? 'Save changes' : 'Add bill'} onPress={save} disabled={!valid} />}>
      {unpaid ? (
        <Card tint={unpaid.dueDate < today ? palette.watchSoft : undefined}>
          <AppText variant="bodyStrong">
            {unpaid.dueDate < today
              ? `⚠️ Overdue since ${formatShortDate(unpaid.dueDate)}`
              : existing?.recurring || existing?.dueDate
                ? `Due ${formatShortDate(unpaid.dueDate)}`
                : 'Due before your next income'}
          </AppText>
          <Button
            label="Mark as paid"
            compact
            onPress={() =>
              router.replace({ pathname: '/pay-bill', params: { billId: unpaid.bill.id, dueDate: unpaid.dueDate } })
            }
          />
        </Card>
      ) : null}

      {!existing ? (
        <ChipGroup>
          {BILL_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              emoji={preset.emoji}
              label={preset.label}
              selected={emoji === preset.emoji && name === preset.label}
              onPress={() => {
                setEmoji(preset.emoji);
                setName(preset.id === 'other' ? '' : preset.label);
              }}
            />
          ))}
        </ChipGroup>
      ) : null}

      <Field label="Name">
        <TextField value={name} onChangeText={setName} placeholder="Rent" />
      </Field>

      <Field label="Amount" hint="For variable bills, use your best estimate. You'll confirm the real amount when you pay.">
        <AmountField value={amountText} onChangeText={setAmountText} currency={currency} size="medium" />
      </Field>

      <Field label="How often">
        <Segmented
          options={[
            { value: 'monthly', label: 'Every month' },
            { value: 'once', label: 'One time' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </Field>

      {kind === 'monthly' ? (
        <Field label="Due on day" hint={scheduleHint ?? 'Day of the month (1–31). Short months use their last day.'}>
          <TextField
            value={dueDayText}
            onChangeText={(text) => setDueDayText(text.replace(/\D/g, '').slice(0, 2))}
            placeholder="1"
            keyboardType="number-pad"
          />
        </Field>
      ) : (
        <Field label="Due" hint={scheduleHint}>
          <ChipGroup>
            <Chip label="Before my next income" selected={dueDate === null} onPress={() => setDueDate(null)} />
          </ChipGroup>
          <DateChoice
            value={dueDate ?? data.cycle.nextIncomeDate}
            onChange={setDueDate}
            options={[
              { label: 'In 1 week', date: addDays(today, 7) },
              { label: 'In 2 weeks', date: addDays(today, 14) },
            ]}
          />
        </Field>
      )}

      {pastDue ? (
        <Card tint={palette.watchSoft}>
          <AppText variant="bodyStrong">
            📅 {kind === 'monthly' ? "This month's payment" : 'This payment'} was due {formatShortDate(pastDue)}
          </AppText>
          <AppText tone="secondary">Have you already paid it?</AppText>
          <ChipGroup>
            <Chip
              emoji="✅"
              label="Yes, already paid"
              selected={answer?.paid === true}
              onPress={() => setPaidAnswer({ dueDate: pastDue, paid: true })}
            />
            <Chip
              emoji="⏳"
              label="Not yet"
              selected={answer?.paid === false}
              onPress={() => setPaidAnswer({ dueDate: pastDue, paid: false })}
            />
          </ChipGroup>
          {answer ? (
            <AppText variant="caption" tone="secondary">
              {answer.paid
                ? pastDue < data.settings.openingDate
                  ? "We'll mark it paid. Your balance already includes it, so it won't change."
                  : `We'll record the payment on ${formatShortDate(pastDue)} and take it from your balance.`
                : "It stays protected and shows as overdue until you pay it."}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      {existing ? (
        <Card>
          <AppText variant="caption" tone="muted">
            Removing a bill stops protecting it. Payments you already recorded stay in Activity.
          </AppText>
          <Button label="Remove bill" variant="danger" compact onPress={remove} />
        </Card>
      ) : null}
    </SheetScreen>
  );
}
