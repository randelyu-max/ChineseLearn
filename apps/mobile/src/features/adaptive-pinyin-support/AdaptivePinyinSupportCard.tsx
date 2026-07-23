import {
  borders,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
} from '@hanziquest/design-tokens';
import type { PinyinSupportRuntimeState } from '@hanziquest/learning-engine';
import { StyleSheet, Text, View } from 'react-native';

import { HanziText, PrimaryButton } from '@/components/ui';

import { adaptivePinyinUiModel } from './model';

type Props = {
  onCompleteActivity: () => void;
  onReveal: () => void;
  state: PinyinSupportRuntimeState;
};

export function AdaptivePinyinSupportCard({ onCompleteActivity, onReveal, state }: Props) {
  const ui = adaptivePinyinUiModel(state);
  return (
    <View style={styles.container}>
      <View style={styles.promptGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          自适应拼音提示
        </Text>
        <Text style={styles.instructions}>
          提示会根据独立识字表现逐步淡出；需要时可以只为当前题重新显示。
        </Text>
      </View>
      <View
        accessibilityLabel={`马。${ui.showPinyin ? '拼音 mǎ' : ui.statusLabel}`}
        style={styles.learningCard}
      >
        {ui.showPinyin ? <Text style={styles.pinyin}>mǎ</Text> : null}
        <HanziText emphasis="target">马</HanziText>
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {ui.statusLabel}
        </Text>
      </View>
      {ui.allowUserReveal && !ui.showPinyin ? (
        <PrimaryButton label="本题显示拼音" onPress={onReveal} />
      ) : null}
      {state.activityOverride === 'revealed' ? (
        <PrimaryButton label="完成本题并恢复淡出" onPress={onCompleteActivity} />
      ) : null}
      <Text style={styles.learningNote}>学习记录会按当前提示状态自动调整。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  learningNote: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  instructions: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  learningCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    gap: spacing.xs,
    padding: spacing.xl,
  },
  pinyin: {
    color: colors.primary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.bodyLarge,
  },
  promptGroup: { gap: spacing.md },
  status: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
  },
});
