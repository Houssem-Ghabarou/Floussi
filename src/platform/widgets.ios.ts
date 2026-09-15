import { splitDate, type LocalDate } from '@/domain/dates';
import type { AppData } from '@/domain/types';
import { widgetTimeline } from '@/domain/widget-snapshot';
import SafeToSpendWidget from '@/widgets/SafeToSpendWidget';

/**
 * Sends today's content and tomorrow's from midnight: iOS can't run the app's code to refresh the
 * widget, so the timeline carries it into the next day.
 */
export function syncWidgets(data: AppData | null, today: LocalDate) {
  try {
    SafeToSpendWidget.updateTimeline(
      widgetTimeline(data, today).map((entry) => {
        const [year, month, day] = splitDate(entry.date);
        return { date: entry.date === today ? new Date() : new Date(year, month - 1, day), props: entry.props };
      }),
    );
  } catch (error) {
    console.warn('Could not update the widget', error);
  }
}
