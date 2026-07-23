import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { PrimaryButton } from '@/components/ui';
import {
  AuthField,
  AuthNotice,
  AuthSuccess,
  ParentAuthScreen,
  TextAction,
} from '@/features/parent-auth/components';
import { useParentAuth } from '@/features/parent-auth';
import { ParentGateLoading, useRequireParentGate } from '@/features/parent-gate';

export default function ParentPasswordResetScreen() {
  const { clearNotice, requestPasswordReset, state } = useParentAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const gateAllowed = useRequireParentGate('parent_area');

  useEffect(() => {
    clearNotice();
  }, [clearNotice]);

  if (!gateAllowed) return <ParentGateLoading />;

  const submit = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    setSubmitting(false);
    if (result.ok) setSubmitted(true);
  };

  return (
    <ParentAuthScreen
      description="输入家长邮箱，我们会发送安全的密码重设链接。"
      title="重设家长密码"
    >
      <AuthNotice notice={state.notice} />
      {submitted ? (
        <AuthSuccess message="如果该邮箱已注册，密码重设邮件将很快送达。请检查收件箱和垃圾邮件。" />
      ) : (
        <>
          <AuthField
            autoComplete="email"
            inputMode="email"
            label="邮箱"
            onChangeText={setEmail}
            onSubmitEditing={() => void submit()}
            textContentType="emailAddress"
            value={email}
          />
          <PrimaryButton
            disabled={!email.trim()}
            label="发送重设邮件"
            loading={submitting}
            onPress={() => void submit()}
          />
        </>
      )}
      <TextAction label="返回家长登录" onPress={() => router.replace('/parent-sign-in' as Href)} />
    </ParentAuthScreen>
  );
}
