import {
  borders,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
  touchTargets,
} from '@hanziquest/design-tokens';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui';
import {
  CHILD_PROFILE_NOTICE_MESSAGES,
  ageBands,
  approvedInterests,
  applyOptionalConsentWithdrawal,
  childProfileLabels,
  createChildProfile,
  findManagedHousehold,
  spokenProfiles,
  targetDayOptions,
  targetMinuteOptions,
  validateChildProfileDraft,
  withdrawOptionalConsent,
  type AgeBand,
  type ApprovedInterest,
  type ChildProfileNotice,
  type CreatedChildProfile,
  type SpokenProfile,
} from '@/features/child-profile';
import {
  AuthField,
  AuthSuccess,
  ParentAuthScreen,
  TextAction,
  ValidationMessage,
} from '@/features/parent-auth/components';
import { useParentAuth } from '@/features/parent-auth';
import { ParentGateLoading, useRequireParentGate } from '@/features/parent-gate';
import { getSupabaseClient } from '@/lib/supabase/client';

function ChoiceChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress(): void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ConsentRow({
  description,
  label,
  onValueChange,
  value,
}: {
  description: string;
  label: string;
  onValueChange(value: boolean): void;
  value: boolean;
}) {
  return (
    <View style={styles.consentRow}>
      <View style={styles.consentCopy}>
        <Text style={styles.consentLabel}>{label}</Text>
        <Text style={styles.helpText}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        value={value}
      />
    </View>
  );
}

