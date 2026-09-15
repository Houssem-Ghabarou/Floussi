import { useRouter } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, haptics } from '@/ui/components';
import { Icon, type IconName } from '@/ui/icon';
import { usePalette } from '@/ui/theme';

/** Today · Month · [+] · Routine · Rules, with the add-expense button raised in the middle. */
export default function TabsLayout() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Tabs style={styles.flex}>
      <TabSlot />
      <View style={[styles.bar, { paddingBottom: insets.bottom, backgroundColor: palette.background }]}>
        <View style={styles.barInner}>
          <TabTrigger name="index" asChild>
            <TabButton icon="today" label="Today" />
          </TabTrigger>
          <TabTrigger name="month" asChild>
            <TabButton icon="month" label="Month" />
          </TabTrigger>
          <View style={styles.fabSlot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add an expense"
              onPress={() => {
                haptics.tap();
                router.push('/expense');
              }}
              style={({ pressed }) => [styles.fab, { backgroundColor: palette.brand }, pressed && styles.pressed]}>
              <Icon name="add" size={28} color={palette.brandText} />
            </Pressable>
          </View>
          <TabTrigger name="routines" asChild>
            <TabButton icon="routine" label="Routine" />
          </TabTrigger>
          <TabTrigger name="rules" asChild>
            <TabButton icon="rules" label="Rules" />
          </TabTrigger>
        </View>
      </View>
      <TabList style={styles.hidden}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="month" href="/month" />
        <TabTrigger name="routines" href="/routines" />
        <TabTrigger name="rules" href="/rules" />
      </TabList>
    </Tabs>
  );
}

function TabButton({ icon, label, isFocused, ...props }: TabTriggerSlotProps & { icon: IconName; label: string }) {
  const palette = usePalette();
  const color = isFocused ? palette.brand : palette.textSecondary;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      <View style={[styles.tabIcon, isFocused && { backgroundColor: palette.surfaceMuted }]}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <AppText variant="caption" color={color} style={isFocused && styles.focusedLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  pressed: { opacity: 0.8 },
  bar: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  barInner: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48 },
  tabIcon: { width: 48, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  focusedLabel: { fontWeight: '700' },
  fabSlot: { flex: 1, alignItems: 'center' },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#185B43',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
