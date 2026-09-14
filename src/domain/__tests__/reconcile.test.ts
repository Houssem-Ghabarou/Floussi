import { buildAdvice } from '../advice';
import { buildFinancialInput, countsToBalance } from '../derive';
import { calculateFinancialStatus } from '../engine';
import { getCurrency } from '../money';
import type { AppData, Settings, Transaction } from '../types';

const tnd = (value: number) => Math.round(value * 1000);

/**
 * Opening balance 900 on Sep 14, salary on Sep 30, then "Update balance" on Sep 16.
 * Transactions are recorded in the order listed below.
 */
function afterBalanceUpdate({
  adjustTo,
  minimumBalance = 0,
  savings = 0,
  incomeBefore = 0,
  spentToday = 0,
  incomeAfter = 0,
  correctionAfter = 0,
  today = '2026-09-16',
}: {
  adjustTo: number;
  minimumBalance?: number;
  savings?: number;
  incomeBefore?: number;
  spentToday?: number;
  incomeAfter?: number;
  correctionAfter?: number;
  today?: string;
}) {
  const settings: Settings = {
    currency: 'TND',
    openingBalance: tnd(900),
    openingDate: '2026-09-14',
    minimumBalance: tnd(minimumBalance),
    unexpectedIncomeSavePercent: 0,
    onboarded: true,
  };
  const transactions: Transaction[] = [];
  const add = (partial: Pick<Transaction, 'kind' | 'amount' | 'date'> & Partial<Transaction>) =>
    transactions.push({
      id: String(transactions.length),
      category: null,
      note: null,
      billId: null,
      billDueDate: null,
      countsToBalance: countsToBalance(partial.date, settings),
      createdAt: transactions.length,
      ...partial,
    });

  if (incomeBefore) add({ kind: 'income', amount: tnd(incomeBefore), date: '2026-09-15', category: 'freelance' });
  if (spentToday) add({ kind: 'expense', amount: tnd(-spentToday), date: '2026-09-16', category: 'food' });
  add({ kind: 'adjustment', amount: tnd(adjustTo - (900 + incomeBefore - spentToday)), date: '2026-09-16' });
  if (incomeAfter) add({ kind: 'income', amount: tnd(incomeAfter), date: '2026-09-16', category: 'freelance' });
  if (correctionAfter) add({ kind: 'adjustment', amount: tnd(correctionAfter), date: '2026-09-16' });

  const data: AppData = {
    settings,
    cycle: {
      id: 'c1',
      startDate: '2026-09-14',
      startedAt: null,
      nextIncomeDate: '2026-09-30',
      expectedIncome: null,
      incomeLabel: 'Salary',
      frequency: 'monthly',
      savingsTarget: tnd(savings),
      closedAt: null,
    },
    transactions,
    bills: [],
    routines: [],
  };
  return calculateFinancialStatus(buildFinancialInput(data, today));
}

describe('status after updating the balance', () => {
  it('a big drop is never "on track"', () => {
    const status = afterBalanceUpdate({ adjustTo: 200 });
    expect(status.recentUntrackedSpending).toBe(tnd(700));
    expect(status.paceWithoutUntracked).toBe(Math.floor(tnd(900) / 14));
    expect(status.riskLevel).toBe('at_risk');
    expect(status.reason).toBe('untracked_spending');
    expect(buildAdvice(status, getCurrency('TND')).title).toBe('Your balance was lower than tracked');

    expect(afterBalanceUpdate({ adjustTo: 50 }).reason).toBe('untracked_spending');
  });

  it('a moderate drop is a watch', () => {
    const status = afterBalanceUpdate({ adjustTo: 750 });
    expect(status.riskLevel).toBe('watch');
    expect(status.reason).toBe('untracked_spending');
  });

  it('a small correction or found money keeps you on track', () => {
    expect(afterBalanceUpdate({ adjustTo: 880 }).riskLevel).toBe('on_track');
    expect(afterBalanceUpdate({ adjustTo: 1000 }).riskLevel).toBe('on_track');
  });

  it('zero money is at risk, even after spending earlier today', () => {
    expect(afterBalanceUpdate({ adjustTo: 0 }).reason).toBe('no_flexible_money');
    expect(afterBalanceUpdate({ adjustTo: 0, spentToday: 50 }).reason).toBe('no_flexible_money');
    expect(afterBalanceUpdate({ adjustTo: 0, minimumBalance: 100, savings: 100 }).reason).toBe(
      'protected_exceeds_balance',
    );
  });

  it('the untracked-spending warning fades after a week', () => {
    expect(afterBalanceUpdate({ adjustTo: 750, today: '2026-09-22' }).reason).toBe('untracked_spending');
    expect(afterBalanceUpdate({ adjustTo: 750, today: '2026-09-23' }).reason).not.toBe('untracked_spending');
  });

  it('adding enough money after the drop brings you back on track', () => {
    const status = afterBalanceUpdate({ adjustTo: 50, incomeAfter: 2000 });
    expect(status.paceWithoutUntracked).toBe(Math.floor(tnd(900) / 14));
    expect(status.dailyAllowance).toBe(Math.floor(tnd(2050) / 14));
    expect(status.riskLevel).toBe('on_track');
  });

  it('a little money after the drop does not hide it', () => {
    expect(afterBalanceUpdate({ adjustTo: 50, incomeAfter: 10 }).reason).toBe('untracked_spending');
  });

  it('money added before the drop does not hide it either', () => {
    expect(afterBalanceUpdate({ adjustTo: 200, incomeBefore: 300 }).reason).toBe('untracked_spending');
  });

  it('a correction that undoes a mistyped one cancels the warning', () => {
    const status = afterBalanceUpdate({ adjustTo: 50, correctionAfter: 850 });
    expect(status.balance).toBe(tnd(900));
    expect(status.recentUntrackedSpending).toBe(0);
    expect(status.riskLevel).toBe('on_track');
  });
});
