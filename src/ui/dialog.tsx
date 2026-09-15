import { useEffect } from 'react';
import { BackHandler, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';

import { AppText, Button, haptics, IconCircle } from './components';
import { useDialogStore } from './dialog-store';
import { Radius, Space, usePalette } from './theme';

/** Renders the dialog opened with showDialog / confirmDestructive, above every screen and modal. */
export function DialogHost() {
  const dialog = useDialogStore((state) => state.dialog);
  const close = useDialogStore((state) => state.close);
  const palette = usePalette();

  const cancel = () => {
    const current = useDialogStore.getState().dialog;
    close();
    current?.onCancel?.();
  };

  useEffect(() => {
    if (!dialog) return;
    Keyboard.dismiss();
    if (dialog.tone === 'danger') haptics.warning();
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const current = useDialogStore.getState().dialog;
      useDialogStore.getState().close();
      current?.onCancel?.();
      return true;
    });
    return () => subscription.remove();
  }, [dialog]);

  if (!dialog) return null;
  const danger = dialog.tone === 'danger';

  const confirm = () => {
    close();
    dialog.onConfirm?.();
  };

  const content = (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(160)} style={[StyleSheet.absoluteFill, styles.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityLabel="Close" />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          key={dialog.id}
          entering={ZoomIn.duration(180)}
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[styles.card, { backgroundColor: palette.surface }]}>
          {dialog.icon ? (
            <IconCircle
              icon={dialog.icon}
              size={52}
              color={danger ? palette.danger : palette.onBrandSoft}
              background={danger ? palette.atRiskSoft : palette.brandSoft}
            />
          ) : null}
          <View style={styles.text}>
            <AppText variant="heading" style={styles.centerText}>
              {dialog.title}
            </AppText>
            {dialog.message ? (
              <AppText variant="small" tone="secondary" style={styles.centerText}>
                {dialog.message}
              </AppText>
            ) : null}
          </View>
          <View style={styles.actions}>
            {dialog.cancelLabel !== null ? (
              <Button label={dialog.cancelLabel ?? 'Cancel'} variant="secondary" onPress={cancel} style={styles.flex} />
            ) : null}
            <Button
              label={dialog.confirmLabel ?? 'OK'}
              variant={danger && dialog.cancelLabel !== null ? 'destructive' : 'primary'}
              onPress={confirm}
              style={styles.flex}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );

  // iOS presents modals in their own window: the overlay window keeps the dialog on top of them.
  return Platform.OS === 'ios' ? <FullWindowOverlay>{content}</FullWindowOverlay> : content;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(15, 20, 23, 0.5)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space.xl },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.lg,
    padding: Space.xl,
    gap: Space.lg,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  text: { gap: Space.xs, alignSelf: 'stretch' },
  centerText: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Space.sm, alignSelf: 'stretch' },
});
