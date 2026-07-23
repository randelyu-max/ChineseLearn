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
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { PrimaryButton } from '@/components/ui';

import {
  assembledPinyin,
  canSelectFinal,
  pinyinSyllableBuildLayout,
  type PinyinSyllableBuildExerciseDefinition,
  type PinyinSyllableBuildState,
} from './model';

const TONE_LABELS = { 1: '一声', 2: '二声', 3: '三声', 4: '四声', 5: '轻声' } as const;

type Props = {
  exercise: PinyinSyllableBuildExerciseDefinition;
  onReset: () => void;
  onSelectFinal: (final: PinyinSyllableBuildExerciseDefinition['finalOptions'][number]) => void;
  onSelectInitial: (
    initial: PinyinSyllableBuildExerciseDefinition['initialOptions'][number],
  ) => void;
  onSelectTone: (tone: PinyinSyllableBuildExerciseDefinition['toneOptions'][number]) => void;
  onSubmit: () => void;
  state: PinyinSyllableBuildState;
};

export function PinyinSyllableBuildExercise({
  exercise,
  onReset,
  onSelectFinal,
  onSelectInitial,
  onSelectTone,
  onSubmit,
  state,
}: Props) {
  const compact = pinyinSyllableBuildLayout(useWindowDimensions().width).compact;
  const assembled = assembledPinyin(state);
  const completed = state.status === 'correct-feedback';

  return (
    <View style={styles.container}>
      <View style={styles.promptGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          按顺序拼出拼音音节
        </Text>
        <Text style={styles.instructions}>依次点按声母、韵母和声调。不需要拖动或输入文字。</Text>
        <View accessibilityLiveRegion="polite" style={styles.preview}>
          <Text style={styles.previewLabel}>当前结果</Text>
          <Text accessibilityLabel={assembled?.display ?? '尚未完成'} style={styles.previewText}>
            {assembled?.display ?? '—'}
          </Text>
        </View>
      </View>

      <ChoiceGroup
        compact={compact}
        label="第一步：选择声母"
        options={exercise.initialOptions.map((initial) => ({
          disabled: state.selectedInitial !== null || state.status !== 'building',
          id: initial,
          label: initial === 'none' ? '零声母' : initial,
          selected: state.selectedInitial === initial,
        }))}
        onSelect={(value) =>
          onSelectInitial(value as PinyinSyllableBuildExerciseDefinition['initialOptions'][number])
        }
      />
      <ChoiceGroup
        compact={compact}
        label="第二步：选择韵母"
        options={exercise.finalOptions.map((final) => ({
          disabled: !canSelectFinal(state, final),
          id: final,
          label: final,
          selected: state.selectedFinal === final,
        }))}
        onSelect={(value) =>
          onSelectFinal(value as PinyinSyllableBuildExerciseDefinition['finalOptions'][number])
        }
      />
      <ChoiceGroup
        compact={compact}
        label="第三步：选择声调"
        options={exercise.toneOptions.map((tone) => ({
          disabled:
            state.status !== 'building' ||
            state.selectedFinal === null ||
            state.selectedTone !== null,
          id: String(tone),
          label: TONE_LABELS[tone],
          selected: state.selectedTone === tone,
        }))}
        onSelect={(value) =>
          onSelectTone(
            Number(value) as PinyinSyllableBuildExerciseDefinition['toneOptions'][number],
          )
        }
      />

      {state.status === 'ready' ? <PrimaryButton label="检查拼音" onPress={onSubmit} /> : null}
      {state.status === 'building' &&
      (state.selectedInitial !== null || state.selectedFinal !== null) ? (
        <Pressable accessibilityRole="button" onPress={onReset} style={styles.resetButton}>
          <Text style={styles.resetText}>重新开始</Text>
        </Pressable>
      ) : null}

      {state.status === 'incorrect-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>组合合法，再调整一下</Text>
          <Text style={styles.feedbackText}>
            这个音节还不是目标组合。按顺序重新选择，再试一次。
          </Text>
          <PrimaryButton label="重新拼装" onPress={onReset} />
        </View>
      ) : null}
      {completed ? (
        <View accessibilityLiveRegion="assertive" style={[styles.feedbackCard, styles.correctCard]}>
          <Text style={styles.feedbackTitle}>✓ 拼音组合完成</Text>
          <Text style={styles.feedbackText}>
            声母、韵母和声调组成了 {exercise.target.display}。
          </Text>
        </View>
      ) : null}
    </View>
  );
}

type ChoiceGroupProps = {
  compact: boolean;
  label: string;
  onSelect: (value: string) => void;
  options: readonly {
    disabled: boolean;
    id: string;
    label: string;
    selected: boolean;
  }[];
};

function ChoiceGroup({ compact, label, onSelect, options }: ChoiceGroupProps) {
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable
            accessibilityLabel={`${label}，${option.label}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: option.selected, disabled: option.disabled }}
            disabled={option.disabled}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => [
              styles.choice,
              compact && styles.choiceCompact,
              option.selected && styles.choiceSelected,
              option.disabled && !option.selected && styles.choiceDisabled,
              pressed && styles.choicePressed,
            ]}
          >
            <Text style={styles.choiceText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  choice: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borders.thin,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: spacing.md,
  },
  choiceCompact: { minWidth: touchTargets.minimum },
  choiceDisabled: { opacity: 0.4 },
  choicePressed: { backgroundColor: colors.surfaceMuted },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choiceSelected: { borderColor: colors.primary, borderWidth: borders.focus },
  choiceText: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.bodyLarge,
  },
  container: { gap: spacing.xl },
  correctCard: { backgroundColor: colors.successSurface, borderColor: colors.success },
  feedbackCard: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warning,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    gap: spacing.md,
    padding: spacing.lg,
  },
  feedbackText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.bodyLarge,
  },
  group: { gap: spacing.sm },
  groupLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.body,
  },
  instructions: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  preview: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  previewLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  previewText: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display,
  },
  promptGroup: { gap: spacing.md },
  resetButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
  },
  resetText: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
  },
});
