import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Radius, Space, usePalette } from './theme';

interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const useToastStore = create<{ toast: Toast | null; hide: () => void }>()((set) => ({
  toast: null,
  hide: () => set({ toast: null }),
}));

/** Shows a short confirmation, optionally with an action such as Undo. */
export function showToast(message: string, action?: { label: string; onPress: () => void }) {
  useToastStore.setState({
    toast: { id: Date.now(), message, actionLabel: action?.label, onAction: action?.onPress },
  });
}

export function ToastHost() {
  const toast = useToastStore((state) => state.toast);
  const hide = useToastStore((state) => state.hide);
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hide, 4500);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  if (!toast) return null;

  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown}
      exiting={FadeOutDown}
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + 96 }]}>
      <View style={[styles.toast, { backgroundColor: palette.text }]} accessibilityLiveRegion="polite">
        <Text style={[styles.message, { color: palette.background }]}>{toast.message}</Text>
        {toast.actionLabel ? (
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            onPress={() => {
              toast.onAction?.();
              hide();
            }}>
            <Text style={[styles.action, { color: palette.brandSoft }]}>{toast.actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: Space.lg, right: Space.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
    maxWidth: 560,
    width: '100%',
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  message: { flex: 1, fontSize: 15, fontWeight: '500' },
  action: { fontSize: 15, fontWeight: '700' },
});
