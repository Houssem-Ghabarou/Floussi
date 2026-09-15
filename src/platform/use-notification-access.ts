import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getNotificationAccess, requestNotificationAccess, type NotificationAccess } from './notifications';
import { syncNow } from './sync';

/** Current notification permission, refreshed when the user comes back from the system settings. */
export function useNotificationAccess() {
  const [access, setAccess] = useState<NotificationAccess | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      getNotificationAccess()
        .then((value) => {
          if (active) setAccess(value);
        })
        .catch(() => {});
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const request = async () => {
    const granted = await requestNotificationAccess();
    setAccess(await getNotificationAccess());
    // Schedule right away: the permission can arrive after the data-change sync already ran.
    if (granted) syncNow();
    return granted;
  };

  return { access, request };
}
