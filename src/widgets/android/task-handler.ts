/**
 * Runs in the background when Android adds, resizes or periodically refreshes the widget. It reads the
 * database itself, so the widget moves to the new day after midnight even if the app is never opened.
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { repository } from '@/data/repository';
import { toLocalDate } from '@/domain/dates';
import { emptyWidget, widgetTimeline, type WidgetProps } from '@/domain/widget-snapshot';
import { applyTextLanguage, resolveLanguage } from '@/platform/language';
import { appDataOf } from '@/store/app-store';

import { renderSafeToSpend } from './safe-to-spend-widget';

function currentProps(): WidgetProps {
  try {
    const stored = repository.loadAll();
    // The widget draws outside the app, so it has to pick the language up from the database.
    applyTextLanguage(resolveLanguage(stored.language));
    return widgetTimeline(appDataOf(stored), toLocalDate())[0].props;
  } catch (error) {
    console.warn('Widget could not read the plan', error);
    return emptyWidget();
  }
}

export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  // Taps open the app through deep links, so there is nothing to handle for clicks.
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(renderSafeToSpend(currentProps(), widgetInfo));
}
