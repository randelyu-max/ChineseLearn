import { colors, fontSizes, fontWeights, spacing } from '@hanziquest/design-tokens';
import { Redirect, type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';

export default function SignInScreen() {
  const { signIn, signUp, state } = useAuth();
  const router = useRouter();
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(state.notice);

  if (state.status !== 'unauthenticated') return <Redirect href="/" />;

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    if (registering) {
      const result = await signUp(email, password);
      setBusy(false);
      if (!result.ok) setNotice(result.notice);
      else if (result.value.emailConfirmationRequired) {
        setNotice('注册成功。请打开邮箱确认后再登录。');
      }
      return;
    }
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) setNotice(result.notice);
  };

  return (
    <Screen style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {registering ? '创建账户' : '欢迎回来'}
      </Text>
      <Text style={styles.subtitle}>继续你的汉语学习</Text>
      <View style={styles.form}>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="邮箱"
          style={styles.input}
          value={email}
        />
        <TextInput
          autoComplete={registering ? 'new-password' : 'current-password'}
          onChangeText={setPassword}
          placeholder="密码（至少 8 位）"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <PrimaryButton
          disabled={!email.trim() || password.length < 8}
          label={registering ? '注册' : '登录'}
          loading={busy}
          onPress={submit}
        />
      </View>
      <Pressable onPress={() => setRegistering((current) => !current)}>
        <Text style={styles.link}>{registering ? '已有账户？登录' : '没有账户？注册'}</Text>
      </Pressable>
      {!registering ? (
        <Pressable onPress={() => router.push('/password-reset' as Href)}>
          <Text style={styles.link}>忘记密码</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  link: { color: colors.primary, fontSize: fontSizes.body, textAlign: 'center' },
  notice: { color: colors.textSecondary, fontSize: fontSizes.body, textAlign: 'center' },
  screen: { gap: spacing.lg, justifyContent: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: fontSizes.body, textAlign: 'center' },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
});
