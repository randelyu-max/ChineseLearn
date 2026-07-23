import { colors, fontSizes, spacing } from '@hanziquest/design-tokens';
import { Redirect, type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';
import {
  createProfileDraft,
  saveProfile,
  validateProfileDraft,
  type ProfileDraft,
} from '@/features/profile';

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { label: string; value: T }[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choices}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: option.value === value }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.choice, option.value === value && styles.choiceSelected]}
          >
            <Text style={styles.choiceText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const { acceptProfile, state } = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState<ProfileDraft>(() => state.profile ?? createProfileDraft());
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = state.status === 'ready';
  if (!editing && state.status !== 'onboarding_required') return <Redirect href="/" />;
  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return (
    <Screen scrollable style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {editing ? '个人设置' : '首次设置'}
      </Text>
      <Text style={styles.body}>这些设置只用于调整你的学习体验，以后可以在“我的”中修改。</Text>
      <TextInput
        onChangeText={(value) => update('displayName', value)}
        placeholder="显示名称"
        style={styles.input}
        value={draft.displayName ?? ''}
      />
      <TextInput
        onChangeText={(value) => update('chineseName', value || null)}
        placeholder="中文名（可选）"
        style={styles.input}
        value={draft.chineseName ?? ''}
      />
      <Choice
        label="界面语言"
        onChange={(value) => update('interfaceLocale', value)}
        options={[
          { label: '简体中文', value: 'zh-CN' },
          { label: '繁體中文', value: 'zh-TW' },
          { label: 'English', value: 'en-US' },
        ]}
        value={draft.interfaceLocale}
      />
      <Choice
        label="汉字偏好"
        onChange={(value) => update('scriptPreference', value)}
        options={[
          { label: '简体', value: 'simplified' },
          { label: '繁体', value: 'traditional' },
        ]}
        value={draft.scriptPreference}
      />
      <Choice
        label="拼音辅助"
        onChange={(value) => update('pinyinSupportMode', value)}
        options={[
          { label: '始终显示', value: 'always' },
          { label: '自适应', value: 'adaptive' },
          { label: '点击显示', value: 'tap_to_reveal' },
          { label: '隐藏', value: 'hidden' },
        ]}
        value={draft.pinyinSupportMode}
      />
      <Choice
        label="文案风格"
        onChange={(value) => update('humorPreference', value)}
        options={[
          { label: '简洁', value: 'off' },
          { label: '轻松', value: 'light' },
          { label: '活泼', value: 'playful' },
        ]}
        value={draft.humorPreference}
      />
      <Text style={styles.body}>
        “关闭”始终使用中性文案；其他选项只会选择已经人工审核并随应用提供的内容。
      </Text>
      <Choice
        label="每日目标"
        onChange={(value) => update('dailyGoalMinutes', Number(value))}
        options={[5, 10, 15, 20].map((value) => ({ label: `${value} 分钟`, value: String(value) }))}
        value={String(draft.dailyGoalMinutes)}
      />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <PrimaryButton
        label={editing ? '保存设置' : '保存并开始学习'}
        loading={saving}
        onPress={async () => {
          setNotice(null);
          if (validateProfileDraft(draft).length > 0) {
            setNotice('请填写显示名称并检查各项设置。');
            return;
          }
          if (!state.userId) {
            setNotice('账户服务暂时不可用。');
            return;
          }
          setSaving(true);
          const result = await saveProfile(draft);
          setSaving(false);
          if (result.ok) {
            acceptProfile(result.value);
            router.replace((editing ? '/(tabs)/me' : '/') as Href);
          } else {
            setNotice('暂时无法保存设置，请稍后重试。');
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textSecondary, fontSize: fontSizes.body },
  choice: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, padding: spacing.md },
  choiceSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  choiceText: { color: colors.textPrimary, fontSize: fontSizes.body },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  group: { gap: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  label: { color: colors.textPrimary, fontSize: fontSizes.body },
  notice: { color: colors.danger, fontSize: fontSizes.body },
  screen: { gap: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.textPrimary, fontSize: 28 },
});
