import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { PrimaryButton } from '@/components/ui';
import {
  AuthField,
  AuthNotice,
  AuthSuccess,
  ParentAuthScreen,
  TextAction,
  ValidationMessage,
} from '@/features/parent-auth/components';
import { useParentAuth } from '@/features/parent-auth';
import { ParentGateLoading, useRequireParentGate } from '@/features/parent-gate';

export default function ParentUpdatePasswordScreen() {
  const { clearNotice, state, updatePassword } = useParentAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const gateAllowed = useRequireParentGate('parent_area');
  const passwordsMatch = password === confirmation;
  const valid = password.length >= 8 && passwordsMatch;

  useEffect(() => {
    clearNotice();
  }, [clearNotice]);

  if (!gateAllowed) return <ParentGateLoading />;

  const submit = async () => {
    if (!valid) return;
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result.ok) setSaved(true);
  };

  return (
    <ParentAuthScreen description="请设置至少 8 个字符的新密码。" title="设置新密码">
      <AuthNotice notice={state.notice} />
      {saved ? (
        <>
          <AuthSuccess message="密码已更新，可以返回家长账户。" />
          <PrimaryButton
            label="进入家长账户"
            onPress={() => router.replace('/parent-account' as Href)}
          />
        </>
      ) : (
        <>
          <AuthField
            autoComplete="new-password"
            label="新密码"
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            value={password}
          />
          <AuthField
            autoComplete="new-password"
            label="再次输入新密码"
            onChangeText={setConfirmation}
            onSubmitEditing={() => void submit()}
            secureTextEntry
            textContentType="newPassword"
            value={confirmation}
          />
          {!passwordsMatch && confirmation ? (
            <ValidationMessage message="两次输入的密码不一致。" />
          ) : null}
          <PrimaryButton
            disabled={!valid}
            label="保存新密码"
            loading={submitting}
            onPress={() => void submit()}
          />
        </>
      )}
      <TextAction label="返回家长登录" onPress={() => router.replace('/parent-sign-in' as Href)} />
    </ParentAuthScreen>
  );
}
