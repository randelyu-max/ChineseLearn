import type { Href } from 'expo-router';

export const PRODUCTION_LEARN_ROUTE = '/session' as Href;

export const DEVELOPMENT_ONLY_ROUTES = [
  'demo-course',
  'component-showcase',
  'audio-to-glyph-showcase',
  'glyph-to-image-showcase',
  'sentence-order-showcase',
  'word-build-showcase',
] as const;
