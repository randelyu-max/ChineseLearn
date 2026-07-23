import { ErrorState, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { WritingPractice } from '@/features/writing-canvas';

export default function WritingScreen() {
  const { state } = useAuth();
  const chineseName = state.profile?.chineseName?.trim() ?? '';

  return (
    <Screen>
      {state.userId && chineseName ? (
        <WritingPractice
          chineseName={chineseName}
          key={`${state.userId}:${chineseName}`}
          ownerUserId={state.userId}
        />
      ) : (
        <ErrorState
          message="书写区只练习你自己的中文名字。请先在个人资料中添加中文名字。"
          title="先添加中文名字"
        />
      )}
    </Screen>
  );
}
