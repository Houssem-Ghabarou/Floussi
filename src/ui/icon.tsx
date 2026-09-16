import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import lightWeight from 'expo-symbols/androidWeights/light';
import { I18nManager, type StyleProp, type ViewStyle } from 'react-native';

import { usePalette } from './theme';

/** Line icons from the design: Material Symbols on Android and web, the closest SF Symbol on iOS. */
const ICONS = {
  today: { android: 'calendar_today', ios: 'calendar' },
  month: { android: 'calendar_month', ios: 'calendar.badge.clock' },
  routine: { android: 'wb_sunny', ios: 'sun.max' },
  rules: { android: 'tune', ios: 'slider.horizontal.3' },
  add: { android: 'add', ios: 'plus' },
  close: { android: 'close', ios: 'xmark' },
  check: { android: 'check', ios: 'checkmark' },
  checkCircle: { android: 'check_circle', ios: 'checkmark.circle.fill' },
  chevronLeft: { android: 'chevron_left', ios: 'chevron.left' },
  chevronRight: { android: 'chevron_right', ios: 'chevron.right' },
  arrowForward: { android: 'arrow_forward', ios: 'arrow.right' },
  edit: { android: 'edit', ios: 'pencil' },
  event: { android: 'event', ios: 'calendar' },
  schedule: { android: 'schedule', ios: 'clock' },
  help: { android: 'help', ios: 'questionmark.circle' },
  info: { android: 'info', ios: 'info.circle' },
  eco: { android: 'eco', ios: 'leaf' },
  quote: { android: 'format_quote', ios: 'quote.opening' },
  flag: { android: 'flag', ios: 'flag' },
  repeat: { android: 'repeat', ios: 'repeat' },
  lightbulb: { android: 'lightbulb', ios: 'lightbulb' },
  insights: { android: 'insights', ios: 'chart.line.uptrend.xyaxis' },
  donut: { android: 'donut_large', ios: 'chart.pie' },
  wallet: { android: 'account_balance_wallet', ios: 'wallet.bifold' },
  payments: { android: 'payments', ios: 'banknote' },
  receipt: { android: 'receipt_long', ios: 'doc.text' },
  savings: { android: 'savings', ios: 'target' },
  shield: { android: 'shield', ios: 'shield' },
  verified: { android: 'verified_user', ios: 'checkmark.shield' },
  lock: { android: 'lock', ios: 'lock' },
  bolt: { android: 'bolt', ios: 'bolt' },
  shopping: { android: 'shopping_bag', ios: 'bag' },
  bedtime: { android: 'bedtime', ios: 'moon' },
  trendingUp: { android: 'trending_up', ios: 'arrow.up.right' },
  trendingDown: { android: 'trending_down', ios: 'arrow.down.right' },
  restart: { android: 'restart_alt', ios: 'arrow.counterclockwise' },
  backup: { android: 'backup', ios: 'icloud.and.arrow.up' },
  upload: { android: 'upload', ios: 'square.and.arrow.up' },
  download: { android: 'download', ios: 'square.and.arrow.down' },
  home: { android: 'home', ios: 'house' },
  delete: { android: 'delete', ios: 'trash' },
  warning: { android: 'warning', ios: 'exclamationmark.triangle' },
  bell: { android: 'notifications', ios: 'bell' },
} satisfies Record<string, { android: AndroidSymbol; ios: SFSymbol }>;

export type IconName = keyof typeof ICONS;

/** Icons that point somewhere: they have to face the other way when the layout is mirrored. */
const MIRROR_IN_RTL = new Set<IconName>(['chevronLeft', 'chevronRight', 'arrowForward']);

/** Light keeps the icons linear. Android needs the weight object; iOS takes the name. */
const WEIGHT = { ios: 'light', android: lightWeight } as const;

export function Icon({
  name,
  size = 20,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const symbol = ICONS[name];
  const mirrored = I18nManager.isRTL && MIRROR_IN_RTL.has(name);
  return (
    <SymbolView
      name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
      size={size}
      weight={WEIGHT}
      tintColor={color ?? palette.textSecondary}
      style={[style, mirrored ? { transform: [{ scaleX: -1 }] } : null]}
    />
  );
}
