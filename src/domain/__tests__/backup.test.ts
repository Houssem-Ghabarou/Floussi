import { BACKUP_FORMAT, createBackup, describeBackup, parseBackup, type BackupData } from '../backup';

const data: BackupData = {
  settings: {
    currency: 'TND',
    openingBalance: 900_000,
    openingDate: '2026-09-14',
    minimumBalance: 100_000,
    dailyNeed: 15_000,
    unexpectedIncomeSavePercent: 50,
    onboarded: true,
  },
  cycles: [
    {
      id: 'c1',
      startDate: '2026-09-14',
      startedAt: null,
      nextIncomeDate: '2026-09-30',
      expectedIncome: 2_500_000,
      incomeLabel: 'Salary',
      frequency: 'monthly',
      savingsTarget: 100_000,
      closedAt: null,
    },
  ],
  transactions: [
    {
      id: 't1',
      kind: 'expense',
      amount: -12_500,
      category: 'food',
      note: 'Lunch',
      date: '2026-09-14',
      billId: null,
      billDueDate: null,
      countsToBalance: true,
      createdAt: 1,
    },
    {
      id: 't2',
      kind: 'bill_payment',
      amount: -50_000,
      category: null,
      note: null,
      date: '2026-09-15',
      billId: 'b1',
      billDueDate: '2026-09-25',
      countsToBalance: true,
      createdAt: 2,
    },
  ],
  bills: [
    {
      id: 'b1',
      name: 'Internet',
      emoji: '🌐',
      amount: 50_000,
      recurring: true,
      dueDay: 25,
      dueDate: null,
      archived: false,
      createdOn: '2026-09-14',
    },
  ],
  routines: [
    {
      id: 'r1',
      name: 'Workday',
      emoji: '☀️',
      weekdays: [1, 2, 3, 4, 5],
      items: [{ id: 'i1', name: 'Coffee', amount: 4_000, category: 'coffee' }],
      enabled: true,
    },
  ],
};

const backup = createBackup(data, new Date('2026-09-15T10:00:00Z'));
const withData = (patch: Record<string, unknown>) => JSON.stringify({ ...backup, data: { ...backup.data, ...patch } });

describe('backups', () => {
  it('round-trips everything the user entered', () => {
    expect(parseBackup(JSON.stringify(backup))).toEqual({ ok: true, backup });
  });

  it('still restores backups made before the app was renamed', () => {
    expect(parseBackup(JSON.stringify({ ...backup, app: 'floussi' }))).toEqual({ ok: true, backup });
  });

  it('describes a backup before restoring it', () => {
    expect(describeBackup(backup)).toBe('Backup from Sep 15 · 2 transactions · 1 bill · 1 routine');
  });

  it('refuses files that are not Flousey backups', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false, error: "This file isn't a Flousey backup." });
    expect(parseBackup(JSON.stringify({ app: 'other', data: {} }))).toMatchObject({ ok: false });
  });

  it('refuses backups from a newer app version', () => {
    const result = parseBackup(JSON.stringify({ ...backup, format: BACKUP_FORMAT + 1 }));
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toContain('newer version');
  });

  it('refuses damaged data instead of half-restoring it', () => {
    const badTransaction = { ...data.transactions[0], amount: '12.5' };
    expect(parseBackup(withData({ transactions: [badTransaction] }))).toEqual({
      ok: false,
      error: 'The backup looks damaged (transactions).',
    });
    expect(parseBackup(withData({ settings: null }))).toMatchObject({ ok: false });
    expect(parseBackup(withData({ cycles: [{ ...data.cycles[0], closedAt: 5 }] }))).toEqual({
      ok: false,
      error: 'The backup looks damaged (no current cycle).',
    });
  });

  it('fills settings added in later versions with their defaults', () => {
    const { dailyNeed: _dailyNeed, unexpectedIncomeSavePercent: _percent, ...olderSettings } = data.settings;
    const result = parseBackup(withData({ settings: olderSettings }));
    expect(result.ok && result.backup.data.settings).toMatchObject({ dailyNeed: null, unexpectedIncomeSavePercent: 0 });
  });
});
