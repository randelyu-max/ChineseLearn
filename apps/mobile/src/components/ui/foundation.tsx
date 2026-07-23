import {
  borders,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
  touchTargets,
} from '@hanziquest/design-tokens';
import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  clampProgress,
  interactiveSize,
  progressAnimationDuration,
  progressPercentage,
} from './component-rules';
import { useReducedMotion } from './use-reduced-motion';

type ScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function Screen({ children, scrollable = false, style, testID }: ScreenProps) {
  return (
    <SafeAreaView style={styles.screen} testID={testID}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, style]}
          contentInsetAdjustmentBehavior="automatic"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type PrimaryButtonProps = Pick<
  PressableProps,
  'accessibilityHint' | 'accessibilityLabel' | 'disabled' | 'onPress' | 'testID'
> & {
  label: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  loading = false,
  onPress,
  style,
  testID,
}: PrimaryButtonProps) {
  const unavailable = Boolean(disabled) || loading;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !unavailable && styles.primaryButtonPressed,
        unavailable && styles.disabledControl,
        style,
      ]}
      testID={testID}
    >
      {loading ? <ActivityIndicator color={colors.textOnPrimary} /> : null}
      <Text style={styles.primaryButtonLabel}>{loading ? '请稍候' : label}</Text>
    </Pressable>
  );
}

type IconButtonProps = Pick<PressableProps, 'disabled' | 'onPress' | 'testID'> & {
  accessibilityLabel: string;
  icon: ReactNode;
  size?: number;
};

export function IconButton({
  accessibilityLabel,
  disabled = false,
  icon,
  onPress,
  size = touchTargets.minimum,
  testID,
}: IconButtonProps) {
  const isDisabled = Boolean(disabled);
  const targetSize = interactiveSize(size);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={spacing.xs}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { height: targetSize, width: targetSize },
        pressed && !isDisabled && styles.secondaryPressed,
        isDisabled && styles.disabledControl,
      ]}
      testID={testID}
    >
      <View accessible={false}>{icon}</View>
    </Pressable>
  );
}

type HanziTextProps = TextProps & {
  emphasis?: 'normal' | 'target';
  size?: 'body' | 'display' | 'learning';
};

export function HanziText({
  children,
  emphasis = 'normal',
  size = 'learning',
  style,
  ...textProps
}: HanziTextProps) {
  const sizeStyle =
    size === 'body'
      ? styles.hanziBody
      : size === 'display'
        ? styles.hanziDisplay
        : styles.hanziLearning;

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[styles.hanzi, sizeStyle, emphasis === 'target' && styles.hanziTarget, style]}
      {...textProps}
    >
      {children}
    </Text>
  );
}

type AudioButtonProps = Pick<PressableProps, 'disabled' | 'onPress' | 'testID'> & {
  label?: string;
};

export function AudioButton({ disabled, label = '听一听', onPress, testID }: AudioButtonProps) {
  const isDisabled = Boolean(disabled);

  return (
    <Pressable
      accessibilityHint="播放对应内容的朗读，也可阅读屏幕上的文字"
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.audioButton,
        pressed && !isDisabled && styles.secondaryPressed,
        isDisabled && styles.disabledControl,
      ]}
      testID={testID}
    >
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.audioIcon}
      >
        ▶
      </Text>
      <Text style={styles.audioLabel}>{label}</Text>
    </Pressable>
  );
}

type ProgressBarProps = {
  label: string;
  reduceMotionOverride?: boolean;
  value: number;
};

export function ProgressBar({ label, reduceMotionOverride, value }: ProgressBarProps) {
  const systemReduceMotion = useReducedMotion();
  const reduceMotion = reduceMotionOverride ?? systemReduceMotion;
  const normalizedValue = clampProgress(value);
  const percentage = progressPercentage(value);
  const [animatedValue] = useState(() => new Animated.Value(normalizedValue));
  const duration = progressAnimationDuration(reduceMotion);

  useEffect(() => {
    if (duration === 0) {
      animatedValue.setValue(normalizedValue);
      return;
    }

    const animation = Animated.timing(animatedValue, {
      duration,
      toValue: normalizedValue,
      useNativeDriver: false,
    });
    animation.start();

    return () => animation.stop();
  }, [animatedValue, duration, normalizedValue]);

  const animatedWidth = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{ max: 100, min: 0, now: percentage, text: `${percentage}%` }}
      style={styles.progressGroup}
    >
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{percentage}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: animatedWidth }]} />
      </View>
    </View>
  );
}

type ParentGateTriggerProps = Pick<PressableProps, 'onPress' | 'testID'> & {
  label?: string;
};

export function ParentGateTrigger({ label = '家长设置', onPress, testID }: ParentGateTriggerProps) {
  return (
    <Pressable
      accessibilityHint="进入前需要由家长完成验证"
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.parentGate, pressed && styles.secondaryPressed]}
      testID={testID}
    >
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.parentGateIcon}
      >
        🔒
      </Text>
      <Text style={styles.parentGateLabel}>{label}</Text>
    </Pressable>
  );
}

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = '正在准备内容…' }: LoadingStateProps) {
  return (
    <View
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.stateCard}
    >
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.stateTitle}>{message}</Text>
    </View>
  );
}

type ErrorStateProps = {
  actionLabel?: string;
  message: string;
  onRetry?: () => void;
  title?: string;
};

export function ErrorState({
  actionLabel = '再试一次',
  message,
  onRetry,
  title = '暂时没有准备好',
}: ErrorStateProps) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.stateCard, styles.errorCard]}
    >
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.stateSymbol}
      >
        !
      </Text>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {onRetry ? <PrimaryButton label={actionLabel} onPress={onRetry} /> : null}
    </View>
  );
}

const hanziFontFamily = Platform.select({
  android: 'sans-serif',
  default: 'System',
  ios: 'PingFang SC',
  web: '"Noto Sans CJK SC", "Microsoft YaHei", sans-serif',
});

const styles = StyleSheet.create({
  audioButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
  },
  audioIcon: {
    color: colors.primary,
    fontSize: fontSizes.body,
  },
  audioLabel: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  disabledControl: {
    opacity: 0.55,
  },
  errorCard: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.danger,
    borderWidth: borders.thin,
  },
  hanzi: {
    color: colors.textPrimary,
    fontFamily: hanziFontFamily,
    textAlign: 'center',
  },
  hanziBody: {
    fontSize: fontSizes.bodyLarge,
    lineHeight: lineHeights.bodyLarge,
  },
  hanziDisplay: {
    fontSize: fontSizes.display,
    lineHeight: lineHeights.display,
  },
  hanziLearning: {
    fontSize: fontSizes.hanzi,
    lineHeight: lineHeights.hanzi,
  },
  hanziTarget: {
    fontWeight: fontWeights.bold,
    textDecorationLine: 'underline',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    justifyContent: 'center',
  },
  parentGate: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
  },
  parentGateIcon: {
    fontSize: fontSizes.body,
  },
  parentGateLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primaryButtonLabel: {
    color: colors.textOnPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.bodyLarge,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: '100%',
  },
  progressGroup: {
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    height: spacing.md,
    overflow: 'hidden',
  },
  progressValue: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontVariant: ['tabular-nums'],
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.xl,
  },
  stateMessage: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    textAlign: 'center',
  },
  stateSymbol: {
    color: colors.danger,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
  },
  stateTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.bodyLarge,
    textAlign: 'center',
  },
});
