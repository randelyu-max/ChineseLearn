import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';

import { LoadingState, PrimaryButton } from '@/components/ui';
import {
  AuthNotice,
  AuthSuccess,
  ParentAuthScreen,
  TextAction,
} from '@/features/parent-auth/components';
import { useParentAuth } from '@/features/parent-auth';
import { ParentGateLoading, parentGateHref, useRequireParentGate } from '@/features/parent-gate';

export default function ParentAccountScreen() {
  const { signOut, state } = useParentAuth();
  const [submitting, setSubmitting] = useState(false);
  const gateAllowed = useRequireParentGate('parent_area');

  useEffect(() => {
    if (state.status === 'signed_out' && !state.notice) {
      router.replace('/parent-sign-in' as Href);
    }
  }, [state.notice, state.status]);

  if (!gateAllowed) return <ParentGateLoading />;

  if (state.status === 'restoring') {
    return (
      <ParentAuthScreen description="正在安全恢复家长登录状态。" title="家长账户">
        <LoadingState message="正在检查登录状态…" />
      </ParentAuthScreen>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    const result = await signOut();
    setSubmitting(false);
    if (result.ok) router.replace('/parent-sign-in' as Href);
  };

  return (
    <ParentAuthScreen description="家长账户状态与孩子的离线课程进度相互独立。" title="家长账户">
      <AuthNotice notice={state.notice} />
      {state.status === 'authenticated' || state.status === 'recovery' ? (
        <>
          <AuthSuccess message={`已登录${state.userEmail ? `：${state.userEmail}` : ''}`} />
          <PrimaryButton
            label="创建儿童档案"
            onPress={() => router.push('/parent-child-profile' as Href)}
          />
          <PrimaryButton
            label="订阅与购买（家长验证）"
            onPress={() => router.push(parentGateHref('purchase'))}
          />
          <PrimaryButton
            label="家长设置（家长验证）"
            onPress={() => router.push(parentGateHref('settings'))}
          />
          <PrimaryButton
            label="隐私操作（家长验证）"
            onPress={() => router.push(parentGateHref('privacy'))}
          />
          <PrimaryButton
            label="打开外部帮助（家长验证）"
            onPress={() => router.push(parentGateHref('external_link'))}
          />
          <PrimaryButton label="退出登录" loading={submitting} onPress={() => void submit()} />
        </>
      ) : (
        <PrimaryButton label="重新登录" onPress={() => router.replace('/parent-sign-in' as Href)} />
      )}
      <TextAction label="返回学习首页" onPress={() => router.replace('/')} />
    </ParentAuthScreen>
  );
}
