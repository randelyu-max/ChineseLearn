export const colors = {
  background: '#F7F6F2',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2F6',
  textPrimary: '#18212F',
  textSecondary: '#465262',
  textOnPrimary: '#FFFFFF',
  primary: '#1D4ED8',
  primaryPressed: '#173EA8',
  focus: '#7C3AED',
  border: '#C7D0DC',
  success: '#166534',
  successSurface: '#DCFCE7',
  warning: '#92400E',
  warningSurface: '#FEF3C7',
  danger: '#B42318',
  dangerSurface: '#FEE4E2',
  disabled: '#8A96A6',
  overlay: 'rgba(24, 33, 47, 0.48)',
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontFamilies = {
  body: 'System',
  hanzi: 'System',
} as const;

export const fontSizes = {
  caption: 13,
  body: 16,
  bodyLarge: 18,
  heading: 24,
  display: 36,
  hanzi: 48,
} as const;

export const lineHeights = {
  caption: 18,
  body: 24,
  bodyLarge: 28,
  heading: 32,
  display: 44,
  hanzi: 64,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const touchTargets = {
  minimum: 48,
  comfortable: 52,
} as const;

export const motion = {
  durations: {
    instant: 0,
    fast: 120,
    standard: 220,
    celebration: 450,
  },
  reducedDurations: {
    instant: 0,
    fast: 0,
    standard: 0,
    celebration: 0,
  },
} as const;

export const borders = {
  thin: 1,
  focus: 3,
} as const;

export const packageMetadata = {
  name: '@hanziquest/design-tokens',
  status: 'task-0.3-foundation',
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
