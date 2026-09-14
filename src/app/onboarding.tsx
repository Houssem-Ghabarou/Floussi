import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { newId } from '@/data/repository';
import { buildAdvice } from '@/domain/advice';
import { billOccurrences, nextDueAfter } from '@/domain/bills';
import { BILL_PRESETS, INCOME_SOURCES } from '@/domain/categories';
import { FREQUENCY_LABELS } from '@/domain/cycle';
import { addDays, dateInMonth, formatShortDate, splitDate, type LocalDate } from '@/domain/dates';
import { calculateFinancialStatus } from '@/domain/engine';
import { CURRENCIES, formatAmount, formatMoney, fromMajor, getCurrency, parseAmount, type Minor } from '@/domain/money';
import type { Bill, IncomeFrequency, Transaction } from '@/domain/types';
import { useApp } from '@/store/app-store';
import {
  AmountField,
  AppText,
  Button,
  Card,
  Chip,
  ChipGroup,
  Divider,
  Field,
  MoneyLine,
  StatusPill,
  TextField,
} from '@/ui/components';
import { DateChoice } from '@/ui/date-picker';
import { MaxContentWidth, Radius, riskColors, Space, usePalette } from '@/ui/theme';

const STEPS = ['welcome', 'balance', 'income', 'bills', 'protect', 'plan'] as const;
type Step = (typeof STEPS)[number];

interface DraftBill {
  key: string;
  name: string;
  emoji: string;
  amountText: string;
  dueDayText: string;
  /** Answer to "this month's due date already passed — did you pay it?" */
  paidAnswer: boolean | null;
}

function lastDayOfMonth(date: LocalDate): LocalDate {
  const [year, month] = splitDate(date);
  const end = dateInMonth(year, month, 31);
  return end > date ? end : dateInMonth(year, month + 1, 31);
}

