/**
 * The Android home-screen widget: safe amount, status, and quick actions on the wider size.
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

const OPEN_TODAY = { uri: 'flousey://' };
/** Below this width (dp) the widget is the small one, without quick actions. */
const WIDE_FROM_DP = 230;

function QuickAction({ label, uri, colors, primary }: { label: string; uri: string; colors: Colors; primary?: boolean }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        width: 'match_parent',
        alignItems: 'center',
        backgroundColor: primary ? colors.button : colors.secondaryButton,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}>
      <TextWidget
        text={label}
        style={{ fontSize: 12, fontFamily: FONT.bold, color: primary ? colors.buttonText : colors.text }}
      />
    </FlexWidget>
  );
}

function Layout({ props, colors, wide }: { props: WidgetProps; colors: Colors; wide: boolean }) {
  const container = {
    width: 'match_parent',
    height: 'match_parent',
    backgroundColor: colors.background,
    borderRadius: 22,
    padding: 14,
  } as const;

  if (!props.ready) {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={OPEN_TODAY}
        style={{ ...container, flexDirection: 'column', justifyContent: 'center', flexGap: 4 }}>
        <TextWidget text="Flousey" style={{ fontSize: 16, fontFamily: FONT.bold, color: colors.text }} />
        <TextWidget text={props.caption} style={{ fontSize: 12, fontFamily: FONT.medium, color: colors.secondary }} />
      </FlexWidget>
    );
  }

  const tone = colors.tone[props.tone];
  const summary = (
    <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'space-between' }}>
      <FlexWidget style={{ flexDirection: 'column' }}>
        <TextWidget
          text="SAFE TO SPEND"
          style={{ fontSize: 10, fontFamily: FONT.bold, color: colors.muted, letterSpacing: 0.06 }}
        />
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 4 }}>
          <TextWidget text={props.amount} style={{ fontSize: 30, fontFamily: FONT.bold, color: colors.text }} />
          <TextWidget
            text={props.currency}
            style={{ fontSize: 13, fontFamily: FONT.semibold, color: colors.secondary, marginBottom: 5 }}
          />
        </FlexWidget>
        <TextWidget
          text={wide ? `${props.caption} · ${props.payday}` : props.caption}
          style={{ fontSize: 11, fontFamily: FONT.medium, color: colors.secondary }}
          maxLines={1}
          truncate="END"
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
          style={{ fontSize: 11, fontFamily: FONT.bold, color: tone.fg }}
          maxLines={1}
          truncate="END"
        />
      </FlexWidget>
    </FlexWidget>
  );

  if (!wide) {
    return (
      <FlexWidget clickAction="OPEN_URI" clickActionData={OPEN_TODAY} style={{ ...container, flexDirection: 'column' }}>
        {summary}
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={OPEN_TODAY}
      style={{ ...container, flexDirection: 'row', flexGap: 12 }}>
      {summary}
      <FlexWidget style={{ width: 108, height: 'match_parent', flexDirection: 'column', justifyContent: 'center', flexGap: 8 }}>
        <TextWidget
          text={props.balance}
          style={{ fontSize: 10, fontFamily: FONT.medium, color: colors.muted, textAlign: 'right' }}
          maxLines={1}
          truncate="END"
        />
        <QuickAction label="+ Expense" uri="flousey://expense" colors={colors} primary />
        <QuickAction label="+ Money" uri="flousey://income" colors={colors} />
      </FlexWidget>
    </FlexWidget>
  );
}

export function renderSafeToSpend(props: WidgetProps, info: Pick<WidgetInfo, 'width'>): WidgetRepresentation {
  const wide = info.width >= WIDE_FROM_DP;
  return {
    light: <Layout props={props} colors={LIGHT} wide={wide} />,
    dark: <Layout props={props} colors={DARK} wide={wide} />,
  };
}
