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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { strokeToSvgPath, type Stroke } from './model';
import {
  signatureStyles,
  transformOwnNameSignature,
  type SignatureStyle,
} from './signature-transform';

const labels: Record<SignatureStyle, string> = {
  clear: '清晰',
  compact: '紧凑',
  forward_leaning: '前倾',
  flowing: '流畅',
};

export function SignatureStylePicker({
  chineseName,
  onSelect,
  selectedStyle,
  strokes,
}: Readonly<{
  chineseName: string;
  onSelect(style: SignatureStyle): void;
  selectedStyle: SignatureStyle;
  strokes: readonly Stroke[];
}>) {
  const preview = transformOwnNameSignature({
    chineseName,
    scope: 'own_chinese_name',
    strokes,
    style: selectedStyle,
  });
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        选择自己的名字风格
      </Text>
      <View
        accessibilityLabel={`${labels[selectedStyle]}风格预览，仅用于自己的中文名字练习`}
        accessibilityRole="image"
        style={styles.preview}
      >
        <Svg height="100%" viewBox="0 0 100 100" width="100%">
          {preview.strokes.map((stroke, index) => (
            <Path
              d={strokeToSvgPath(stroke, 100, 100)}
              fill="none"
              key={`preview-${index}`}
              stroke={colors.textPrimary}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          ))}
        </Svg>
      </View>
      <View style={styles.choices}>
        {signatureStyles.map((style) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: style === selectedStyle }}
            key={style}
            onPress={() => onSelect(style)}
            style={[styles.choice, style === selectedStyle && styles.selected]}
          >
            <Text style={styles.choiceLabel}>{labels[style]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.notice}>这不是身份认证或签名真伪验证，也不会模仿任何真实人物。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  choice: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borders.thin,
    flex: 1,
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
  },
  choiceLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.body,
  },
  choices: { flexDirection: 'row', gap: spacing.xs },
  container: { gap: spacing.sm },
  notice: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
    textAlign: 'center',
  },
  preview: {
    alignSelf: 'center',
    aspectRatio: 2,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: borders.thin,
    maxWidth: 420,
    width: '100%',
  },
  selected: { borderColor: colors.primary, borderWidth: borders.focus },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.bodyLarge,
    textAlign: 'center',
  },
});
