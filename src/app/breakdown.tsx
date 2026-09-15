import { STATUS_LABELS } from '@/domain/advice';
import { formatShortDate } from '@/domain/dates';
import { formatMoney, type Minor } from '@/domain/money';
import { useFinancial } from '@/store/use-financial';
import { AppText, Card, Divider, MoneyLine, SectionTitle, SheetScreen, StatusPill } from '@/ui/components';

export default function BreakdownScreen() {
  const financial = useFinancial();
  if (!financial) return null;
  const { currency, status, input } = financial;
  const m = (value: Minor) => formatMoney(value, currency);
  const mWhole = (value: Minor) => formatMoney(value, currency, { whole: true });

  return (
    <SheetScreen title="How we got your number" closeLabel="Close">
      <AppText tone="secondary">
        Money in your account isn't all safe to spend. Here's what we protect first, and how the rest is spread until
        your next income.
      </AppText>

      <Card>
        <MoneyLine label="In your account" value={m(status.balance)} />
        {input.billsDue.map((bill) => (
          <MoneyLine
            key={`${bill.name}-${bill.dueDate}`}
            label={`${bill.name} (due ${formatShortDate(bill.dueDate)})`}
            value={m(-bill.amount)}
          />
        ))}
        {status.savingsReserve > 0 ? <MoneyLine label="Savings still to set aside" value={m(-status.savingsReserve)} /> : null}
        {status.minimumBalance > 0 ? <MoneyLine label="Minimum balance" value={m(-status.minimumBalance)} /> : null}
        <Divider />
        <MoneyLine label="Flexible money" value={m(status.flexibleNow)} strong />
        {status.spentToday > 0 ? (
          <>
            <MoneyLine label="Plus what you spent today" value={m(status.spentToday)} />
            <MoneyLine label="Flexible at the start of today" value={m(status.flexibleStartOfDay)} strong />
          </>
        ) : null}
        <MoneyLine
          label={`Spread over ${status.daysRemaining} ${status.daysRemaining === 1 ? 'day' : 'days'} until ${formatShortDate(input.nextIncomeDate)}`}
          value={`÷ ${status.daysRemaining}`}
        />
        <Divider />
        <MoneyLine label="Safe to spend today" value={mWhole(status.dailyAllowance)} strong />
      </Card>

      <SectionTitle title="Why this color" />
      <Card>
        <StatusPill level={status.riskLevel} label={STATUS_LABELS[status.reason]} />
        <MoneyLine label="Your safe pace" value={`${mWhole(status.dailyAllowance)}/day`} />
        <MoneyLine
          label={
            status.normalDaySource === 'routines'
              ? 'Normal day (from your routines)'
              : status.normalDaySource === 'default'
                ? 'Normal day (default, change it in Protections)'
                : 'Normal day'
          }
          value={`${mWhole(status.normalDay)}/day`}
        />
        <Divider />
        <AppText variant="small" tone="secondary">
          🟢 Breathing room: your safe pace is at least 1.5× a normal day.
        </AppText>
        <AppText variant="small" tone="secondary">
          🟢 On track: your safe pace covers a normal day.
        </AppText>
        <AppText variant="small" tone="secondary">
          🟡 Tight: your safe pace is under a normal day, today's amount is almost used or passed, or you're spending a bit
          faster than your pace.
        </AppText>
        <AppText variant="small" tone="secondary">
          🔴 Very tight: your safe pace is under half a normal day, nothing flexible is left, or you're spending much
          faster than your pace.
        </AppText>
      </Card>

      {status.currentPace !== null ? (
        <>
          <SectionTitle title="Your pace" />
          <Card>
            <MoneyLine label={`Recent average (last ${status.paceDays} days)`} value={`${mWhole(status.currentPace)}/day`} />
            <MoneyLine label="Sustainable pace" value={`${mWhole(status.dailyAllowance)}/day`} />
            {status.projectedEndFlexible !== null ? (
              <MoneyLine
                label="If you continue like this"
                value={
                  status.projectedEndFlexible >= 0
                    ? `${mWhole(status.projectedEndFlexible)} to spare`
                    : `${mWhole(-status.projectedEndFlexible)} short`
                }
                strong
              />
            ) : null}
          </Card>
        </>
      ) : null}

      {status.hasRoutines ? (
        <>
          <SectionTitle title="Your routine" />
          <Card>
            <MoneyLine label="Normal spending until your next income" value={mWhole(status.expectedUntilIncome)} />
            <MoneyLine label="Flexible money" value={mWhole(status.flexibleStartOfDay)} />
            <Divider />
            <MoneyLine
              label="Room beyond your routine"
              value={mWhole(status.flexibleStartOfDay - status.expectedUntilIncome)}
              strong
            />
          </Card>
        </>
      ) : null}

      <SectionTitle title="Good to know" />
      <Card>
        <AppText tone="secondary">• Today counts; the day your income arrives doesn't.</AppText>
        <AppText tone="secondary">
          • Today's amount is set at the start of the day. Spending lowers what's left today and adjusts the coming days.
        </AppText>
        <AppText tone="secondary">
          • Money you don't spend isn't lost. It spreads over the remaining days, so your pace rises a little.
        </AppText>
        <AppText tone="secondary">• Paying a bill or moving savings doesn't change your pace. That money was already set aside.</AppText>
        <AppText tone="secondary">• Routines are only expectations. Nothing is ever subtracted automatically.</AppText>
        <AppText tone="secondary">• Income is only counted once it arrives.</AppText>
      </Card>
    </SheetScreen>
  );
}
