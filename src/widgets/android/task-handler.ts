/**
 * Runs in the background when Android adds, resizes or periodically refreshes the widget. It reads the
 * database itself, so the widget moves to the new day after midnight even if the app is never opened.
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { repository } from '@/data/repository';
import { toLocalDate } from '@/domain/dates';
import { EMPTY_WIDGET, widgetTimeline, type WidgetProps } from '@/domain/widget-snapshot';
import { appDataOf } from '@/store/app-store';

import { renderSafeToSpend } from './safe-to-spend-widget';

function currentProps(): WidgetProps {
  try {
    return widgetTimeline(appDataOf(repository.loadAll()), toLocalDate())[0].props;
  } catch (error) {
    console.warn('Widget could not read the plan', error);
    return EMPTY_WIDGET;
  }
}

export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  // Taps open the app through deep links, so there is nothing to handle for clicks.
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(renderSafeToSpend(currentProps(), widgetInfo));
}
