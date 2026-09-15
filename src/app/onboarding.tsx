import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { newId } from '@/data/repository';
import { buildAdvice, STATUS_LABELS } from '@/domain/advice';
import { billOccurrences, nextDueAfter } from '@/domain/bills';
import { BILL_PRESETS, INCOME_SOURCES } from '@/domain/categories';
import { FREQUENCY_LABELS } from '@/domain/cycle';
import { addDays, dateInMonth, formatLongDate, formatShortDate, splitDate, type LocalDate } from '@/domain/dates';
import { calculateFinancialStatus } from '@/domain/engine';
import {
  amountToInput,
  CURRENCIES,
  defaultDailyNeed,
  formatAmount,
  formatMoney,
  fromMajor,
  getCurrency,
  parseAmount,
  type Minor,
} from '@/domain/money';
import type { Bill, IncomeFrequency, Transaction } from '@/domain/types';
import { useApp } from '@/store/app-store';
import {
  AmountField,
  AppText,
  Badge,
  Button,
  Callout,
  Card,
  Chip,
  ChipGroup,
  Field,
  haptics,
  IconCircle,
  LegendDot,
  ProgressBar,
  SegmentBar,
  TextField,
} from '@/ui/components';
import { DateChoice } from '@/ui/date-picker';
import { Icon, type IconName } from '@/ui/icon';
import { CardShadow, Fonts, heroColors, MaxContentWidth, Radius, Space, usePalette } from '@/ui/theme';
import { useBackupActions } from '@/ui/use-backup';

const STEPS = ['welcome', 'now', 'bills', 'protect', 'plan'] as const;
type Step = (typeof STEPS)[number];

/** Shown next to the brand in the header. */
const STEP_CONTEXT: Record<Step, string> = {
  welcome: 'Welcome',
  now: 'Money & payday',
  bills: 'Fixed commitments',
  protect: 'Protections',
  plan: 'Plan generated',
};

