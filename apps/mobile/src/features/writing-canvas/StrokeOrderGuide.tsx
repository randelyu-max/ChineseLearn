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
import type { WritingStrokeAsset } from '@hanziquest/curriculum';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Polyline } from 'react-native-svg';

type Props = Readonly<{
  activeStrokeIndex: number;
  asset: WritingStrokeAsset;
  onAdvance(): void;
  onRestart(): void;
}>;

export function StrokeOrderGuide({ activeStrokeIndex, asset, onAdvance, onRestart }: Props) {
  const median = asset.medians[activeStrokeIndex] ?? [];
  const start = median[0];
  return (
    <View style={styles.container}>
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {asset.character} · 第 {activeStrokeIndex + 1} / {asset.strokes.length} 笔
      </Text>
      <View
        accessibilityLabel={`${asset.character} 的标准笔顺，第 ${activeStrokeIndex + 1} 笔。圆点是起笔位置，蓝线是书写方向。`}
        accessibilityRole="image"
        style={styles.guide}
      >
        <Svg height="100%" viewBox="0 0 1024 1024" width="100%">
          <G transform="scale(1,-1) translate(0,-900)">
            {asset.strokes.map((path, index) => (
              <Path
                d={path}
                fill={index === activeStrokeIndex ? colors.primary : colors.surfaceMuted}
                key={`${asset.character}-${index}`}
                opacity={index <= activeStrokeIndex ? 1 : 0.45}
              />
            ))}
            <Polyline
              fill="none"
              points={median.map(([x, y]) => `${x},${y}`).join(' ')}
              stroke={colors.primary}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={18}
            />
            {start ? <Circle cx={start[0]} cy={start[1]} fill={colors.warning} r={28} /> : null}
          </G>
        </Svg>
      </View>
      <View style={styles.controls}>
        <GuideButton disabled={activeStrokeIndex === 0} label="从第一笔" onPress={onRestart} />
        <GuideButton
          disabled={activeStrokeIndex >= asset.strokes.length - 1}
          label="下一笔"
          onPress={onAdvance}
        />
      </View>
    </View>
  );
}

function GuideButton({
  disabled,
  label,
  onPress,
}: Readonly<{ disabled: boolean; label: string; onPress(): void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: borders.thin,
    flex: 1,
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
  },
  buttonLabel: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.body,
  },
  container: { gap: spacing.sm },
  controls: { flexDirection: 'row', gap: spacing.sm },
  disabled: { opacity: 0.5 },
  guide: {
    alignSelf: 'center',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    maxWidth: 260,
    overflow: 'hidden',
    width: '100%',
  },
  status: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.body,
    textAlign: 'center',
  },
});
