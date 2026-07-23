import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { LoadingState, PrimaryButton } from '@/components/ui';
import {
  AuthField,
  AuthNotice,
  ParentAuthScreen,
  TextAction,
} from '@/features/parent-auth/components';
import { useParentAuth } from '@/features/parent-auth';
import { ParentGateLoading, useRequireParentGate } from '@/features/parent-gate';

export default function ParentSignInScreen() {
  const { clearNotice, signIn, state } = useParentAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const gateAllowed = useRequireParentGate('parent_area');

  useEffect(() => {
    clearNotice();
  }, [clearNotice]);

  useEffect(() => {
    if (state.status === 'authenticated') router.replace('/parent-account' as Href);
  }, [state.status]);

  if (!gateAllowed) return <ParentGateLoading />;

  if (state.status === 'restoring') {
    return (
      <ParentAuthScreen description="正在安全恢复家长登录状态。" title="家长登录">
        <LoadingState message="正在检查登录状态…" />
      </ParentAuthScreen>
    );
  }

  const submit = async () => {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.ok) router.replace('/parent-account' as Href);
  };

  return (
    <ParentAuthScreen
      description="此区域只供家长使用。孩子无需登录即可继续已下载的课程。"
      title="家长登录"
    >
      <AuthNotice notice={state.notice} />
      <AuthField
        autoComplete="email"
        inputMode="email"
        label="邮箱"
        onChangeText={setEmail}
        placeholder="parent@example.com"
        textContentType="emailAddress"
        value={email}
      />
      <AuthField
        autoComplete="current-password"
        label="密码"
        onChangeText={setPassword}
        onSubmitEditing={() => void submit()}
        secureTextEntry
        textContentType="password"
        value={password}
      />
      <PrimaryButton
        disabled={!email.trim() || !password}
        label="登录"
        loading={submitting}
        onPress={() => void submit()}
      />
      <TextAction label="忘记密码" onPress={() => router.push('/parent-password-reset' as Href)} />
      <TextAction label="返回学习首页" onPress={() => router.replace('/')} />
    </ParentAuthScreen>
  );
}
