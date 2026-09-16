import { statusLabel } from '@/domain/advice';
import { formatShortDate } from '@/domain/dates';
import { formatMoney, type Minor } from '@/domain/money';
import { t, tn } from '@/i18n';
import { useFinancial } from '@/store/use-financial';
import { AppText, Card, Divider, MoneyLine, SectionTitle, SheetScreen, StatusPill } from '@/ui/components';

export default function BreakdownScreen() {
  const financial = useFinancial();
  if (!financial) return null;
  const { currency, status, input } = financial;
  const m = (value: Minor) => formatMoney(value, currency);
  const mWhole = (value: Minor) => formatMoney(value, currency, { whole: true });
  const perDay = (value: Minor) => t('common.perDay', { amount: mWhole(value) });

  return (
    <SheetScreen title={t('breakdown.title')} closeLabel={t('common.close')}>
      <AppText tone="secondary">{t('breakdown.intro')}</AppText>

      <Card>
        <MoneyLine label={t('breakdown.inYourAccount')} value={m(status.balance)} />
        {input.billsDue.map((bill) => (
          <MoneyLine
            key={`${bill.name}-${bill.dueDate}`}
            label={t('breakdown.billDue', { name: bill.name, date: formatShortDate(bill.dueDate) })}
            value={m(-bill.amount)}
          />
        ))}
        {status.savingsReserve > 0 ? (
          <MoneyLine label={t('breakdown.savingsToSet')} value={m(-status.savingsReserve)} />
        ) : null}
        {status.minimumBalance > 0 ? (
          <MoneyLine label={t('breakdown.minimumBalance')} value={m(-status.minimumBalance)} />
        ) : null}
        <Divider />
        <MoneyLine label={t('breakdown.flexibleMoney')} value={m(status.flexibleNow)} strong />
        {status.spentToday > 0 ? (
          <>
            <MoneyLine label={t('breakdown.plusSpentToday')} value={m(status.spentToday)} />
            <MoneyLine label={t('breakdown.flexibleStart')} value={m(status.flexibleStartOfDay)} strong />
          </>
        ) : null}
        <MoneyLine
          label={t('breakdown.spread', {
            days: tn('count.days', status.daysRemaining),
            date: formatShortDate(input.nextIncomeDate),
          })}
          value={`÷ ${status.daysRemaining}`}
        />
        <Divider />
        <MoneyLine label={t('breakdown.safeToday')} value={mWhole(status.dailyAllowance)} strong />
      </Card>

      <SectionTitle title={t('breakdown.whyColor')} />
      <Card>
        <StatusPill level={status.riskLevel} label={statusLabel(status.reason)} />
        <MoneyLine label={t('breakdown.yourSafePace')} value={perDay(status.dailyAllowance)} />
        <MoneyLine
          label={t(
            status.normalDaySource === 'routines'
              ? 'breakdown.normalDayRoutines'
              : status.normalDaySource === 'default'
                ? 'breakdown.normalDayDefault'
                : 'breakdown.normalDay',
          )}
          value={perDay(status.normalDay)}
        />
        <Divider />
        <AppText variant="small" tone="secondary">
          {t('breakdown.rule1')}
        </AppText>
        <AppText variant="small" tone="secondary">
          {t('breakdown.rule2')}
        </AppText>
        <AppText variant="small" tone="secondary">
          {t('breakdown.rule3')}
        </AppText>
        <AppText variant="small" tone="secondary">
          {t('breakdown.rule4')}
        </AppText>
      </Card>

      {status.currentPace !== null ? (
        <>
          <SectionTitle title={t('breakdown.yourPace')} />
          <Card>
            <MoneyLine
              label={t('breakdown.recentAverage', { days: status.paceDays })}
              value={perDay(status.currentPace)}
            />
            <MoneyLine label={t('breakdown.sustainable')} value={perDay(status.dailyAllowance)} />
            {status.projectedEndFlexible !== null ? (
              <MoneyLine
                label={t('breakdown.ifContinue')}
                value={
                  status.projectedEndFlexible >= 0
                    ? t('breakdown.toSpare', { amount: mWhole(status.projectedEndFlexible) })
                    : t('breakdown.short', { amount: mWhole(-status.projectedEndFlexible) })
                }
                strong
              />
            ) : null}
          </Card>
        </>
      ) : null}

      {status.hasRoutines ? (
        <>
          <SectionTitle title={t('breakdown.yourRoutine')} />
          <Card>
            <MoneyLine label={t('breakdown.normalUntilIncome')} value={mWhole(status.expectedUntilIncome)} />
            <MoneyLine label={t('breakdown.flexibleMoney')} value={mWhole(status.flexibleStartOfDay)} />
            <Divider />
            <MoneyLine
              label={t('breakdown.roomBeyond')}
              value={mWhole(status.flexibleStartOfDay - status.expectedUntilIncome)}
              strong
            />
          </Card>
        </>
      ) : null}

      <SectionTitle title={t('breakdown.goodToKnow')} />
      <Card>
        <AppText tone="secondary">{t('breakdown.note1')}</AppText>
        <AppText tone="secondary">{t('breakdown.note2')}</AppText>
        <AppText tone="secondary">{t('breakdown.note3')}</AppText>
        <AppText tone="secondary">{t('breakdown.note4')}</AppText>
        <AppText tone="secondary">{t('breakdown.note5')}</AppText>
        <AppText tone="secondary">{t('breakdown.note6')}</AppText>
      </Card>
    </SheetScreen>
  );
}
