import { borders, colors, radii, spacing } from '@hanziquest/design-tokens';
import { useRef, useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  appendStroke,
  appendStrokePoint,
  normalizeStrokePoint,
  replayStrokePrefixes,
  strokeToSvgPath,
  type Stroke,
} from './model';

type CanvasSize = Readonly<{ height: number; width: number }>;

type Props = Readonly<{
  disabled?: boolean;
  onChange(strokes: readonly Stroke[]): void;
  replayProgress?: number | null;
  strokes: readonly Stroke[];
}>;

function pointFromEvent(event: GestureResponderEvent, size: CanvasSize) {
  const { force, locationX, locationY, timestamp } = event.nativeEvent;
  return normalizeStrokePoint({
    height: size.height,
    pressure: force,
    timestamp,
    width: size.width,
    x: locationX,
    y: locationY,
  });
}

export function WritingCanvas({
  disabled = false,
  onChange,
  replayProgress = null,
  strokes,
}: Props) {
  const [size, setSize] = useState<CanvasSize>({ height: 1, width: 1 });
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const replayStrokes =
    replayProgress === null ? strokes : replayStrokePrefixes(strokes, replayProgress);
  const renderedStrokes = activeStroke ? [...replayStrokes, activeStroke] : replayStrokes;

  function onLayout(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;
    if (height > 0 && width > 0) setSize({ height, width });
  }

  function beginStroke(event: GestureResponderEvent) {
    if (disabled) return;
    const next = Object.freeze({ points: Object.freeze([pointFromEvent(event, size)]) });
    activeStrokeRef.current = next;
    setActiveStroke(next);
  }

  function continueStroke(event: GestureResponderEvent) {
    if (disabled || !activeStrokeRef.current) return;
    const next = appendStrokePoint(activeStrokeRef.current, pointFromEvent(event, size));
    if (next === activeStrokeRef.current) return;
    activeStrokeRef.current = next;
    setActiveStroke(next);
  }

  function finishStroke() {
    const completed = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setActiveStroke(null);
    if (completed) onChange(appendStroke(strokes, completed));
  }

  function cancelStroke() {
    activeStrokeRef.current = null;
    setActiveStroke(null);
  }

  return (
    <View
      accessibilityHint="在画布上用手指、触控笔或鼠标书写；下方按钮可以撤销、清空和重放。"
      accessibilityLabel={`中文名字书写画布，已完成 ${strokes.length} 笔`}
      accessibilityRole="image"
      onLayout={onLayout}
      onMoveShouldSetResponder={() => !disabled}
      onResponderGrant={beginStroke}
      onResponderMove={continueStroke}
      onResponderRelease={finishStroke}
      onResponderTerminate={cancelStroke}
      onStartShouldSetResponder={() => !disabled}
      style={[styles.canvas, disabled && styles.disabled]}
      testID="writing-vector-canvas"
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.horizontalGuide} />
        <View style={styles.verticalGuide} />
      </View>
      <Svg height="100%" pointerEvents="none" width="100%">
        {renderedStrokes.map((stroke, index) => {
          if (stroke.points.length === 1) {
            const point = stroke.points[0]!;
            return (
              <Circle
                cx={point.x * size.width}
                cy={point.y * size.height}
                fill={colors.textPrimary}
                key={`dot-${index}`}
                r={3}
              />
            );
          }
          return (
            <Path
              d={strokeToSvgPath(stroke, size.width, size.height)}
              fill="none"
              key={`stroke-${index}`}
              stroke={colors.textPrimary}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={6}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    maxHeight: 420,
    minHeight: 240,
    overflow: 'hidden',
    width: '100%',
  },
  disabled: {
    opacity: 0.72,
  },
  horizontalGuide: {
    backgroundColor: colors.surfaceMuted,
    height: borders.thin,
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
  },
  verticalGuide: {
    backgroundColor: colors.surfaceMuted,
    bottom: spacing.lg,
    left: '50%',
    position: 'absolute',
    top: spacing.lg,
    width: borders.thin,
  },
});
