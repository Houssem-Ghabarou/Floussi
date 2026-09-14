import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RISK_META } from '@/domain/advice';
import type { RiskLevel } from '@/domain/engine';
import { sanitizeAmountInput, type CurrencyInfo } from '@/domain/money';

import { MaxContentWidth, Radius, Space, riskColors, usePalette, type Palette } from './theme';

export const haptics = {
  tap() {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  },
  success() {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
};

type TextVariant = 'hero' | 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'label';
type Tone = 'primary' | 'secondary' | 'muted' | 'brand' | 'income' | 'danger';

function toneColor(palette: Palette, tone: Tone): string {
  switch (tone) {
    case 'primary':
      return palette.text;
    case 'secondary':
      return palette.textSecondary;
    case 'muted':
      return palette.textMuted;
    case 'brand':
      return palette.brand;
    case 'income':
      return palette.income;
    case 'danger':
      return palette.danger;
  }
}

export function AppText({
  variant = 'body',
  tone = 'primary',
  color,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; tone?: Tone; color?: string }) {
  const palette = usePalette();
  return <Text style={[textStyles[variant], { color: color ?? toneColor(palette, tone) }, style]} {...rest} />;
}

/** Scrollable tab screen with safe-area padding. */
export function Screen({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={[styles.screenContent, { paddingTop: insets.top + Space.lg }]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.screenInner}>{children}</View>
    </ScrollView>
  );
}

/** Full-height modal form with a Cancel header and an optional sticky footer. */
export function SheetScreen({
  title,
  children,
  footer,
  closeLabel = 'Cancel',
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={[
          styles.sheetHeader,
          {
            paddingTop: Platform.OS === 'ios' ? Space.lg : insets.top + Space.md,
            borderBottomColor: palette.border,
          },
        ]}>
        <Pressable onPress={close} hitSlop={12} style={styles.sheetHeaderSide} accessibilityRole="button">
          <AppText variant="bodyStrong" tone="brand">
            {closeLabel}
          </AppText>
        </Pressable>
        <AppText variant="bodyStrong" style={styles.sheetTitle} numberOfLines={1}>
          {title}
        </AppText>
        <View style={styles.sheetHeaderSide} />
      </View>
      <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
        <View style={styles.screenInner}>{children}</View>
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.sheetFooter,
            { paddingBottom: insets.bottom + Space.md, borderTopColor: palette.border, backgroundColor: palette.background },
          ]}>
          <View style={styles.screenInner}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Card({
  children,
  style,
  onPress,
  tint,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tint?: string;
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  const body = (
    <View style={[styles.card, { backgroundColor: tint ?? palette.surface, borderColor: tint ?? palette.border }, style]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  compact,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: string;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const colors = {
    primary: { bg: palette.brand, fg: palette.brandText, border: palette.brand },
    secondary: { bg: palette.surface, fg: palette.text, border: palette.border },
    ghost: { bg: 'transparent', fg: palette.brand, border: 'transparent' },
    danger: { bg: 'transparent', fg: palette.danger, border: palette.border },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {icon ? <Text style={[styles.buttonIcon, { color: colors.fg }]}>{icon}</Text> : null}
      <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color: colors.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  emoji,
  selected,
  onPress,
  style,
}: {
  label: string;
  emoji?: string;
  selected?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? palette.brandSoft : palette.surface,
          borderColor: selected ? palette.brand : palette.border,
        },
        pressed && styles.pressed,
        style,
      ]}>
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      <AppText variant="small" style={{ fontWeight: selected ? '700' : '500' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.chipGroup}>{children}</View>;
}

export function ListRow({
  emoji,
  title,
  subtitle,
  value,
  valueColor,
  onPress,
  right,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const palette = usePalette();
  const content = (
    <View style={styles.row}>
      {emoji ? (
        <View style={[styles.rowEmoji, { backgroundColor: palette.surfaceMuted }]}>
          <Text style={styles.rowEmojiText}>{emoji}</Text>
        </View>
      ) : null}
      <View style={styles.rowText}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="bodyStrong" color={valueColor} style={styles.tabular}>
          {value}
        </AppText>
      ) : null}
      {right}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="label" tone="secondary">
        {title}
      </AppText>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
          <AppText variant="small" tone="brand" style={{ fontWeight: '700' }}>
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider() {
  const palette = usePalette();
  return <View style={[styles.divider, { backgroundColor: palette.border }]} />;
}

export function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const palette = usePalette();
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.progressTrack, { backgroundColor: palette.surfaceMuted }]}>
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function StatusPill({ level, label }: { level: RiskLevel; label?: string }) {
  const palette = usePalette();
  const colors = riskColors(palette, level);
  const meta = RISK_META[level];
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={styles.pillEmoji}>{meta.emoji}</Text>
      <Text style={[styles.pillText, { color: colors.fg }]}>{label ?? meta.label}</Text>
    </View>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText variant="label" tone="secondary">
        {label}
      </AppText>
      {children}
      {hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  const palette = usePalette();
  return (
    <TextInput
      placeholderTextColor={palette.textMuted}
      selectionColor={palette.brand}
      {...props}
      style={[styles.textField, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.text }, props.style]}
    />
  );
}

export function AmountField({
  value,
  onChangeText,
  currency,
  autoFocus,
  size = 'large',
  prefix,
  accessibilityLabel = 'Amount',
}: {
  value: string;
  onChangeText: (text: string) => void;
  currency: CurrencyInfo;
  autoFocus?: boolean;
  size?: 'large' | 'medium';
  prefix?: string;
  accessibilityLabel?: string;
}) {
  const palette = usePalette();
  const fontSize = size === 'large' ? 52 : 30;
  return (
    <View
      style={[
        styles.amountField,
        size === 'medium' && styles.amountFieldMedium,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}>
      {prefix ? <Text style={[styles.amountAffix, { color: palette.textSecondary, fontSize: fontSize * 0.6 }]}>{prefix}</Text> : null}
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(sanitizeAmountInput(text, currency))}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={palette.textMuted}
        selectionColor={palette.brand}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        style={[styles.amountInput, { color: palette.text, fontSize }]}
      />
      <Text style={[styles.amountAffix, { color: palette.textSecondary, fontSize: fontSize * 0.4 }]}>{currency.label}</Text>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const palette = usePalette();
  return (
    <View style={[styles.segmented, { backgroundColor: palette.surfaceMuted }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              haptics.tap();
              onChange(option.value);
            }}
            style={[styles.segment, selected && { backgroundColor: palette.surface }]}>
            <AppText variant="small" tone={selected ? 'primary' : 'secondary'} style={{ fontWeight: selected ? '700' : '500' }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A labelled money line used in breakdowns and summaries. */
export function MoneyLine({
  label,
  value,
  strong,
  color,
}: {
  label: string;
  value: string;
  strong?: boolean;
  color?: string;
}) {
  return (
    <View style={styles.moneyLine}>
      <AppText variant={strong ? 'bodyStrong' : 'body'} tone={strong ? 'primary' : 'secondary'} style={styles.moneyLineLabel}>
        {label}
      </AppText>
      <AppText variant={strong ? 'bodyStrong' : 'body'} color={color} style={styles.tabular}>
        {value}
      </AppText>
    </View>
  );
}

const textStyles = StyleSheet.create({
  hero: { fontSize: 64, lineHeight: 72, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1.5 },
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  tabular: { fontVariant: ['tabular-nums'] },
  screenContent: { paddingHorizontal: Space.lg, paddingBottom: Space.xxl * 2 },
  screenInner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Space.lg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingBottom: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetHeaderSide: { width: 72 },
  sheetTitle: { flex: 1, textAlign: 'center' },
  sheetContent: { padding: Space.lg, paddingBottom: Space.xxl },
  sheetFooter: { paddingHorizontal: Space.lg, paddingTop: Space.md, borderTopWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: Radius.md, padding: Space.lg, borderWidth: StyleSheet.hairlineWidth, gap: Space.md },
  button: {
    minHeight: 54,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  buttonCompact: { minHeight: 42, borderRadius: Radius.sm, paddingHorizontal: Space.md },
  buttonIcon: { fontSize: 18, fontWeight: '700' },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  buttonLabelCompact: { fontSize: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 16 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: Space.sm },
  rowEmoji: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowEmojiText: { fontSize: 20 },
  rowText: { flex: 1, gap: 2 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Space.sm },
  divider: { height: StyleSheet.hairlineWidth },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  pillEmoji: { fontSize: 12 },
  pillText: { fontSize: 14, fontWeight: '700' },
  field: { gap: Space.sm },
  textField: {
    minHeight: 50,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Space.md,
    fontSize: 16,
  },
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Space.lg,
    paddingHorizontal: Space.lg,
  },
  amountFieldMedium: { paddingVertical: Space.sm },
  amountInput: { minWidth: 72, textAlign: 'center', fontWeight: '700', padding: 0, fontVariant: ['tabular-nums'] },
  amountAffix: { fontWeight: '600' },
  segmented: { flexDirection: 'row', borderRadius: Radius.sm, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Space.sm, borderRadius: Radius.sm - 3 },
  moneyLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md },
  moneyLineLabel: { flex: 1 },
});
