/**
 * The Android home-screen widget: safe amount, status and quick actions, at every size.
 * The widget library calls these components as plain functions, so the React Compiler must leave them alone.
 */
'use no memo';

import { FlexWidget, TextWidget, type HexColor, type WidgetInfo, type WidgetRepresentation } from 'react-native-android-widget';

import type { WidgetProps, WidgetTone } from '@/domain/widget-snapshot';

export const ANDROID_WIDGET_NAME = 'SafeToSpend';

/** Font files bundled by the widget config plugin (app.json). Android widgets pick weights by file. */
const FONT = {
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

interface Colors {
  background: HexColor;
  text: HexColor;
  secondary: HexColor;
  muted: HexColor;
  button: HexColor;
  buttonText: HexColor;
  secondaryButton: HexColor;
  tone: Record<WidgetTone, { fg: HexColor; bg: HexColor }>;
}

const LIGHT: Colors = {
  background: '#FFFFFF',
  text: '#171C23',
  secondary: '#404944',
  muted: '#707973',
  button: '#185B43',
  buttonText: '#FFFFFF',
  secondaryButton: '#EAEEF8',
  tone: {
    good: { fg: '#185B43', bg: '#D4F5E4' },
    watch: { fg: '#904D00', bg: '#FFE6D3' },
    risk: { fg: '#BA1A1A', bg: '#FFDAD6' },
  },
};

const DARK: Colors = {
  background: '#181D21',
  text: '#E8ECF3',
  secondary: '#BFC9C2',
  muted: '#8A938D',
  button: '#5FBF94',
  buttonText: '#00261A',
  secondaryButton: '#2A3137',
  tone: {
    good: { fg: '#6FD3A5', bg: '#17362A' },
    watch: { fg: '#FFB77D', bg: '#3D2A18' },
    risk: { fg: '#FFB4AB', bg: '#442420' },
  },
};

const OPEN_TODAY = { uri: 'spnday://' };
/** From this width (dp) the buttons move to their own column next to the amount. */
const WIDE_FROM_DP = 230;
/** From this height (dp) the small widget also has room for the status text. */
const TALL_FROM_DP = 140;

interface Size {
  wide: boolean;
  tall: boolean;
}

function QuickAction({
  label,
  uri,
  colors,
  primary,
  compact,
}: {
  label: string;
  uri: string;
  colors: Colors;
  primary?: boolean;
  compact?: boolean;
}) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        ...(compact ? { flex: 1 } : { width: 'match_parent' }),
        alignItems: 'center',
        backgroundColor: primary ? colors.button : colors.secondaryButton,
        borderRadius: compact ? 10 : 12,
        paddingHorizontal: compact ? 2 : 12,
        paddingVertical: compact ? 6 : 8,
      }}>
      <TextWidget
        text={label}
        maxLines={1}
        style={{
          fontSize: compact ? 10 : 12,
          fontFamily: FONT.bold,
          color: primary ? colors.buttonText : colors.text,
          adjustsFontSizeToFit: compact,
        }}
      />
    </FlexWidget>
  );
}

function Layout({ props, colors, size }: { props: WidgetProps; colors: Colors; size: Size }) {
  const container = {
    width: 'match_parent',
    height: 'match_parent',
    backgroundColor: colors.background,
    borderRadius: 22,
  } as const;

  if (!props.ready) {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={OPEN_TODAY}
        style={{ ...container, padding: 14, flexDirection: 'column', justifyContent: 'center', flexGap: 4 }}>
        <TextWidget text="Spnday" style={{ fontSize: 16, fontFamily: FONT.bold, color: colors.text }} />
        <TextWidget text={props.caption} style={{ fontSize: 12, fontFamily: FONT.medium, color: colors.secondary }} />
      </FlexWidget>
    );
  }

  const tone = colors.tone[props.tone];

  if (!size.wide) {
    // Small: the status colour moves to a dot next to the label, so both buttons still fit.
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={OPEN_TODAY}
        style={{ ...container, padding: 12, flexDirection: 'column', justifyContent: 'space-between' }}>
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5 }}>
            <FlexWidget style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone.fg }} />
            <TextWidget
              text={props.caption.toLocaleUpperCase()}
              maxLines={1}
              style={{ fontSize: 10, fontFamily: FONT.bold, color: colors.muted, letterSpacing: 0.06 }}
            />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 3 }}>
            <TextWidget text={props.amount} maxLines={1} style={{ fontSize: 26, fontFamily: FONT.bold, color: colors.text }} />
            <TextWidget
              text={props.currency}
              style={{ fontSize: 11, fontFamily: FONT.semibold, color: colors.secondary, marginBottom: 4 }}
            />
          </FlexWidget>
          {size.tall ? (
            <TextWidget
              text={props.status}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 11, fontFamily: FONT.bold, color: tone.fg }}
            />
          ) : null}
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', flexGap: 6, width: 'match_parent' }}>
          <QuickAction label={props.addExpense} uri="spnday://expense" colors={colors} primary compact />
          <QuickAction label={props.addMoney} uri="spnday://income" colors={colors} compact />
        </FlexWidget>
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={OPEN_TODAY}
      style={{ ...container, padding: 14, flexDirection: 'row', flexGap: 12 }}>
      <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between' }}>
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget
            text={props.label}
            style={{ fontSize: 10, fontFamily: FONT.bold, color: colors.muted, letterSpacing: 0.06 }}
          />
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 4 }}>
            <TextWidget text={props.amount} maxLines={1} style={{ fontSize: 30, fontFamily: FONT.bold, color: colors.text }} />
            <TextWidget
              text={props.currency}
              style={{ fontSize: 13, fontFamily: FONT.semibold, color: colors.secondary, marginBottom: 5 }}
            />
          </FlexWidget>
          <TextWidget
            text={`${props.caption} · ${props.payday}`}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 11, fontFamily: FONT.medium, color: colors.secondary }}
          />
        </FlexWidget>
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexGap: 5,
            backgroundColor: tone.bg,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
          <FlexWidget style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone.fg }} />
          <TextWidget
            text={props.status}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 11, fontFamily: FONT.bold, color: tone.fg }}
          />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 108, height: 'match_parent', flexDirection: 'column', justifyContent: 'center', flexGap: 8 }}>
        <TextWidget
          text={props.balance}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 10, fontFamily: FONT.medium, color: colors.muted, textAlign: 'right' }}
        />
        <QuickAction label={props.addExpense} uri="spnday://expense" colors={colors} primary />
        <QuickAction label={props.addMoney} uri="spnday://income" colors={colors} />
      </FlexWidget>
    </FlexWidget>
  );
}

export function renderSafeToSpend(props: WidgetProps, info: Pick<WidgetInfo, 'width' | 'height'>): WidgetRepresentation {
  const size: Size = { wide: info.width >= WIDE_FROM_DP, tall: info.height >= TALL_FROM_DP };
  return {
    light: <Layout props={props} colors={LIGHT} size={size} />,
    dark: <Layout props={props} colors={DARK} size={size} />,
  };
}