const NEXT_LABEL: Record<Step, string> = {
  welcome: 'Get started',
  now: 'Next: payments',
  bills: 'Next: protections',
  protect: 'Next: see my plan',
  plan: 'Enter Flousey today',
};

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
  const { restore } = useBackupActions({ onRestored: () => router.replace('/') });

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
  /** Null until the user changes it, so it follows the chosen currency's default. */
  const [dailyNeedText, setDailyNeedText] = useState<string | null>(null);

  const currency = getCurrency(currencyCode);
  const balance = parseAmount(balanceText, currency);
  const savings = parseAmount(savingsText, currency) ?? 0;
  const minimum = parseAmount(minimumText, currency) ?? 0;
  const dailyNeed = dailyNeedText === null ? null : parseAmount(dailyNeedText, currency);
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
    dailyNeed: dailyNeed ?? defaultDailyNeed(currency),
    dailyNeedIsDefault: dailyNeed === null,
  });
  const advice = buildAdvice(status, currency);

  const stepIndex = STEPS.indexOf(step);
  const stepCount = STEPS.length - 1;
  const canContinue =
    (step !== 'now' || (balance !== null && nextIncomeDate > today)) &&
    (step !== 'bills' || drafts.every((draft) => pastDueDate(draft, today) === null || draft.paidAnswer !== null));
  const irregular = frequency === 'irregular';
  const days = status.daysRemaining;
  const daysLabel = `${days} ${days === 1 ? 'day' : 'days'}`;
  const [incomeWeekday, incomeMonthDay] = formatLongDate(nextIncomeDate).split(', ');

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
        dailyNeed,
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
  const goBack = () => setStep(STEPS[Math.max(0, stepIndex - 1)]);

  const updateDraft = (key: string, patch: Partial<DraftBill>) =>
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));

  const suggestion = (percent: number) =>
    balance ? Math.round((balance * percent) / 100 / fromMajor(10, currency)) * fromMajor(10, currency) : 0;

  let content: ReactNode;
  switch (step) {
    case 'welcome':
      content = (
        <>
          <Badge dot label="A calm money rhythm" color={palette.onBrandSoft} background={palette.brandSoft} />
          <View style={styles.intro}>
            <AppText style={styles.welcomeTitle}>Make your money last until your next income.</AppText>
            <AppText tone="secondary" style={styles.lead}>
              A calm, manual coach that shows what you can safely spend today — no bank connection, no spreadsheets,
              no guilt.
            </AppText>
          </View>

          <View style={[styles.quote, { backgroundColor: palette.surfaceLow }, CardShadow]}>
            <IconCircle icon="eco" size={32} color={palette.onBrandSoft} background={palette.brandSoft} />
            <AppText variant="small" tone="secondary" style={[styles.flex, styles.italic]}>
              “Flousey doesn't move your money or judge your choices. It just keeps you safe until payday.”
            </AppText>
          </View>

          <FeatureCard
            icon="month"
            tile={palette.surfaceHigh}
            color={palette.textSecondary}
            title="Start anywhere, even mid-month"
            body="No past receipts, no clean spreadsheets, no waiting for the 1st of the month."
          />
          <FeatureCard
            icon="shield"
            tile={palette.brandSoft}
            color={palette.onBrandSoft}
            title="Know your safe daily spend"
            body="Rent, bills and savings are protected before you spend a single dinar."
          />
          <FeatureCard
            icon="routine"
            tile={palette.accentSoft}
            color={palette.accentText}
            title="Personal routines, zero judgment"
            body="Realistic pacing that adapts to how you actually live."
          />
          <FeatureCard
            icon="lock"
            tile={palette.atRiskSoft}
            color={palette.danger}
            title="Manual & private"
            body="Offline-first. Your numbers stay on this phone, no login required."
          />

          <Card>
            <View style={styles.spaceBetween}>
              <AppText variant="label" tone="secondary">
                Your currency
              </AppText>
              <AppText variant="caption" tone="muted">
                Used for every amount
              </AppText>
            </View>
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
          </Card>

          <View style={[styles.glanceBox, { backgroundColor: palette.surfaceHigh }]}>
            <View style={styles.spaceBetween}>
              <AppText variant="label" tone="secondary">
                How your plan works
              </AppText>
              <AppText variant="small" tone="brand" style={styles.strong}>
                Safe pace / day
              </AppText>
            </View>
            <SegmentBar
              track={palette.surfaceHighest}
              segments={[
                { value: 62, color: palette.brand },
                { value: 18, color: palette.accent },
                { value: 20, color: palette.surfaceHighest },
              ]}
            />
            <View style={styles.spaceBetween}>
              <LegendDot color={palette.brand} label="Safe to spend" textColor={palette.textSecondary} />
              <LegendDot color={palette.accent} label="Protected" textColor={palette.textSecondary} />
              <LegendDot color={palette.outline} label="Bills" textColor={palette.textSecondary} />
            </View>
          </View>

          <Button label="Already use Flousey? Restore a backup" variant="ghost" onPress={restore} />
        </>
      );
      break;

    case 'now':
      content = (
        <>
          <Badge icon="spa" label="Zero-judgment starting point" color={palette.brand} background={`${palette.brand}1A`} />
          <StepIntro
            title="Tell us about right now"
            subtitle="Two simple numbers set your starting point and your daily safe pace. No need to wait for the 1st."
          />

          <Card style={CardShadow}>
            <FieldHeader
              dot={palette.brandDeep}
              title="Money available right now"
              tag="Starting point"
              subtitle="Cash in your wallet + what's in your account"
            />
            <View style={[styles.inputPanel, { backgroundColor: palette.surfaceLow }]}>
              <AmountField value={balanceText} onChangeText={setBalanceText} currency={currency} />
              <AppText variant="caption" tone="secondary" style={styles.center}>
                Whatever you can spend from. No need to go back to the start of the month.
              </AppText>
            </View>
            <View style={styles.quickRow}>
              {[50, 100].map((value) => (
                <QuickButton
                  key={value}
                  icon="add"
                  label={`${value} ${currency.label}`}
                  onPress={() => setBalanceText(amountToInput((balance ?? 0) + fromMajor(value, currency), currency))}
                />
              ))}
              <QuickButton icon="close" label="Clear" muted onPress={() => setBalanceText('')} />
            </View>
          </Card>

          <Card style={CardShadow}>
            <FieldHeader
              dot={palette.accent}
              title={irregular ? 'Until when should this money last?' : 'When is your next income?'}
              tag="Your horizon"
              tagColor={palette.accentText}
              tagBackground={`${palette.accentSoft}80`}
              subtitle="Sets how many days your money needs to cover"
            />
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
            {nextIncomeDate > today ? (
              <View style={[styles.dateCard, { backgroundColor: palette.surfaceLow }]}>
                <View style={[styles.dateTile, { backgroundColor: `${palette.brand}1A` }]}>
                  <Icon name="month" size={20} color={palette.brand} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="heading">{incomeMonthDay}</AppText>
                  <AppText variant="small" tone="secondary">
                    {incomeWeekday}
                  </AppText>
                </View>
                <Badge dot label={`${daysLabel} ahead`} color={palette.onBrandSoft} background={palette.brandSoft} />
              </View>
            ) : null}
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
            {!irregular ? (
              <>
                <AppText variant="label" tone="secondary">
                  Income type
                </AppText>
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
                <Field
                  label="About how much? (optional)"
                  hint="Only used for your summary. We never count money before it arrives.">
                  <AmountField value={expectedText} onChangeText={setExpectedText} currency={currency} size="medium" />
                </Field>
              </>
            ) : null}
          </Card>

          <Callout icon="lightbulb" iconColor={palette.onBrandSoft} iconBackground={palette.brandSoft} title="Why this matters">
            <AppText variant="small" tone="secondary">
              Traditional budgets make you backlog weeks of past coffees. Flousey only cares about the days ahead, and
              you can correct this number anytime.
            </AppText>
          </Callout>

          {balance !== null && nextIncomeDate > today ? (
            <View style={[styles.glance, { backgroundColor: palette.surface }, CardShadow]}>
              <Icon name="insights" size={18} color={palette.brand} />
              <View style={styles.flex}>
                <AppText variant="small" style={styles.strong}>
                  First look at your daily pace
                </AppText>
                <AppText variant="caption" tone="secondary">
                  Before bills and savings are protected
                </AppText>
              </View>
              <View style={styles.alignEnd}>
                <AppText variant="heading" tone="brand" style={styles.bold}>
                  ~{m(Math.floor(balance / days))}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  / day for {daysLabel}
                </AppText>
              </View>
            </View>
          ) : null}
        </>
      );
      break;

    case 'bills':
      content = (
        <>
          <Badge icon="receipt" label="Fixed commitments" color={palette.brand} background={`${palette.brand}1A`} />
          <StepIntro
            title={`What payments are still coming before ${formatShortDate(nextIncomeDate)}?`}
            subtitle="Rent, bills, subscriptions… We'll keep that money protected."
          />
          <Card style={CardShadow}>
            <AppText variant="label" tone="secondary">
              Tap to add
            </AppText>
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
          </Card>
          {drafts.length === 0 ? (
            <Callout icon="info" title="Nothing due before payday?">
              <AppText variant="small" tone="secondary">
                You can continue. Bills can be added anytime from Rules.
              </AppText>
            </Callout>
          ) : null}
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
              <Card key={draft.key} style={CardShadow}>
                <View style={styles.billHeader}>
                  <IconCircle emoji={draft.emoji} size={40} background={palette.surfaceLow} />
                  <TextField
                    value={draft.name}
                    onChangeText={(name) => updateDraft(draft.key, { name })}
                    placeholder="Name"
                    style={styles.flex}
                  />
                  <Pressable
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Remove payment"
                    onPress={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))}>
                    <Icon name="close" size={22} color={palette.textMuted} />
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
                    <View style={styles.questionRow}>
                      <Icon name="event" size={16} color={palette.watch} />
                      <AppText variant="small" style={[styles.flex, styles.bold]}>
                        This month's payment was due {formatShortDate(pastDue)}. Have you already paid it?
                      </AppText>
                    </View>
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
          <Badge icon="shield" label="Peace-of-mind buffer" color={palette.brand} background={`${palette.brand}1A`} />
          <StepIntro
            title="What do you want to protect?"
            subtitle="This money stays untouchable. Your daily pace comes from what's left."
          />
          <Card style={CardShadow}>
            <FieldHeader dot={palette.brand} title="Savings this cycle" subtitle="Kept aside until you move it to savings" />
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
          </Card>
          <Card style={CardShadow}>
            <FieldHeader
              dot={palette.accent}
              title="Minimum balance"
              subtitle="A safety cushion you never want to go below"
            />
            <AmountField value={minimumText} onChangeText={setMinimumText} currency={currency} size="medium" />
            <ChipGroup>
              {[0, 50, 100, 200].map((value) => (
                <Chip key={value} label={value === 0 ? 'None' : `${value}`} onPress={() => setMinimumText(value ? String(value) : '')} />
              ))}
            </ChipGroup>
          </Card>
        </>
      );
      break;

    case 'plan': {
      const hero = heroColors(status.riskLevel);
      const reserved = savings + minimum;
      const flexible = Math.max(0, status.flexibleNow);
      const whole = (value: Minor) => formatAmount(value, currency, { whole: true });
      content = (
        <>
          <StepIntro
            title="Here is your first plan"
            subtitle={`Calculated for the ${daysLabel} ahead, until ${incomeMonthDay}.`}
          />

          <View style={[styles.planHero, { backgroundColor: hero.bg }]}>
            <View style={[styles.planHeroGlow, { backgroundColor: hero.glow }]} />
            <View style={styles.spaceBetween}>
              <AppText variant="label" color={hero.text}>
                Your safe daily pace
              </AppText>
              <View style={styles.heroBadge}>
                <View style={[styles.dot, { backgroundColor: hero.strong }]} />
                <AppText variant="caption" color={hero.strong} style={styles.strong}>
                  {STATUS_LABELS[status.reason]}
                </AppText>
              </View>
            </View>
            <View style={styles.baseline}>
              <AppText variant="display" color="#FFFFFF">
                {whole(status.dailyAllowance)}
              </AppText>
              <AppText variant="title" color={hero.text}>
                {currency.label}
              </AppText>
              <AppText variant="small" color={hero.text}>
                / day
              </AppText>
            </View>
            <View style={styles.formula}>
              <Icon name="info" size={16} color={hero.text} />
              <Text style={styles.formulaText}>
                {`${whole(balance ?? 0)} available − ${whole(status.billsProtected)} bills − ${whole(reserved)} protected = `}
                <Text style={[styles.formulaStrong, { color: hero.strong }]}>{`${m(status.flexibleNow)} flexible`}</Text>
                {` / ${daysLabel}`}
              </Text>
            </View>
          </View>

          <View style={styles.breakdown}>
            <View style={[styles.spaceBetween, styles.breakdownHeader]}>
              <AppText variant="small" style={styles.strong}>
                Breakdown of your money
              </AppText>
              <AppText variant="caption" tone="secondary">
                {daysLabel} pool
              </AppText>
            </View>
            <SegmentBar
              track={palette.surfaceHighest}
              segments={[
                { value: status.billsProtected, color: palette.textMuted },
                { value: reserved, color: palette.accent },
                { value: flexible, color: palette.brand },
              ]}
            />
            <BreakdownRow
              icon="wallet"
              tile={palette.surfaceLow}
              iconColor={palette.brand}
              title="Money in hand"
              subtitle="Starting balance counted"
              value={m(balance ?? 0)}
              onPress={() => setStep('now')}
            />
            <BreakdownRow
              icon="receipt"
              tile={palette.surfaceHigh}
              title="Committed bills"
              subtitle={
                protectedBills.length > 0
                  ? protectedBills.map((occurrence) => `${occurrence.bill.name} ${m(occurrence.bill.amount)}`).join(', ')
                  : 'Nothing due before payday'
              }
              value={status.billsProtected > 0 ? `−${m(status.billsProtected)}` : m(0)}
              valueColor={palette.textMuted}
              onPress={() => setStep('bills')}
            />
            <BreakdownRow
              icon="shield"
              tile={`${palette.accentSoft}80`}
              iconColor={palette.accentText}
              title="Protected reserves"
              subtitle={`Savings ${m(savings)}, safety buffer ${m(minimum)}`}
              value={reserved > 0 ? `−${m(reserved)}` : m(0)}
              valueColor={palette.accentText}
              onPress={() => setStep('protect')}
            />
            <BreakdownRow
              highlight
              icon="savings"
              tile={palette.brandSoft}
              iconColor={palette.onBrandSoft}
              title="Flexible money left"
              subtitle="Your guilt-free spending pool"
              value={m(status.flexibleNow)}
              valueColor={status.flexibleNow < 0 ? palette.danger : palette.brand}
            />
          </View>

          <Card style={CardShadow}>
            <FieldHeader
              dot={palette.brand}
              title="A normal day costs me about"
              subtitle="Coffee, food, transport… It decides green, yellow or red. Routines can replace it later."
            />
            <AmountField
              value={dailyNeedText ?? amountToInput(defaultDailyNeed(currency), currency)}
              onChangeText={setDailyNeedText}
              currency={currency}
              size="medium"
            />
          </Card>

          <Card style={[styles.coach, CardShadow]}>
            <IconCircle icon="eco" size={32} color={palette.brandText} background={palette.brand} />
            <View style={styles.coachText}>
              <AppText variant="small" style={styles.strong}>
                Coach perspective
              </AppText>
              <AppText variant="small" tone="secondary">
                <AppText variant="small" style={styles.strong}>
                  {advice.title}.{' '}
                </AppText>
                {advice.suggestion ?? advice.detail}
              </AppText>
            </View>
          </Card>

          <View style={[styles.companion, CardShadow]}>
            <Image
              source={require('../../assets/images/onboarding-plan.jpg')}
              style={styles.companionImage}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <View style={styles.companionShade} />
            <AppText variant="caption" color="#FFFFFF" style={styles.companionCaption}>
              A judgment-free rhythm designed for real life
            </AppText>
          </View>

          <Callout icon="routine" title="Optional: your normal workday">
            <AppText variant="small" tone="secondary">
              Add regular coffees, lunches or transport from the Routine tab to forecast more accurately. Today will
              remind you.
            </AppText>
          </Callout>
        </>
      );
      break;
    }
  }

  const showPreview = (step === 'bills' || step === 'protect') && balance !== null;

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: palette.background }]}>
        <View style={[styles.inner, styles.headerRow]}>
          <View style={styles.headerBrand}>
            {stepIndex > 0 ? (
              <Pressable
                onPress={goBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={styles.headerBack}>
                <Icon name="chevronLeft" size={24} color={palette.text} />
              </Pressable>
            ) : null}
            <BrandMark size={step === 'welcome' ? 36 : 32} />
            <AppText variant={step === 'welcome' ? 'heading' : 'bodyStrong'} style={styles.brandName}>
              Flousey
            </AppText>
          </View>
          {step === 'welcome' ? (
            <Badge label="No sign-up needed" background={palette.surfaceHigh} />
          ) : (
            <View style={styles.headerBrand}>
              <AppText variant="caption" tone="secondary">
                {STEP_CONTEXT[step]}
              </AppText>
              <View style={[styles.headerCheck, { backgroundColor: palette.brandDeep }]}>
                <Icon name="check" size={14} color="#FFFFFF" />
              </View>
            </View>
          )}
        </View>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={Space.xl}>
        <View style={styles.inner}>
          {stepIndex > 0 ? (
            <View style={styles.progress}>
              <View style={styles.spaceBetween}>
                <AppText variant="label" tone={step === 'plan' ? 'brand' : 'secondary'}>
                  Step {stepIndex} of {stepCount}
                </AppText>
                <AppText variant="caption" tone="brand" style={styles.bold}>
                  {Math.round((stepIndex / stepCount) * 100)}% complete
                </AppText>
              </View>
              <ProgressBar progress={stepIndex / stepCount} color={palette.brandDeep} />
            </View>
          ) : null}
          {content}
        </View>
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Space.md, borderTopColor: palette.border, backgroundColor: palette.background },
        ]}>
        <View style={[styles.inner, styles.footerInner]}>
          {showPreview ? (
            <View style={[styles.preview, { backgroundColor: palette.surfaceMuted }]}>
              <AppText variant="small" tone="secondary">
                Safe pace so far
              </AppText>
              <AppText variant="bodyStrong">{m(status.dailyAllowance)}/day</AppText>
            </View>
          ) : null}
          {step === 'welcome' ? (
            <>
              <Button label={NEXT_LABEL.welcome} iconRight="arrowForward" onPress={goNext} />
              <View style={styles.footnote}>
                <Icon name="schedule" size={14} color={palette.textSecondary} />
                <AppText variant="caption" tone="secondary">
                  Takes about a minute
                </AppText>
                <AppText variant="caption" tone="secondary">
                  •
                </AppText>
                <Icon name="lock" size={14} color={palette.textSecondary} />
                <AppText variant="caption" tone="secondary">
                  No bank login needed
                </AppText>
              </View>
            </>
          ) : (
            <>
              <View style={styles.footerButtons}>
                <Button label="Back" icon="chevronLeft" variant="secondary" onPress={goBack} />
                <Button
                  label={NEXT_LABEL[step]}
                  iconRight="arrowForward"
                  onPress={goNext}
                  disabled={!canContinue}
                  style={styles.flex}
                />
              </View>
              {step === 'plan' ? (
                <AppText variant="caption" tone="secondary" style={styles.center}>
                  You can adjust bills, savings or payday anytime in Rules.
                </AppText>
              ) : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function BrandMark({ size }: { size: number }) {
  return (
    <Image
      source={require('../../assets/images/logo-mark.png')}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.25) }}
      accessibilityLabel="Flousey logo"
    />
  );
}

function StepIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.intro}>
      <AppText style={styles.stepTitle}>{title}</AppText>
      <AppText tone="secondary" style={styles.stepSubtitle}>
        {subtitle}
      </AppText>
    </View>
  );
}

function FeatureCard({
  icon,
  tile,
  color,
  title,
  body,
}: {
  icon: IconName;
  tile: string;
  color: string;
  title: string;
  body: string;
}) {
  return (
    <Card style={[styles.feature, CardShadow]}>
      <View style={[styles.featureTile, { backgroundColor: tile }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <View style={styles.featureText}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="small" tone="secondary">
          {body}
        </AppText>
      </View>
    </Card>
  );
}

function FieldHeader({
  dot,
  title,
  subtitle,
  tag,
  tagColor,
  tagBackground,
}: {
  dot: string;
  title: string;
  subtitle: string;
  tag?: string;
  tagColor?: string;
  tagBackground?: string;
}) {
  return (
    <View style={styles.fieldHeader}>
      <View style={styles.spaceBetween}>
        <View style={styles.fieldTitle}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <AppText variant="bodyStrong" style={styles.flex}>
            {title}
          </AppText>
        </View>
        {tag ? <Badge label={tag} color={tagColor} background={tagBackground ?? 'transparent'} /> : null}
      </View>
      <AppText variant="small" tone="secondary">
        {subtitle}
      </AppText>
    </View>
  );
}

function QuickButton({
  icon,
  label,
  muted,
  onPress,
}: {
  icon: IconName;
  label: string;
  muted?: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const color = muted ? palette.textSecondary : palette.brand;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.quickButton,
        { backgroundColor: muted ? palette.surfaceHigh : palette.surfaceLow },
        !muted && styles.flex,
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={14} color={color} />
      <AppText variant="caption" color={color} style={styles.bold}>
        {label}
      </AppText>
    </Pressable>
  );
}

function BreakdownRow({
  icon,
  tile,
  iconColor,
  title,
  subtitle,
  value,
  valueColor,
  highlight,
  onPress,
}: {
  icon: IconName;
  tile: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  value: string;
  valueColor?: string;
  highlight?: boolean;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const body = (
    <View
      style={[styles.breakdownRow, { backgroundColor: highlight ? palette.surfaceLow : palette.surface }, CardShadow]}>
      <IconCircle icon={icon} size={36} color={iconColor} background={tile} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={highlight ? palette.brand : undefined}>
          {title}
        </AppText>
        <AppText variant="caption" tone="secondary" numberOfLines={2}>
          {subtitle}
        </AppText>
      </View>
      <AppText
        variant={highlight ? 'heading' : 'number'}
        color={valueColor}
        style={highlight ? styles.bold : undefined}>
        {value}
      </AppText>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Edit this step"
      style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  strong: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  pressed: { opacity: 0.85 },
  alignEnd: { alignItems: 'flex-end' },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  baseline: { flexDirection: 'row', alignItems: 'baseline', gap: Space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },

  header: {
    paddingHorizontal: Space.lg,
    zIndex: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  headerRow: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  headerBack: { width: 36, height: 44, alignItems: 'flex-start', justifyContent: 'center', marginLeft: -4 },
  headerCheck: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  brandName: { letterSpacing: -0.45 },

  content: { paddingHorizontal: 20, paddingTop: Space.lg, paddingBottom: Space.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Space.lg },
  progress: { gap: Space.sm },
  intro: { gap: Space.xs },
  welcomeTitle: { fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8 },
  lead: { fontSize: 16, lineHeight: 24 },
  stepTitle: { fontSize: 26, lineHeight: 34, fontWeight: '700', letterSpacing: -0.65 },
  stepSubtitle: { fontSize: 14, lineHeight: 22 },

  quote: { flexDirection: 'row', gap: Space.md, borderRadius: Radius.md, padding: Space.lg },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featureTile: { width: 40, height: 40, borderRadius: Radius.xs, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, gap: 2 },
  glanceBox: { borderRadius: Radius.md, padding: Space.lg, gap: Space.sm },

  fieldHeader: { gap: 2 },
  fieldTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputPanel: { borderRadius: Radius.md, padding: Space.md, gap: Space.sm },
  quickRow: { flexDirection: 'row', gap: Space.sm },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.xs,
  },
  dateCard: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderRadius: Radius.md, padding: Space.md },
  dateTile: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  glance: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderRadius: Radius.md, padding: Space.md },

  billHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  question: { borderRadius: Radius.sm, padding: Space.md, gap: Space.sm },
  questionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm },

  planHero: {
    borderRadius: Radius.md,
    padding: Space.xl,
    gap: Space.lg,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  planHeroGlow: { position: 'absolute', right: -32, top: -32, width: 176, height: 176, borderRadius: 88, opacity: 0.35 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  formula: {
    flexDirection: 'row',
    gap: Space.sm,
    borderRadius: Radius.xs,
    padding: Space.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  formulaText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  formulaStrong: { fontFamily: Fonts.bold },

  breakdown: { gap: Space.sm },
  breakdownHeader: { paddingHorizontal: Space.xs },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderRadius: Radius.xs, padding: Space.lg },

  coach: { flexDirection: 'row', alignItems: 'flex-start' },
  coachText: { flex: 1, gap: 3 },
  companion: { height: 128, borderRadius: Radius.md, overflow: 'hidden', justifyContent: 'flex-end' },
  companionImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  companionShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    backgroundColor: 'rgba(23,28,35,0.45)',
  },
  companionCaption: { padding: Space.md },

  footer: { paddingHorizontal: 20, paddingTop: Space.md, borderTopWidth: StyleSheet.hairlineWidth },
  footerInner: { gap: Space.sm },
  footerButtons: { flexDirection: 'row', gap: Space.md },
  footnote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  preview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
  },
});