export default function ParentChildProfileScreen() {
  const { state: authState } = useParentAuth();
  const [nickname, setNickname] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('6-7');
  const [spokenProfile, setSpokenProfile] = useState<SpokenProfile>('understands_more');
  const [scriptTrack, setScriptTrack] = useState<'simplified' | 'traditional'>('simplified');
  const [interests, setInterests] = useState<ApprovedInterest[]>([]);
  const [targetMinutes, setTargetMinutes] = useState<(typeof targetMinuteOptions)[number]>(8);
  const [targetDays, setTargetDays] = useState<(typeof targetDayOptions)[number]>(4);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [childData, setChildData] = useState(false);
  const [aiPersonalization, setAiPersonalization] = useState(false);
  const [cloudSpeech, setCloudSpeech] = useState(false);
  const [notice, setNotice] = useState<ChildProfileNotice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedChildProfile | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const gateAllowed = useRequireParentGate('parent_area');

  if (!gateAllowed) return <ParentGateLoading />;

  const toggleInterest = (interest: ApprovedInterest) => {
    setInterests((current) => {
      if (current.includes(interest)) return current.filter((item) => item !== interest);
      return current.length >= 3 ? current : [...current, interest];
    });
  };

  const submit = async () => {
    if (authState.status !== 'authenticated' && authState.status !== 'recovery') {
      setNotice('not_authenticated');
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      setNotice('configuration_missing');
      return;
    }
    const draft = {
      ageBand,
      consent: {
        aiPersonalization,
        childData,
        cloudSpeech,
        privacy,
        terms,
      },
      interests,
      nickname,
      scriptTrack,
      spokenProfile,
      targetDaysPerWeek: targetDays,
      targetMinutes,
    } as const;
    if (validateChildProfileDraft(draft).length > 0) {
      setNotice('invalid_profile');
      return;
    }

    setSubmitting(true);
    setNotice(null);
    const household = await findManagedHousehold(client);
    if (!household.ok) {
      setSubmitting(false);
      setNotice(household.notice);
      return;
    }
    const result = await createChildProfile(client, household.value, draft);
    setSubmitting(false);
    if (!result.ok) {
      setNotice(result.notice);
      return;
    }
    setHouseholdId(household.value);
    setCreated(result.value);
  };

  const withdraw = async (type: 'ai_personalization' | 'cloud_speech') => {
    const client = getSupabaseClient();
    if (!client || !created || !householdId) {
      setNotice('configuration_missing');
      return;
    }
    setSubmitting(true);
    const result = await withdrawOptionalConsent(client, householdId, created.id, type);
    setSubmitting(false);
    if (!result.ok) {
      setNotice(result.notice);
      return;
    }
    const next = applyOptionalConsentWithdrawal(created, type);
    setCreated({ ...created, ...next });
  };

  if (created) {
    return (
      <ParentAuthScreen description="档案仅保存学习所需的最少信息。" title="儿童档案已创建">
        {notice ? <ValidationMessage message={CHILD_PROFILE_NOTICE_MESSAGES[notice]} /> : null}
        <AuthSuccess message={`已为“${created.nickname}”创建档案。`} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>可选功能状态</Text>
          <Text style={styles.helpText}>
            AI 个性化：{created.aiPersonalizationEnabled ? '已开启' : '已关闭'}
          </Text>
          <Text style={styles.helpText}>
            云端语音：{created.cloudSpeechEnabled ? '已开启' : '已关闭'}
          </Text>
        </View>
        {created.aiPersonalizationEnabled ? (
          <PrimaryButton
            label="撤回 AI 个性化同意"
            loading={submitting}
            onPress={() => void withdraw('ai_personalization')}
          />
        ) : null}
        {created.cloudSpeechEnabled ? (
          <PrimaryButton
            label="撤回云端语音同意"
            loading={submitting}
            onPress={() => void withdraw('cloud_speech')}
          />
        ) : null}
        <TextAction
          label="返回家长账户"
          onPress={() => router.replace('/parent-account' as Href)}
        />
      </ParentAuthScreen>
    );
  }

  return (
    <ParentAuthScreen
      description="不需要真实全名、精确生日、学校或儿童邮箱。昵称可以是化名。"
      title="创建儿童档案"
    >
      {notice ? <ValidationMessage message={CHILD_PROFILE_NOTICE_MESSAGES[notice]} /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本设置</Text>
        <AuthField
          autoCapitalize="words"
          label="昵称或化名"
          maxLength={40}
          onChangeText={setNickname}
          value={nickname}
        />
        <Text style={styles.fieldLabel}>年龄段</Text>
        <View style={styles.choiceGroup}>
          {ageBands.map((option) => (
            <ChoiceChip
              key={option}
              label={childProfileLabels.ageBands[option]}
              onPress={() => setAgeBand(option)}
              selected={ageBand === option}
            />
          ))}
        </View>
        <Text style={styles.fieldLabel}>家庭中文情况</Text>
        <View style={styles.choiceGroup}>
          {spokenProfiles.map((option) => (
            <ChoiceChip
              key={option}
              label={childProfileLabels.spokenProfiles[option]}
              onPress={() => setSpokenProfile(option)}
              selected={spokenProfile === option}
            />
          ))}
        </View>
        <Text style={styles.fieldLabel}>字形轨道</Text>
        <View style={styles.choiceGroup}>
          <ChoiceChip
            label="简体"
            onPress={() => setScriptTrack('simplified')}
            selected={scriptTrack === 'simplified'}
          />
          <ChoiceChip
            label="繁体"
            onPress={() => setScriptTrack('traditional')}
            selected={scriptTrack === 'traditional'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>兴趣（最多 3 项）</Text>
        <Text style={styles.helpText}>只用于课程排序与安全内容约束，不用于广告。</Text>
        <View style={styles.choiceGroup}>
          {approvedInterests.map((interest) => (
            <ChoiceChip
              key={interest}
              label={childProfileLabels.interests[interest]}
              onPress={() => toggleInterest(interest)}
              selected={interests.includes(interest)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>学习目标</Text>
        <Text style={styles.fieldLabel}>每日分钟数</Text>
        <View style={styles.choiceGroup}>
          {targetMinuteOptions.map((minutes) => (
            <ChoiceChip
              key={minutes}
              label={`${minutes} 分钟`}
              onPress={() => setTargetMinutes(minutes)}
              selected={targetMinutes === minutes}
            />
          ))}
        </View>
        <Text style={styles.fieldLabel}>每周天数</Text>
        <View style={styles.choiceGroup}>
          {targetDayOptions.map((days) => (
            <ChoiceChip
              key={days}
              label={`${days} 天`}
              onPress={() => setTargetDays(days)}
              selected={targetDays === days}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>必要同意</Text>
        <ConsentRow
          description="版本 terms-2026-01"
          label="我同意服务条款"
          onValueChange={setTerms}
          value={terms}
        />
        <ConsentRow
          description="版本 privacy-2026-01"
          label="我已阅读隐私政策"
          onValueChange={setPrivacy}
          value={privacy}
        />
        <ConsentRow
          description="版本 child-data-2026-01；仅处理提供学习功能所需的数据"
          label="我同意必要的儿童数据处理"
          onValueChange={setChildData}
          value={childData}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>可选且相互独立</Text>
        <ConsentRow
          description="只发送课程约束与兴趣枚举，不发送昵称；可随时撤回"
          label="AI 个性化内容"
          onValueChange={setAiPersonalization}
          value={aiPersonalization}
        />
        <ConsentRow
          description="云端语音处理保持独立关闭，除非家长明确开启；可随时撤回"
          label="云端语音处理"
          onValueChange={setCloudSpeech}
          value={cloudSpeech}
        />
      </View>

      {!terms || !privacy || !childData ? (
        <ValidationMessage message="完成三项必要同意后才能创建档案。" />
      ) : null}
      <PrimaryButton
        disabled={!nickname.trim() || !terms || !privacy || !childData}
        label="记录同意并创建档案"
        loading={submitting}
        onPress={() => void submit()}
      />
      <TextAction label="返回家长账户" onPress={() => router.replace('/parent-account' as Href)} />
    </ParentAuthScreen>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: borders.thin,
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
  },
  chipTextSelected: {
    color: colors.textOnPrimary,
    fontWeight: fontWeights.semibold,
  },
  choiceGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  consentCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  consentLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.body,
  },
  consentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: touchTargets.minimum,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  helpText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  pressed: {
    opacity: 0.7,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.bodyLarge,
  },
});
