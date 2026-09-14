import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet, useColorScheme, View } from 'react-native';

import { useApp } from '@/store/app-store';
import { AppText, Button } from '@/ui/components';
import { Space, usePalette } from '@/ui/theme';
import { ToastHost } from '@/ui/toast';

SplashScreen.preventAutoHideAsync();

const modal = { presentation: 'modal' } as const;

export default function RootLayout() {
  const status = useApp((state) => state.status);
  const onboarded = useApp((state) => state.settings?.onboarded ?? false);
  const load = useApp((state) => state.load);
  const refreshToday = useApp((state) => state.refreshToday);
  const scheme = useColorScheme();
  const palette = usePalette();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  // The safe amount is per calendar day: refresh "today" whenever the app comes back.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshToday();
    });
    return () => subscription.remove();
  }, [refreshToday]);

  if (status === 'loading') return null;

  if (status === 'error') {
    return (
      <View style={[styles.error, { backgroundColor: palette.background }]}>
        <AppText variant="heading">We couldn't open your data on this device.</AppText>
        <Button label="Try again" onPress={load} />
      </View>
    );
  }

  const baseTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: palette.brand,
      background: palette.background,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="expense" options={modal} />
          <Stack.Screen name="income" options={modal} />
          <Stack.Screen name="what-if" options={modal} />
          <Stack.Screen name="balance" options={modal} />
          <Stack.Screen name="breakdown" options={modal} />
          <Stack.Screen name="pay-bill" options={modal} />
          <Stack.Screen name="bill" options={modal} />
          <Stack.Screen name="routine" options={modal} />
          <Stack.Screen name="protections" options={modal} />
          <Stack.Screen name="payday" options={modal} />
          <Stack.Screen name="cycle-end" options={modal} />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
      <ToastHost />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: Space.xl, gap: Space.lg },
});
