import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { nextDueAfter } from '@/domain/bills';
import { frequencyLabel } from '@/domain/cycle';
import { formatDaysFromNow, formatShortDate } from '@/domain/dates';
import { cycleBillOccurrences, savingsMovedInCycle } from '@/domain/derive';
import { formatMoney, type Minor } from '@/domain/money';
import { formatMinutes, reminderPreferences } from '@/domain/reminders';
import type { Bill, ReminderPreferences } from '@/domain/types';
import { LANGUAGE_NAMES, LANGUAGES, t, type TranslationKey } from '@/i18n';
import { resolveLanguage } from '@/platform/language';
import { useNotificationAccess } from '@/platform/use-notification-access';
import { useApp } from '@/store/app-store';
import { useFinancial } from '@/store/use-financial';
import { TabScreen } from '@/ui/app-header';
import {
  AppText,
  Button,
  Card,
  Chip,
  ChipGroup,
  Divider,
  IconCircle,
  ListRow,
  MoneyLine,
  PageIntro,
  SectionTitle,
} from '@/ui/components';
import type { IconName } from '@/ui/icon';
import { confirmDestructive } from '@/ui/dialog-store';
import { Space, usePalette } from '@/ui/theme';
import { useBackupActions } from '@/ui/use-backup';

const CHECK_IN_TIMES = [19 * 60, 20 * 60, 21 * 60, 22 * 60];

const NORMAL_DAY_SOURCE: Record<string, TranslationKey> = {
  routines: 'rules.normalDay.routines',
  custom: 'rules.normalDay.custom',
  default: 'rules.normalDay.default',
};

