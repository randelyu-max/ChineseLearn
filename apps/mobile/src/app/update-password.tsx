import { colors, fontSizes, spacing } from '@hanziquest/design-tokens';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';

export default function UpdatePasswordScreen() {
  const { signOut, state, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  if (state.status !== 'recovery') return <Redirect href="/" />;
  return (
    <Screen style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        设置新密码
      </Text>
      <TextInput
        autoComplete="new-password"
        onChangeText={setPassword}
        placeholder="新密码（至少 8 位）"
        secureTextEntry
        style={styles.input}
        value={password}
      />
      {notice ? <Text style={styles.body}>{notice}</Text> : null}
      <PrimaryButton
        disabled={password.length < 8}
        label="保存新密码"
        onPress={async () => {
          const result = await updatePassword(password);
          if (!result.ok) setNotice(result.notice);
          else await signOut();
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
