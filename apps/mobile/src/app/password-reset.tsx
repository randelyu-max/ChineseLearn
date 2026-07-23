import { colors, fontSizes, spacing } from '@hanziquest/design-tokens';
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';

export default function PasswordResetScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <Screen style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        重设密码
      </Text>
      <Text style={styles.body}>输入注册邮箱，我们会发送安全的重设链接。</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="邮箱"
        style={styles.input}
        value={email}
      />
      {notice ? <Text style={styles.body}>{notice}</Text> : null}
      <PrimaryButton
        disabled={!email.trim()}
        label="发送重设链接"
        onPress={async () => {
          const result = await requestPasswordReset(email);
          setNotice(result.ok ? '如果该邮箱已注册，重设链接将很快送达。' : result.notice);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textSecondary, fontSize: fontSizes.body },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  screen: { gap: spacing.lg, justifyContent: 'center' },
  title: { color: colors.textPrimary, fontSize: 28 },
});
