/**
 * The iOS home-screen and lock-screen widget. The 'widget' function runs in the widget's own runtime:
 * it can only use @expo/ui/swift-ui components and modifiers, so colors live inside it.
 */
import { HStack, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  backgroundOverlay,
  containerBackground,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetProps } from '@/domain/widget-snapshot';

const SafeToSpendWidget = (props: WidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const colors = dark
    ? {
        background: '#181D21',
        text: '#E8ECF3',
        secondary: '#BFC9C2',
        muted: '#8A938D',
        button: '#5FBF94',
        buttonText: '#00261A',
        secondaryButton: '#2A3137',
        good: '#6FD3A5',
        watch: '#FFB77D',
        risk: '#FFB4AB',
      }
    : {
        background: '#FFFFFF',
        text: '#171C23',
        secondary: '#404944',
        muted: '#707973',
        button: '#185B43',
        buttonText: '#FFFFFF',
        secondaryButton: '#EAEEF8',
        good: '#185B43',
        watch: '#904D00',
        risk: '#BA1A1A',
      };
  const tone = props.tone === 'risk' ? colors.risk : props.tone === 'watch' ? colors.watch : colors.good;
  const family = environment.widgetFamily;
  const fill = frame({ maxWidth: 2000, maxHeight: 2000, alignment: 'topLeading' });

  if (family === 'accessoryInline') {
    return (
      <Text modifiers={[widgetURL('flousey://')]}>
        {props.ready ? `${props.amount} ${props.currency} ${props.caption}` : 'Flousey'}
      </Text>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[containerBackground('clear', 'widget'), widgetURL('flousey://')]}>
        <Text modifiers={[font({ size: 11, weight: 'semibold' })]}>{props.ready ? props.label : 'FLOUSEY'}</Text>
        <Text modifiers={[font({ size: 20, weight: 'bold' }), lineLimit(1), minimumScaleFactor(0.6)]}>
          {props.ready ? `${props.amount} ${props.currency}` : props.caption}
        </Text>
        {props.ready ? <Text modifiers={[font({ size: 11, weight: 'medium' }), lineLimit(1)]}>{props.status}</Text> : null}
      </VStack>
    );
  }

  const card = [containerBackground(colors.background, 'widget'), widgetURL('flousey://')];

  if (!props.ready) {
    return (
      <VStack alignment="leading" spacing={4} modifiers={[...card, fill]}>
        <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(colors.text)]}>Flousey</Text>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(colors.secondary)]}>{props.caption}</Text>
      </VStack>
    );
  }

  const summary = (
    <VStack alignment="leading" spacing={0} modifiers={[fill]}>
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(colors.muted)]}>{props.label}</Text>
      <HStack spacing={4}>
        <Text
          modifiers={[
            font({ size: 34, weight: 'bold', design: 'rounded' }),
            foregroundStyle(colors.text),
            lineLimit(1),
            minimumScaleFactor(0.5),
          ]}>
          {props.amount}
        </Text>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(colors.secondary)]}>{props.currency}</Text>
      </HStack>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(colors.secondary), lineLimit(1)]}>
        {family === 'systemMedium' ? `${props.caption} · ${props.payday}` : props.caption}
      </Text>
      <Spacer />
      <HStack spacing={5}>
        <Text modifiers={[font({ size: 8 }), foregroundStyle(tone)]}>●</Text>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(tone), lineLimit(1), minimumScaleFactor(0.7)]}>
          {props.status}
        </Text>
      </HStack>
    </VStack>
  );

  if (family !== 'systemMedium') {
    return (
      <VStack alignment="leading" spacing={0} modifiers={card}>
        {summary}
      </VStack>
    );
  }

  return (
    <HStack spacing={12} modifiers={card}>
      {summary}
      <VStack alignment="trailing" spacing={8} modifiers={[frame({ width: 120 })]}>
        <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(colors.muted), lineLimit(1), minimumScaleFactor(0.7)]}>
          {props.balance}
        </Text>
        <Link destination="flousey://expense">
          <Text
            modifiers={[
              font({ size: 13, weight: 'bold' }),
              foregroundStyle(colors.buttonText),
              frame({ width: 120, height: 36 }),
              backgroundOverlay({ color: colors.button }),
              cornerRadius(12),
            ]}>
            {props.addExpense}
          </Text>
        </Link>
        <Link destination="flousey://income">
          <Text
            modifiers={[
              font({ size: 13, weight: 'bold' }),
              foregroundStyle(colors.text),
              frame({ width: 120, height: 36 }),
              backgroundOverlay({ color: colors.secondaryButton }),
              cornerRadius(12),
            ]}>
            {props.addMoney}
          </Text>
        </Link>
      </VStack>
    </HStack>
  );
};

export default createWidget<WidgetProps>('SafeToSpend', SafeToSpendWidget);
