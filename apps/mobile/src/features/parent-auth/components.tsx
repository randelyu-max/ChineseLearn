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
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { Screen } from '@/components/ui';

import { AUTH_NOTICE_MESSAGES, type AuthNoticeCode } from './model';

export function ParentAuthScreen({
  children,
  description,
  title,
}: PropsWithChildren<{ description: string; title: string }>) {
  return (
    <Screen scrollable style={styles.screen}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {children}
    </Screen>
  );
}

export function AuthField({ label, ...inputProps }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        placeholderTextColor={colors.disabled}
        style={styles.input}
        {...inputProps}
      />
    </View>
  );
}

export function AuthNotice({ notice }: { notice: AuthNoticeCode | null }) {
  if (!notice) return null;
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.notice}>
      <Text style={styles.noticeText}>{AUTH_NOTICE_MESSAGES[notice]}</Text>
    </View>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.success}>
      <Text style={styles.successText}>{message}</Text>
    </View>
  );
}

export function ValidationMessage({ message }: { message: string }) {
  return (
    <Text accessibilityLiveRegion="polite" style={styles.validationText}>
      {message}
    </Text>
  );
}

export function TextAction({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
    >
      <Text style={styles.textActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  description: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    textAlign: 'center',
  },
  field: {
    gap: spacing.sm,
  },
  heading: {
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borders.thin,
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  notice: {
    backgroundColor: colors.warningSurface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  noticeText: {
    color: colors.warning,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  pressed: {
    opacity: 0.65,
  },
  screen: {
    gap: spacing.xl,
    justifyContent: 'center',
  },
  success: {
    backgroundColor: colors.successSurface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  successText: {
    color: colors.success,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  textAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
  },
  textActionLabel: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
    textAlign: 'center',
  },
  validationText: {
    color: colors.danger,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
});
