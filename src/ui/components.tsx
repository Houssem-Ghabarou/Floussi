import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import {
  BackHandler,
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
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RiskLevel } from '@/domain/engine';
import { sanitizeAmountInput, type CurrencyInfo } from '@/domain/money';

import { showDialog } from './dialog-store';
import { Icon, type IconName } from './icon';
import {
  CardShadow,
  fontFamilyFor,
  Fonts,
  MaxContentWidth,
  Radius,
  riskColors,
  Space,
  usePalette,
  type Palette,
} from './theme';

export const haptics = {
  tap() {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  },
  success() {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning() {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
};

type TextVariant =
  | 'hero'
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'caption'
  | 'label'
  | 'number';
type Tone = 'primary' | 'secondary' | 'muted' | 'brand' | 'income' | 'danger' | 'accent';

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
    case 'accent':
      return palette.accentText;
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
  const { fontWeight, ...flat } = (StyleSheet.flatten([textStyles[variant], style]) ?? {}) as TextStyle;
  return (
    <Text
      style={[flat, { fontFamily: fontFamilyFor(fontWeight), color: flat.color ?? color ?? toneColor(palette, tone) }]}
      {...rest}
    />
  );
}

/** Scrollable screen with safe-area padding and an optional fixed header. */
export function Screen({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      {header ? (
        <View style={[styles.screenHeader, { paddingTop: insets.top, backgroundColor: palette.background }]}>
          {header}
        </View>
      ) : null}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.screenContent, { paddingTop: header ? Space.lg : insets.top + Space.lg }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.screenInner}>{children}</View>
      </ScrollView>
    </View>
  );
}

/**
 * Full-height modal form with a Cancel header and an optional footer (it stays at the bottom, under the keyboard).
 * The focused input is always scrolled into view. With `confirmClose`, leaving asks before discarding.
 */
export function SheetScreen({
  title,
  children,
  footer,
  closeLabel = 'Cancel',
  confirmClose = false,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  confirmClose?: boolean;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const close = () => {
    if (!confirmClose) {
      leave();
      return;
    }
    showDialog({
      icon: 'edit',
      tone: 'danger',
      title: 'Discard your changes?',
      message: "What you entered on this screen won't be saved.",
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      onConfirm: leave,
    });
  };

  // The Android back button asks too, instead of silently losing what was typed.
  useEffect(() => {
    if (!confirmClose) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [confirmClose, close]);

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      {/* No swipe-to-dismiss while there are unsaved changes. */}
      <Stack.Screen options={{ gestureEnabled: !confirmClose }} />
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
        <AppText variant="heading" style={styles.sheetTitle} numberOfLines={1}>
          {title}
        </AppText>
        <View style={styles.sheetHeaderSide} />
      </View>
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={Space.xl}>
        <View style={styles.screenInner}>{children}</View>
      </KeyboardAwareScrollView>
      {footer ? (
        <View
          style={[
            styles.sheetFooter,
            { paddingBottom: insets.bottom + Space.md, borderTopColor: palette.border, backgroundColor: palette.background },
          ]}>
          <View style={styles.screenInner}>{footer}</View>
        </View>
      ) : null}
    </View>
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
    <View style={[styles.card, tint ? { backgroundColor: tint } : [{ backgroundColor: palette.surface }, CardShadow], style]}>
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

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  disabled,
  compact,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const colors = {
    primary: { bg: palette.brand, fg: palette.brandText },
    secondary: { bg: palette.surfaceMuted, fg: palette.text },
    ghost: { bg: 'transparent', fg: palette.brand },
    danger: { bg: palette.atRiskSoft, fg: palette.danger },
    destructive: { bg: palette.danger, fg: palette.onDanger },
  }[variant];
  const iconSize = compact ? 16 : 18;

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
        variant === 'primary' && !disabled && styles.buttonShadow,
        { backgroundColor: colors.bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {icon ? <Icon name={icon} size={iconSize} color={colors.fg} /> : null}
      <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color: colors.fg }]}>{label}</Text>
      {iconRight ? <Icon name={iconRight} size={iconSize} color={colors.fg} /> : null}
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
        { backgroundColor: selected ? palette.brandDeep : palette.surfaceMuted },
        pressed && styles.pressed,
        style,
      ]}>
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      <AppText variant="small" color={selected ? '#FFFFFF' : palette.textSecondary} style={styles.chipLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.chipGroup}>{children}</View>;
}

