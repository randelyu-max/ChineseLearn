import { motion, touchTargets } from '@hanziquest/design-tokens';

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function progressPercentage(value: number): number {
  return Math.round(clampProgress(value) * 100);
}

export function progressAnimationDuration(reduceMotion: boolean): number {
  return reduceMotion ? motion.reducedDurations.standard : motion.durations.standard;
}

export function interactiveSize(requestedSize: number = touchTargets.minimum): number {
  return Math.max(touchTargets.minimum, requestedSize);
}
