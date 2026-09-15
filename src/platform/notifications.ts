/** Local notifications: permission, the Android channel, scheduling the reminder plan, and opening taps. */
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';

import { splitDate, type LocalDate } from '@/domain/dates';
import { planReminders, type PlannedReminder } from '@/domain/reminders';
import type { AppData } from '@/domain/types';

export const REMINDER_CHANNEL = 'reminders';

// Reminders that arrive while the app is open still show as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Android needs the channel before it can ask for permission or show anything. */
export async function prepareNotifications() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Reminders',
    description: 'Bills due, payday and check-ins',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export interface NotificationAccess {
  granted: boolean;
  /** False once the user refused for good: only the system settings can turn it back on. */
  canAskAgain: boolean;
}

export async function getNotificationAccess(): Promise<NotificationAccess> {
  const permission = await Notifications.getPermissionsAsync();
  return { granted: permission.granted, canAskAgain: permission.canAskAgain };
}

/** Asks the system while it still can, otherwise opens the app's settings. Resolves with whether reminders can show. */
export async function requestNotificationAccess(): Promise<boolean> {
  await prepareNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) {
    await Linking.openSettings();
    return false;
  }
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

function triggerFor(reminder: PlannedReminder): Notifications.NotificationTriggerInput {
  const { schedule } = reminder;
  const hour = Math.floor(schedule.minutes / 60);
  const minute = schedule.minutes % 60;
  if (schedule.type === 'daily') {
    return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: REMINDER_CHANNEL };
  }
  const [year, month, day] = splitDate(schedule.date);
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(year, month - 1, day, hour, minute),
    channelId: REMINDER_CHANNEL,
  };
}

let queue: Promise<void> = Promise.resolve();

/**
 * Replaces every scheduled reminder with the current plan. Runs one at a time, so quick successive
 * changes can't leave duplicates behind.
 */
export function syncReminders(data: AppData | null, today: LocalDate): Promise<void> {
  queue = queue.then(async () => {
    try {
      const { granted } = await getNotificationAccess();
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!data || !granted) return;
      const now = new Date();
      for (const reminder of planReminders(data, today, now.getHours() * 60 + now.getMinutes())) {
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.id,
          content: { title: reminder.title, body: reminder.body, data: { url: reminder.url }, sound: 'default' },
          trigger: triggerFor(reminder),
        });
      }
    } catch (error) {
      console.warn('Could not schedule reminders', error);
    }
  });
  return queue;
}

let lastOpened: string | null = null;

/** Opens the screen a tapped reminder points to, including the tap that launched the app. */
export function useNotificationRedirect(enabled: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const key = `${response.notification.request.identifier}@${response.notification.date}`;
      if (key === lastOpened) return;
      lastOpened = key;
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string') router.navigate(url as Href);
    };
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [enabled, router]);
}