/** Round tinted tile holding an icon or an emoji. */
export function IconCircle({
  icon,
  emoji,
  size = 32,
  color,
  background,
}: {
  icon?: IconName;
  emoji?: string;
  size?: number;
  color?: string;
  background?: string;
}) {
  const palette = usePalette();
  return (
    <View
      style={[
        styles.iconCircle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background ?? palette.surfaceLow },
      ]}>
      {icon ? <Icon name={icon} size={Math.round(size * 0.55)} color={color ?? palette.textSecondary} /> : null}
      {emoji ? <Text style={{ fontSize: Math.round(size * 0.48) }}>{emoji}</Text> : null}
    </View>
  );
}

export function ListRow({
  emoji,
  icon,
  tileColor,
  title,
  subtitle,
  value,
  valueColor,
  valueCaption,
  onPress,
  right,
}: {
  emoji?: string;
  icon?: IconName;
  tileColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  valueCaption?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const content = (
    <View style={styles.row}>
      {emoji || icon ? <IconCircle emoji={emoji} icon={icon} size={40} background={tileColor} /> : null}
      <View style={styles.rowText}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="secondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <View style={styles.rowValue}>
          <AppText variant="number" color={valueColor}>
            {value}
          </AppText>
          {valueCaption ? (
            <AppText variant="caption" tone="muted">
              {valueCaption}
            </AppText>
          ) : null}
        </View>
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

export function SectionTitle({
  title,
  subtitle,
  count,
  action,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  action?: { label: string; onPress: () => void };
}) {
  const palette = usePalette();
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.flex}>
        <View style={styles.sectionTitleRow}>
          <AppText variant="heading">{title}</AppText>
          {count !== undefined ? (
            <View style={[styles.countBadge, { backgroundColor: palette.surfaceMuted }]}>
              <AppText variant="caption" tone="secondary">
                {count}
              </AppText>
            </View>
          ) : null}
        </View>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
          <AppText variant="small" tone="brand" style={styles.strong}>
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Page title block used at the top of tab screens. */
export function PageIntro({
  title,
  subtitle,
  icon,
  onIconPress,
  iconLabel,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onIconPress?: () => void;
  iconLabel?: string;
}) {
  const palette = usePalette();
  return (
    <View style={styles.pageIntro}>
      <View style={styles.flex}>
        <AppText variant="title">{title}</AppText>
        {subtitle ? (
          <AppText variant="small" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {icon && onIconPress ? (
        <Pressable
          onPress={onIconPress}
          accessibilityRole="button"
          accessibilityLabel={iconLabel}
          hitSlop={6}
          style={({ pressed }) => [styles.pageIntroButton, { backgroundColor: palette.surfaceHigh }, pressed && styles.pressed]}>
          <Icon name={icon} size={20} color={palette.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider() {
  const palette = usePalette();
  return <View style={[styles.divider, { backgroundColor: palette.surfaceHigh }]} />;
}

export function ProgressBar({ progress, color, height = 6 }: { progress: number; color: string; height?: number }) {
  const palette = usePalette();
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.progressTrack, { height, backgroundColor: palette.surfaceHighest }]}>
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** A stacked proportional bar, e.g. protected / spent / flexible. */
export function SegmentBar({
  segments,
  height = 8,
  track,
}: {
  segments: { value: number; color: string }[];
  height?: number;
  track?: string;
}) {
  const palette = usePalette();
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <View style={[styles.segmentTrack, { height, backgroundColor: track ?? palette.surfaceHigh }]}>
      {total > 0
        ? visible.map((segment, index) => (
            <View key={index} style={{ flex: segment.value / total, backgroundColor: segment.color }} />
          ))
        : null}
    </View>
  );
}

export function LegendDot({ color, label, textColor }: { color: string; label: string; textColor?: string }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText variant="caption" tone="muted" color={textColor}>
        {label}
      </AppText>
    </View>
  );
}

export function StatusPill({ level, label }: { level: RiskLevel; label: string }) {
  const palette = usePalette();
  const colors = riskColors(palette, level);
  return <Badge label={label} color={colors.fg} background={colors.bg} dot />;
}

/** Small rounded tag: "Protected", "Active · 5d/wk", "16 days left"… */
export function Badge({
  label,
  color,
  background,
  icon,
  dot,
}: {
  label: string;
  color?: string;
  background?: string;
  icon?: IconName;
  dot?: boolean;
}) {
  const palette = usePalette();
  const fg = color ?? palette.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: background ?? palette.surfaceMuted }]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: fg }]} /> : null}
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <AppText variant="caption" color={fg} style={styles.strong} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/** Tinted explainer panel with an icon, a title and supporting copy. */
export function Callout({
  icon,
  iconColor,
  iconBackground,
  title,
  children,
  background,
  onPress,
}: {
  icon: IconName;
  iconColor?: string;
  iconBackground?: string;
  title: string;
  children?: ReactNode;
  background?: string;
  onPress?: () => void;
}) {
  const palette = usePalette();
  const body = (
    <View style={[styles.callout, { backgroundColor: background ?? palette.surfaceLow }]}>
      <IconCircle icon={icon} size={36} color={iconColor ?? palette.brand} background={iconBackground ?? palette.surface} />
      <View style={styles.calloutText}>
        <AppText variant="bodyStrong">{title}</AppText>
        {children}
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
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
        <AppText variant="small" tone="muted">
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
      style={[
        styles.textField,
        { backgroundColor: palette.surface, borderColor: palette.surfaceHighest, color: palette.text },
        props.style,
      ]}
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
  const fontSize = size === 'large' ? 44 : 26;
  return (
    <View
      style={[
        styles.amountField,
        size === 'medium' && styles.amountFieldMedium,
        { backgroundColor: palette.surface, borderColor: palette.surfaceHighest },
      ]}>
      {prefix ? (
        <Text style={[styles.amountAffix, { color: palette.textSecondary, fontSize: fontSize * 0.6 }]}>{prefix}</Text>
      ) : null}
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
      <Text style={[styles.amountAffix, { color: palette.textSecondary, fontSize: Math.max(14, fontSize * 0.4) }]}>
        {currency.label}
      </Text>
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
            style={[styles.segment, selected && [{ backgroundColor: palette.surface }, CardShadow]]}>
            <AppText variant="small" tone={selected ? 'primary' : 'secondary'} style={selected && styles.strong}>
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
      <AppText variant={strong ? 'bodyStrong' : 'body'} tone={strong ? 'primary' : 'secondary'} style={styles.flex}>
        {label}
      </AppText>
      <AppText variant={strong ? 'bodyStrong' : 'body'} color={color} style={styles.tabular}>
        {value}
      </AppText>
    </View>
  );
}

const textStyles = StyleSheet.create({
  hero: { fontSize: 44, lineHeight: 52, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1.2 },
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.8 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '600', letterSpacing: -0.4 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600', letterSpacing: -0.18 },
  body: { fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 19, letterSpacing: 0.065 },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: '500', letterSpacing: 0.33 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.55, textTransform: 'uppercase' },
  number: { fontSize: 15, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strong: { fontWeight: '600' },
  pressed: { opacity: 0.85 },
  tabular: { fontVariant: ['tabular-nums'] },
  screenHeader: {
    zIndex: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
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
  card: { borderRadius: Radius.md, padding: Space.lg, gap: Space.md },
  button: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  buttonShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  buttonCompact: { minHeight: 36, borderRadius: Radius.xs, paddingHorizontal: Space.md, gap: 6 },
  buttonLabel: { fontSize: 14, lineHeight: 18, letterSpacing: 0.14, fontFamily: Fonts.semibold },
  buttonLabelCompact: { fontSize: 13 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontWeight: '600' },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 6 },
  rowText: { flex: 1, gap: 1 },
  rowValue: { alignItems: 'flex-end', gap: 2 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Space.xs },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  countBadge: { borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  pageIntro: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  pageIntroButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1 },
  progressTrack: { borderRadius: Radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.pill },
  segmentTrack: { flexDirection: 'row', borderRadius: Radius.pill, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: Space.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  callout: { flexDirection: 'row', gap: Space.md, padding: Space.lg, borderRadius: Radius.md },
  calloutText: { flex: 1, gap: 2 },
  field: { gap: Space.sm },
  textField: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Space.md,
    fontSize: 15,
    fontFamily: Fonts.regular,
  },
  amountField: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Space.lg,
    paddingHorizontal: Space.lg,
  },
  amountFieldMedium: { paddingVertical: Space.sm },
  amountInput: { minWidth: 72, textAlign: 'center', padding: 0, fontFamily: Fonts.bold, fontVariant: ['tabular-nums'] },
  amountAffix: { fontFamily: Fonts.semibold },
  segmented: { flexDirection: 'row', borderRadius: Radius.sm, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Space.sm, borderRadius: Radius.sm - 3 },
  moneyLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md },
});
