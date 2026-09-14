import { suggestNextIncomeDate } from '../cycle';

describe('suggestNextIncomeDate', () => {
  it('moves monthly income to the same day next month', () => {
    expect(suggestNextIncomeDate('2026-09-30', 'monthly', '2026-09-30')).toBe('2026-10-30');
    expect(suggestNextIncomeDate('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28');
  });

  it('skips periods that are already in the past', () => {
    expect(suggestNextIncomeDate('2026-09-30', 'monthly', '2026-11-02')).toBe('2026-11-30');
    expect(suggestNextIncomeDate('2026-09-30', 'biweekly', '2026-10-20')).toBe('2026-10-28');
    expect(suggestNextIncomeDate('2026-09-30', 'weekly', '2026-09-30')).toBe('2026-10-07');
  });

  it('gives irregular income a 30-day horizon', () => {
    expect(suggestNextIncomeDate('2026-09-30', 'irregular', '2026-10-02')).toBe('2026-11-01');
  });
});