export default function RulesScreen() {
  const financial = useFinancial();
  const router = useRouter();
  const palette = usePalette();
  const resetAll = useApp((state) => state.resetAll);
  const { share, restore } = useBackupActions();
  const updateSettings = useApp((state) => state.updateSettings);
  const storedLanguage = useApp((state) => state.language);
  const chooseLanguage = useApp((state) => state.chooseLanguage);
  const { access, request } = useNotificationAccess();

  if (!financial) return null;
  const { data, today, status, currency } = financial;
  const { cycle, settings, bills, transactions } = data;
  const m = (value: Minor) => formatMoney(value, currency);

  const occurrences = cycleBillOccurrences(data, today);
  const otherBills = bills.filter(
    (bill) => !bill.archived && !occurrences.some((occurrence) => occurrence.bill.id === bill.id),
  );
  const unpaidCount = occurrences.filter((occurrence) => !occurrence.paid).length;
  const moved = savingsMovedInCycle(cycle, transactions);
  const laterBillSubtitle = (bill: Bill) => {
    const next = nextDueAfter(bill, cycle.nextIncomeDate);
    return next ? t('rules.billLater', { date: formatShortDate(next) }) : t('rules.billNoDate');
  };

  const language = resolveLanguage(storedLanguage);
  // Only the words change, so the new language shows up straight away.
  const changeLanguage = (next: (typeof LANGUAGES)[number]) => chooseLanguage(next);

  const reminders = reminderPreferences(settings);
  const setReminder = (patch: Partial<ReminderPreferences>) =>
    updateSettings({ reminders: { ...reminders, ...patch }, remindersAsked: true });

  const confirmReset = () =>
    confirmDestructive({
      icon: 'warning',
      title: t('rules.eraseTitle'),
      message: t('rules.eraseMessage'),
      confirmLabel: t('rules.eraseConfirm'),
      cancelLabel: t('common.cancel'),
      onConfirm: resetAll,
    });

  return (
    <TabScreen section={t('nav.rules')}>
      <PageIntro title={t('rules.title')} subtitle={t('rules.subtitle')} />

      <SectionTitle title={t('rules.nextIncome')} />
      <Card>
        <ListRow
          icon="event"
          title={t('rules.incomeTitle', {
            income: cycle.incomeLabel,
            date: formatShortDate(cycle.nextIncomeDate),
          })}
          subtitle={[
            frequencyLabel(cycle.frequency),
            cycle.expectedIncome ? t('rules.about', { amount: m(cycle.expectedIncome) }) : null,
            formatDaysFromNow(cycle.nextIncomeDate, today),
          ]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => router.push('/payday')}
        />
        <Button
          label={t('rules.incomeArrived')}
          icon="payments"
          variant="secondary"
          compact
          onPress={() => router.push({ pathname: '/income', params: { cycleIncome: '1' } })}
        />
      </Card>

      <SectionTitle title={t('rules.balance')} />
      <Card>
        <ListRow
          icon="wallet"
          title={t('rules.inYourAccount')}
          subtitle={t('rules.balanceHint')}
          value={m(status.balance)}
          onPress={() => router.push('/balance')}
        />
      </Card>

      <SectionTitle
        title={t('rules.billsThisCycle')}
        count={unpaidCount}
        action={{ label: t('common.add'), onPress: () => router.push('/bill') }}
      />
      <Card style={styles.listCard}>
        {occurrences.length === 0 && otherBills.length === 0 ? (
          <AppText variant="small" tone="secondary">
            {t('rules.noBills')}
          </AppText>
        ) : null}
        {occurrences.map((occurrence, index) => (
          <Fragment key={`${occurrence.bill.id}-${occurrence.dueDate}`}>
            {index > 0 ? <Divider /> : null}
            <ListRow
              emoji={occurrence.paid ? undefined : occurrence.bill.emoji}
              icon={occurrence.paid ? 'checkCircle' : undefined}
              tileColor={
                occurrence.paid
                  ? palette.comfortableSoft
                  : occurrence.dueDate < today
                    ? palette.atRiskSoft
                    : undefined
              }
              title={occurrence.bill.name}
              subtitle={
                occurrence.paid
                  ? t('rules.billPaid', {
                      amount: m(occurrence.paidAmount),
                      date: formatShortDate(occurrence.dueDate),
                    })
                  : occurrence.dueDate < today
                    ? t('rules.billOverdue', { date: formatShortDate(occurrence.dueDate) })
                    : occurrence.bill.recurring || occurrence.bill.dueDate
                      ? t('rules.billDue', { date: formatShortDate(occurrence.dueDate) })
                      : t('rules.billBeforeIncome')
              }
              value={occurrence.paid ? undefined : m(occurrence.bill.amount)}
              onPress={() => router.push({ pathname: '/bill', params: { id: occurrence.bill.id } })}
              right={
                occurrence.paid ? undefined : (
                  <Button
                    label={t('rules.pay')}
                    compact
                    onPress={() =>
                      router.push({
                        pathname: '/pay-bill',
                        params: { billId: occurrence.bill.id, dueDate: occurrence.dueDate },
                      })
                    }
                  />
                )
              }
            />
          </Fragment>
        ))}
        {otherBills.map((bill, index) => (
          <Fragment key={bill.id}>
            {occurrences.length + index > 0 ? <Divider /> : null}
            <ListRow
              emoji={bill.emoji}
              title={bill.name}
              subtitle={laterBillSubtitle(bill)}
              value={m(bill.amount)}
              onPress={() => router.push({ pathname: '/bill', params: { id: bill.id } })}
            />
          </Fragment>
        ))}
        {occurrences.length > 0 ? (
          <AppText variant="caption" tone="muted">
            {t('rules.billsHint')}
          </AppText>
        ) : null}
      </Card>

      <SectionTitle
        title={t('rules.protections')}
        action={{ label: t('common.edit'), onPress: () => router.push('/protections') }}
      />
      <Card style={styles.listCard} onPress={() => router.push('/protections')}>
        <ListRow
          icon="savings"
          title={t('rules.savingsThisCycle')}
          subtitle={moved > 0 ? t('rules.savingsMoved', { amount: m(moved) }) : t('rules.savingsKept')}
          value={m(cycle.savingsTarget)}
        />
        <Divider />
        <ListRow
          icon="shield"
          title={t('rules.minimumBalance')}
          subtitle={t('rules.minimumHint')}
          value={m(settings.minimumBalance)}
        />
        <Divider />
        <ListRow
          icon="routine"
          title={t('rules.normalDay')}
          subtitle={t(NORMAL_DAY_SOURCE[status.normalDaySource])}
          value={formatMoney(status.normalDay, currency, { whole: true })}
        />
        <Divider />
        <ListRow
          icon="bolt"
          title={t('rules.unexpectedIncome')}
          subtitle={t('rules.unexpectedHint')}
          value={
            settings.unexpectedIncomeSavePercent === 0
              ? t('rules.useIt')
              : t('rules.savePercent', { percent: settings.unexpectedIncomeSavePercent })
          }
        />
        <Divider />
        <ListRow icon="restart" title={t('rules.unspentMoney')} subtitle={t('rules.unspentHint')} />
      </Card>

      <SectionTitle title={t('language.section')} />
      <Card>
        <ChipGroup>
          {LANGUAGES.map((option) => (
            <Chip
              key={option}
              label={LANGUAGE_NAMES[option]}
              selected={language === option}
              onPress={() => changeLanguage(option)}
            />
          ))}
        </ChipGroup>
        <AppText variant="caption" tone="muted">
          {t('language.followsPhone')}
        </AppText>
      </Card>

      <SectionTitle title={t('rules.reminders')} subtitle={t('rules.remindersSubtitle')} />
      <Card style={styles.listCard}>
        {access && !access.granted ? (
          <View style={[styles.notice, { backgroundColor: palette.watchSoft }]}>
            <AppText variant="small" style={styles.flex}>
              {t(access.canAskAgain ? 'rules.notificationsOff' : 'rules.notificationsBlocked')}
            </AppText>
            <Button
              label={t(access.canAskAgain ? 'common.turnOn' : 'common.openSettings')}
              compact
              onPress={() => {
                void request();
              }}
            />
          </View>
        ) : null}
        <ToggleRow
          icon="receipt"
          title={t('rules.reminderBill')}
          subtitle={t('rules.reminderBillHint')}
          value={reminders.bills}
          onChange={(bills) => setReminder({ bills })}
        />
        <Divider />
        <ToggleRow
          icon="event"
          title={t('rules.reminderPayday')}
          subtitle={t('rules.reminderPaydayHint')}
          value={reminders.payday}
          onChange={(payday) => setReminder({ payday })}
        />
        <Divider />
        <ToggleRow
          icon="bedtime"
          title={t('rules.reminderCheckIn')}
          subtitle={
            reminders.checkIn
              ? t('rules.reminderCheckInOn', { time: formatMinutes(reminders.checkInMinutes) })
              : t('rules.reminderCheckInOff')
          }
          value={reminders.checkIn}
          onChange={(checkIn) => setReminder({ checkIn })}
        />
        {reminders.checkIn ? (
          <ChipGroup>
            {CHECK_IN_TIMES.map((minutes) => (
              <Chip
                key={minutes}
                label={formatMinutes(minutes)}
                selected={reminders.checkInMinutes === minutes}
                onPress={() => setReminder({ checkInMinutes: minutes })}
              />
            ))}
          </ChipGroup>
        ) : null}
        <Divider />
        <ToggleRow
          icon="schedule"
          title={t('rules.reminderInactivity')}
          subtitle={t(reminders.checkIn ? 'rules.reminderInactivityOff' : 'rules.reminderInactivityOn')}
          value={reminders.inactivity}
          onChange={(inactivity) => setReminder({ inactivity })}
        />
      </Card>

      <SectionTitle title={t('rules.widget')} />
      <Card style={styles.listCard}>
        <ToggleRow
          icon="lock"
          title={t('rules.hideAmounts')}
          subtitle={t('rules.hideAmountsHint')}
          value={settings.widgetHideAmounts === true}
          onChange={(widgetHideAmounts) => updateSettings({ widgetHideAmounts })}
        />
        <AppText variant="caption" tone="muted">
          {t('rules.widgetHint')}
        </AppText>
      </Card>

      <SectionTitle title={t('rules.backup')} />
      <Card>
        <View style={styles.inline}>
          <IconCircle icon="backup" size={40} color={palette.brand} />
          <AppText variant="small" tone="secondary" style={styles.flex}>
            {t('rules.backupHint')}
          </AppText>
        </View>
        <View style={styles.buttonRow}>
          <Button
            label={t('rules.export')}
            icon="upload"
            variant="secondary"
            compact
            style={styles.flex}
            onPress={share}
          />
          <Button
            label={t('rules.restore')}
            icon="download"
            variant="secondary"
            compact
            style={styles.flex}
            onPress={restore}
          />
        </View>
      </Card>

      <SectionTitle title={t('rules.app')} />
      <Card>
        <MoneyLine label={t('rules.currency')} value={currency.code} />
        <AppText variant="caption" tone="muted">
          {t('rules.privacy')}
        </AppText>
        <Button label={t('rules.eraseAll')} variant="danger" compact onPress={confirmReset} />
      </Card>
    </TabScreen>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggleRow}>
      <IconCircle icon={icon} size={40} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="small" tone="secondary">
          {subtitle}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: palette.surfaceHighest, true: palette.brand }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={palette.surfaceHighest}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderRadius: 10, padding: Space.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  buttonRow: { flexDirection: 'row', gap: Space.sm },
  listCard: { gap: Space.sm, paddingVertical: Space.md },
});
