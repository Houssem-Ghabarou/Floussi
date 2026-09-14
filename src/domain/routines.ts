import type { Minor } from './money';
import type { Routine } from './types';

export function routineTotal(routine: Routine): Minor {
  return routine.items.reduce((total, item) => total + item.amount, 0);
}

/** The enabled routine that covers a weekday (0 = Sunday), if any. */
export function routineForWeekday(routines: Routine[], weekdayIndex: number): Routine | null {
  return routines.find((routine) => routine.enabled && routine.weekdays.includes(weekdayIndex)) ?? null;
}

/** Expected spending per weekday, index 0 = Sunday. */
export function routineByWeekday(routines: Routine[]): Minor[] {
  return Array.from({ length: 7 }, (_, day) => {
    const routine = routineForWeekday(routines, day);
    return routine ? routineTotal(routine) : 0;
  });
}