function parseDueDay(text: string): number | null {
  const day = Number(text);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

/** This month's due date of a monthly payment, when it has already passed. */
function pastDueDate(draft: DraftBill, today: LocalDate): LocalDate | null {
  const dueDay = parseDueDay(draft.dueDayText);
  if (dueDay === null) return null;
  const [year, month] = splitDate(today);
  const due = dateInMonth(year, month, dueDay);
  return due < today ? due : null;
}

export default function OnboardingScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = useApp((state) => state.today);
  const completeOnboarding = useApp((state) => state.completeOnboarding);

  const [step, setStep] = useState<Step>('welcome');
  const [currencyCode, setCurrencyCode] = useState('TND');
  const [balanceText, setBalanceText] = useState('');
  const [frequency, setFrequency] = useState<IncomeFrequency>('monthly');
  const [incomeLabel, setIncomeLabel] = useState('Salary');
  const [nextIncomeDate, setNextIncomeDate] = useState(() => lastDayOfMonth(today));
  const [expectedText, setExpectedText] = useState('');
  const [drafts, setDrafts] = useState<DraftBill[]>([]);
  const [savingsText, setSavingsText] = useState('');
  const [minimumText, setMinimumText] = useState('');

  const currency = getCurrency(currencyCode);
  const balance = parseAmount(balanceText, currency);
  const savings = parseAmount(savingsText, currency) ?? 0;
  const minimum = parseAmount(minimumText, currency) ?? 0;
  const m = (value: Minor) => formatMoney(value, currency, { whole: true });

  const bills: Bill[] = drafts.flatMap((draft) => {
    const amount = parseAmount(draft.amountText, currency);
    if (!amount) return [];
    const dueDay = parseDueDay(draft.dueDayText);
    return [
      {
        id: draft.key,
        name: draft.name.trim() || 'Payment',
        emoji: draft.emoji,
        amount,
        recurring: dueDay !== null,
        dueDay,
        dueDate: null,
        archived: false,
        createdOn: today,
      },
    ];
  });
  // "Already paid" answers settle due dates that passed earlier this month.
  const paidEarlier = drafts.flatMap<Transaction>((draft) => {
    const due = pastDueDate(draft, today);
    if (!due || !draft.paidAnswer) return [];
    return [
      {
        id: `paid-${draft.key}`,
        kind: 'bill_payment',
        amount: 0,
        category: null,
        note: null,
        date: due,
        billId: draft.key,
        billDueDate: due,
        countsToBalance: false,
        createdAt: 0,
      },
    ];
  });
  const protectedBills = billOccurrences(bills, paidEarlier, today, nextIncomeDate).filter(
    (occurrence) => !occurrence.paid,
  );
  const status = calculateFinancialStatus({
    today,
    balance: balance ?? 0,
    nextIncomeDate,
    billsDue: protectedBills.map((occurrence) => ({
      name: occurrence.bill.name,
      amount: occurrence.bill.amount,
      dueDate: occurrence.dueDate,
    })),
    savingsReserve: savings,
    minimumBalance: minimum,
    dailySpending: {},
    recentBalanceCorrections: 0,
    incomeSinceCorrections: 0,
    trackingStartDate: today,
    routineByWeekday: [0, 0, 0, 0, 0, 0, 0],
  });
  const advice = buildAdvice(status, currency);

  const stepIndex = STEPS.indexOf(step);
  const canContinue =
    (step !== 'balance' || balance !== null) &&
    (step !== 'income' || nextIncomeDate > today) &&
    (step !== 'bills' || drafts.every((draft) => pastDueDate(draft, today) === null || draft.paidAnswer !== null));
  const irregular = frequency === 'irregular';

  const goNext = () => {
    if (step === 'plan') {
      completeOnboarding({
        currency: currencyCode,
        balance: balance ?? 0,
        nextIncomeDate,
        expectedIncome: parseAmount(expectedText, currency),
        incomeLabel: irregular ? 'Next money' : incomeLabel,
        frequency,
        savingsTarget: savings,
        minimumBalance: minimum,
        bills: bills.map(({ id, archived: _archived, createdOn: _createdOn, ...bill }) => {
          const draft = drafts.find((item) => item.key === id);
          const due = draft ? pastDueDate(draft, today) : null;
          return { ...bill, alreadyPaidOn: due && draft?.paidAnswer ? due : null };
        }),
      });
      router.replace('/');
      return;
    }
    setStep(STEPS[stepIndex + 1]);
  };

  const updateDraft = (key: string, patch: Partial<DraftBill>) =>
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));

  const suggestion = (percent: number) =>
    balance ? Math.round((balance * percent) / 100 / fromMajor(10, currency)) * fromMajor(10, currency) : 0;

  let content: ReactNode;
  switch (step) {
    case 'welcome':
      content = (
        <>
          <AppText style={styles.welcomeEmoji}>🌱</AppText>
          <AppText variant="title">Make your money last</AppText>
          <AppText tone="secondary">Know what you can safely spend every day until your next income.</AppText>
          <Card>
            <AppText>💰 What you have now</AppText>
            <AppText>📅 When your next income arrives</AppText>
            <AppText>🏠 What you still need to pay</AppText>
            <AppText>🐷 What you want to protect</AppText>
            <Divider />
            <AppText variant="small" tone="secondary">
              About a minute. You can start any day of the month, and your data stays on this phone.
            </AppText>
          </Card>
          <Field label="Currency">
            <ChipGroup>
              {CURRENCIES.map((item) => (
                <Chip
                  key={item.code}
                  label={item.code}
                  selected={item.code === currencyCode}
                  onPress={() => setCurrencyCode(item.code)}
                />
              ))}
            </ChipGroup>
          </Field>
        </>
      );
      break;

    case 'balance':
      content = (
        <>
          <AppText variant="title">How much money do you have right now?</AppText>
          <AppText tone="secondary">
            Cash plus what's in your account, whatever you can spend from. No need to go back to the start of the
            month.
          </AppText>
          <AmountField value={balanceText} onChangeText={setBalanceText} currency={currency} autoFocus />
        </>
      );
      break;

    case 'income':
      content = (
        <>
          <AppText variant="title">
            {irregular ? 'Until when should this money last?' : 'When is your next income?'}
          </AppText>
          <ChipGroup>
            {(Object.keys(FREQUENCY_LABELS) as IncomeFrequency[]).map((value) => (
              <Chip
                key={value}
                label={FREQUENCY_LABELS[value]}
                selected={frequency === value}
                onPress={() => setFrequency(value)}
              />
            ))}
          </ChipGroup>
          {!irregular ? (
            <Field label="It's my">
              <ChipGroup>
                {INCOME_SOURCES.slice(0, 3).map((source) => (
                  <Chip
                    key={source.id}
                    emoji={source.emoji}
                    label={source.label}
                    selected={incomeLabel === source.label}
                    onPress={() => setIncomeLabel(source.label)}
                  />
                ))}
              </ChipGroup>
            </Field>
          ) : null}
          <Field label={irregular ? 'Make it last until' : 'Expected on'}>
            <DateChoice
              value={nextIncomeDate}
              onChange={setNextIncomeDate}
              minDate={addDays(today, 1)}
              options={[
                { label: 'In 1 week', date: addDays(today, 7) },
                { label: 'In 2 weeks', date: addDays(today, 14) },
                { label: 'End of month', date: lastDayOfMonth(today) },
              ]}
            />
          </Field>
          {!irregular ? (
            <Field label="About how much? (optional)" hint="Only used for your summary. We never count money before it arrives.">
              <AmountField value={expectedText} onChangeText={setExpectedText} currency={currency} size="medium" />
            </Field>
          ) : null}
        </>
      );
      break;

    case 'bills':
      content = (
        <>
          <AppText variant="title">What payments are still coming before {formatShortDate(nextIncomeDate)}?</AppText>
          <AppText tone="secondary">Rent, bills, subscriptions… We'll keep that money protected.</AppText>
          <ChipGroup>
            {BILL_PRESETS.map((preset) => (
              <Chip
                key={preset.id}
                emoji={preset.emoji}
                label={preset.label}
                onPress={() =>
                  setDrafts((current) => [
                    ...current,
                    {
                      key: newId(),
                      name: preset.id === 'other' ? '' : preset.label,
                      emoji: preset.emoji,
                      amountText: '',
                      dueDayText: '',
                      paidAnswer: null,
                    },
                  ])
                }
              />
            ))}
          </ChipGroup>
          {drafts.map((draft) => {
            const dueDay = parseDueDay(draft.dueDayText);
            const pastDue = pastDueDate(draft, today);
            const nextDue =
              dueDay === null
                ? null
                : nextDueAfter(
                    { id: draft.key, name: draft.name, emoji: draft.emoji, amount: 0, recurring: true, dueDay, dueDate: null, archived: false, createdOn: today },
                    addDays(today, -1),
                  );
            return (
              <Card key={draft.key}>
                <View style={styles.billHeader}>
                  <AppText style={styles.billEmoji}>{draft.emoji}</AppText>
                  <TextField
                    value={draft.name}
                    onChangeText={(name) => updateDraft(draft.key, { name })}
                    placeholder="Name"
                    style={styles.flex}
                  />
                  <Pressable
                    hitSlop={10}
                    accessibilityLabel="Remove payment"
                    onPress={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))}>
                    <AppText variant="heading" tone="muted">
                      ✕
                    </AppText>
                  </Pressable>
                </View>
                <AmountField
                  value={draft.amountText}
                  onChangeText={(amountText) => updateDraft(draft.key, { amountText })}
                  currency={currency}
                  size="medium"
                />
                <TextField
                  value={draft.dueDayText}
                  onChangeText={(text) =>
                    updateDraft(draft.key, { dueDayText: text.replace(/\D/g, '').slice(0, 2), paidAnswer: null })
                  }
                  placeholder="Every month on day… (optional)"
                  keyboardType="number-pad"
                />
                <AppText variant="caption" tone="muted">
                  {dueDay === null || !nextDue
                    ? `One-time payment before ${formatShortDate(nextIncomeDate)}.`
                    : nextDue <= nextIncomeDate
                      ? `Monthly · next due ${formatShortDate(nextDue)} · protected now.`
                      : `Monthly · next due ${formatShortDate(nextDue)}, after your income · protected from next cycle.`}
                </AppText>
                {pastDue ? (
                  <View style={[styles.question, { backgroundColor: palette.watchSoft }]}>
                    <AppText variant="small" style={styles.questionTitle}>
                      📅 This month's payment was due {formatShortDate(pastDue)}. Have you already paid it?
                    </AppText>
                    <ChipGroup>
                      <Chip
                        emoji="✅"
                        label="Yes, paid"
                        selected={draft.paidAnswer === true}
                        onPress={() => updateDraft(draft.key, { paidAnswer: true })}
                      />
                      <Chip
                        emoji="⏳"
                        label="Not yet"
                        selected={draft.paidAnswer === false}
                        onPress={() => updateDraft(draft.key, { paidAnswer: false })}
                      />
                    </ChipGroup>
                    {draft.paidAnswer !== null ? (
                      <AppText variant="caption" tone="secondary">
                        {draft.paidAnswer
                          ? 'Marked paid. The money you entered already reflects it.'
                          : 'It stays protected as overdue until you pay it.'}
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </>
      );
      break;

    case 'protect':
      content = (
        <>
          <AppText variant="title">What do you want to protect?</AppText>
          <Field label="🐷 Savings this cycle" hint="Kept aside until you move it to savings.">
            <AmountField value={savingsText} onChangeText={setSavingsText} currency={currency} size="medium" />
            <ChipGroup>
              {[0, 5, 10, 20].map((percent) => (
                <Chip
                  key={percent}
                  label={percent === 0 ? 'None' : `${percent}% · ${formatAmount(suggestion(percent), currency, { whole: true })}`}
                  onPress={() => setSavingsText(percent === 0 ? '' : formatAmount(suggestion(percent), currency, { whole: true }).replace(/,/g, ''))}
                />
              ))}
            </ChipGroup>
          </Field>
          <Field label="🛟 Minimum balance" hint="A safety cushion you never want to go below.">
            <AmountField value={minimumText} onChangeText={setMinimumText} currency={currency} size="medium" />
            <ChipGroup>
              {[0, 50, 100, 200].map((value) => (
                <Chip key={value} label={value === 0 ? 'None' : `${value}`} onPress={() => setMinimumText(value ? String(value) : '')} />
              ))}
            </ChipGroup>
          </Field>
        </>
      );
      break;

    case 'plan': {
      const colors = riskColors(palette, status.riskLevel);
      content = (
        <>
          <AppText variant="title">Your first plan</AppText>
          <Card>
            <MoneyLine label="Available now" value={m(balance ?? 0)} />
            <MoneyLine label={`Bills before ${formatShortDate(nextIncomeDate)}`} value={m(-status.billsProtected)} />
            <MoneyLine label="Savings" value={m(-savings)} />
            <MoneyLine label="Minimum balance" value={m(-minimum)} />
            <Divider />
            <MoneyLine label="Flexible money" value={m(status.flexibleNow)} strong />
            <MoneyLine label={`Spread over ${status.daysRemaining} days`} value={`÷ ${status.daysRemaining}`} />
          </Card>
          <Card tint={colors.bg} style={styles.planHero}>
            <AppText variant="label" color={colors.fg}>
              Safe daily pace
            </AppText>
            <AppText variant="hero">{formatAmount(status.dailyAllowance, currency, { whole: true })}</AppText>
            <AppText tone="secondary">{currency.label} per day</AppText>
            <StatusPill level={status.riskLevel} />
            <AppText variant="bodyStrong" style={styles.center}>
              {advice.title}
            </AppText>
            <AppText tone="secondary" style={styles.center}>
              {advice.suggestion ?? advice.detail}
            </AppText>
          </Card>
          <AppText variant="small" tone="secondary">
            Add your routines and any spending from earlier this month whenever you like.
          </AppText>
        </>
      );
      break;
    }
  }

  const showPreview = (step === 'bills' || step === 'protect') && balance !== null;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top + Space.sm }]}>
        {stepIndex > 0 ? (
          <Pressable hitSlop={12} onPress={() => setStep(STEPS[stepIndex - 1])} accessibilityRole="button">
            <AppText variant="bodyStrong" tone="brand">
              ‹ Back
            </AppText>
          </Pressable>
        ) : (
          <View />
        )}
        {stepIndex > 0 ? (
          <View style={styles.dots}>
            {STEPS.slice(1).map((item, index) => (
              <View
                key={item}
                style={[styles.dot, { backgroundColor: index < stepIndex ? palette.brand : palette.border }]}
              />
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>{content}</View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Space.md, borderTopColor: palette.border }]}>
        <View style={styles.inner}>
          {showPreview ? (
            <View style={[styles.preview, { backgroundColor: palette.surfaceMuted }]}>
              <AppText variant="small" tone="secondary">
                Safe pace so far
              </AppText>
              <AppText variant="bodyStrong">{m(status.dailyAllowance)}/day</AppText>
            </View>
          ) : null}
          <Button
            label={step === 'welcome' ? 'Get started' : step === 'plan' ? 'Start my plan' : 'Continue'}
            onPress={goNext}
            disabled={!canContinue}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingBottom: Space.sm,
    minHeight: 44,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 18, height: 6, borderRadius: 3 },
  content: { padding: Space.lg, paddingBottom: Space.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Space.lg },
  footer: { paddingHorizontal: Space.lg, paddingTop: Space.md, borderTopWidth: StyleSheet.hairlineWidth },
  preview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
  welcomeEmoji: { fontSize: 56, lineHeight: 68, marginTop: Space.xl },
  billHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  billEmoji: { fontSize: 24 },
  question: { borderRadius: Radius.sm, padding: Space.md, gap: Space.sm },
  questionTitle: { fontWeight: '700' },
  planHero: { alignItems: 'center', gap: Space.sm, paddingVertical: Space.xl },
});
