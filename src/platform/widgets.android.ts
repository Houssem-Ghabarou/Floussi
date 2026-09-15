import { requestWidgetUpdate } from 'react-native-android-widget';

import type { LocalDate } from '@/domain/dates';
import type { AppData } from '@/domain/types';
import { widgetTimeline } from '@/domain/widget-snapshot';
import { ANDROID_WIDGET_NAME, renderSafeToSpend } from '@/widgets/android/safe-to-spend-widget';

/** Redraws every Flousey widget on the home screen. After midnight, the widget refreshes itself. */
export function syncWidgets(data: AppData | null, today: LocalDate) {
  const [entry] = widgetTimeline(data, today);
  requestWidgetUpdate({
    widgetName: ANDROID_WIDGET_NAME,
    renderWidget: (info) => renderSafeToSpend(entry.props, info),
  }).catch((error) => console.warn('Could not update the widget', error));
}
