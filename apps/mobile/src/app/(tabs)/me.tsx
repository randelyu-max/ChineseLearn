import { colors, fontSizes, spacing } from '@hanziquest/design-tokens';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';
import {
  humorPreferences,
  saveProfile,
  type HumorPreference,
  type Profile,
} from '@/features/profile';

const humorLabels: Readonly<Record<HumorPreference, string>> = {
  off: '关闭',
  light: '轻松',
  playful: '活泼',
};

function withHumorPreference(profile: Profile, humorPreference: HumorPreference) {
  return {
    chineseName: profile.chineseName,
    dailyGoalMinutes: profile.dailyGoalMinutes,
    displayName: profile.displayName,
    humorPreference,
    interfaceLocale: profile.interfaceLocale,
    pinyinSupportMode: profile.pinyinSupportMode,
    scriptPreference: profile.scriptPreference,
  };
}

export default function MeScreen() {
  const { acceptProfile, signOut, state } = useAuth();
  const router = useRouter();
  const profile = state.profile;
  const [humorPreference, setHumorPreference] = useState<HumorPreference>(
    () => profile?.humorPreference ?? 'off',
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const savePreference = async () => {
    if (!profile) return;
    setNotice(null);
    setSaving(true);
    const result = await saveProfile(withHumorPreference(profile, humorPreference));
    setSaving(false);
    if (result.ok) {
      acceptProfile(result.value);
      setNotice('文风偏好已保存。');
      return;
    }
    setHumorPreference(profile.humorPreference);
    setNotice(
      result.notice === 'network_unavailable'
        ? '目前处于离线状态。原有偏好仍然有效，请联网后重试保存。'
        : '暂时无法保存文风偏好，请稍后重试。',
    );
  };

  return (
    <Screen scrollable style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        我的
      </Text>
      <Text style={styles.body}>{profile?.displayName}</Text>
      {profile?.chineseName ? <Text style={styles.body}>中文名：{profile.chineseName}</Text> : null}
      <Text style={styles.body}>每日目标：{profile?.dailyGoalMinutes} 分钟</Text>

      <View style={styles.preferenceGroup}>
        <Text style={styles.sectionTitle}>文风偏好</Text>
        <Text style={styles.body}>
          “关闭”始终使用中性文案；其他选项只会选择已经人工审核并随应用提供的内容。
        </Text>
        <View accessibilityLabel="文风偏好" accessibilityRole="radiogroup" style={styles.choices}>
          {humorPreferences.map((value) => (
            <Pressable
              aria-checked={humorPreference === value}
              accessibilityRole="radio"
              accessibilityState={{ checked: humorPreference === value }}
              disabled={saving}
              key={value}
              onPress={() => {
                setNotice(null);
                setHumorPreference(value);
              }}
              style={[styles.choice, humorPreference === value && styles.choiceSelected]}
            >
              <Text style={styles.choiceText}>{humorLabels[value]}</Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton
          disabled={!profile || humorPreference === profile.humorPreference}
          label="保存文风偏好"
          loading={saving}
          onPress={() => void savePreference()}
        />
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
      </View>

      <PrimaryButton label="编辑个人设置" onPress={() => router.push('/onboarding' as Href)} />
      <PrimaryButton label="退出登录" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textSecondary, fontSize: fontSizes.body },
  choice: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    padding: spacing.md,
  },
  choiceSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  choiceText: { color: colors.textPrimary, fontSize: fontSizes.body },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  notice: { color: colors.textSecondary, fontSize: fontSizes.body },
  preferenceGroup: { gap: spacing.md },
  screen: { gap: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '600' },
  title: { color: colors.textPrimary, fontSize: 28 },
});
