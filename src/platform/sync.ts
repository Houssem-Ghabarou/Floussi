/** Keeps reminders and home-screen widgets in line with the data on this phone. */
import { AppState } from 'react-native';

import { appDataOf, useApp } from '@/store/app-store';

import { prepareNotifications, syncReminders } from './notifications';
import { syncWidgets } from './widgets';

let timer: ReturnType<typeof setTimeout> | undefined;

export function syncNow() {
  clearTimeout(timer);
  const state = useApp.getState();
  if (state.status !== 'ready') return;
  const data = appDataOf(state);
  syncWidgets(data, state.today);
  void syncReminders(data, state.today);
}

function syncSoon() {
  clearTimeout(timer);
  timer = setTimeout(syncNow, 400);
}

/** At launch, whenever the data changes, and each time the app comes back to the foreground. */
export function startBackgroundSync(): () => void {
  prepareNotifications().catch(() => {});
  const unsubscribe = useApp.subscribe((state, previous) => {
    if (
      state.status !== previous.status ||
      state.today !== previous.today ||
      state.settings !== previous.settings ||
      state.cycles !== previous.cycles ||
      state.transactions !== previous.transactions ||
      state.bills !== previous.bills ||
      state.routines !== previous.routines
    ) {
      syncSoon();
    }
  });
  // Opening the app also pushes the "haven't seen you in a while" reminder a few days further.
  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') syncSoon();
  });
  syncSoon();
  return () => {
    unsubscribe();
    appState.remove();
    clearTimeout(timer);
  };
}
