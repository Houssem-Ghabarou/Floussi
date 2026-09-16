import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet, useColorScheme, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { currentLanguage, t } from '@/i18n';
import { applyLanguage, lockLeftToRight, resolveLanguage } from '@/platform/language';
import { useNotificationRedirect } from '@/platform/notifications';
import { startBackgroundSync } from '@/platform/sync';
import { useApp } from '@/store/app-store';
import { AppText, Button } from '@/ui/components';
import { DialogHost } from '@/ui/dialog';
import { Space, usePalette } from '@/ui/theme';
import { ToastHost } from '@/ui/toast';

SplashScreen.preventAutoHideAsync();
// Flousey reads left to right in every language; this also undoes the mirroring older builds set.
lockLeftToRight();

const modal = { presentation: 'modal' } as const;

// Links from widgets and reminders (flousey://expense…) open over the tabs, so closing lands on Today.
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const status = useApp((state) => state.status);
  const onboarded = useApp((state) => state.settings?.onboarded ?? false);
  const load = useApp((state) => state.load);
  const refreshToday = useApp((state) => state.refreshToday);
  const scheme = useColorScheme();
  const palette = usePalette();
  const chosenLanguage = useApp((state) => state.language);
  const language = resolveLanguage(chosenLanguage);
  // Applied while rendering, so the first screen already shows the right language. Deliberately not a
  // useMemo: its result would be unused, and the React Compiler is free to drop such a memo entirely.
  if (currentLanguage() !== language) applyLanguage(language);
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // A font that fails to load falls back to the system font rather than blocking the app.
  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (status !== 'loading' && fontsReady) SplashScreen.hideAsync();
  }, [status, fontsReady]);

  // The safe amount is per calendar day: refresh "today" whenever the app comes back.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshToday();
    });
    return () => subscription.remove();
  }, [refreshToday]);

  // Reminders and home-screen widgets follow the data on this phone.
  useEffect(() => startBackgroundSync(), []);
  useNotificationRedirect(status === 'ready' && onboarded);

  if (status === 'loading' || !fontsReady) return null;

  if (status === 'error') {
    return (
      <View style={[styles.error, { backgroundColor: palette.background }]}>
        <AppText variant="heading">{t('common.loadError')}</AppText>
        <Button label={t('common.tryAgain')} onPress={load} />
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
    <KeyboardProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="auto" />
        {/* Keyed on the language: picking a new one redraws every screen, so nothing stays behind. */}
        <Stack
          key={language}
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="activity" options={modal} />
            <Stack.Screen name="history" options={modal} />
            <Stack.Screen name="day" options={modal} />
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
        <DialogHost />
      </ThemeProvider>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: Space.xl, gap: Space.lg },
});
