import { z } from 'zod';

export const PINYIN_NORMALIZATION_VERSION = 'pinyin-normalization-v1' as const;

export const PINYIN_INITIALS = [
  'none',
  'b',
  'p',
  'm',
  'f',
  'd',
  't',
  'n',
  'l',
  'g',
  'k',
  'h',
  'j',
  'q',
  'x',
  'zh',
  'ch',
  'sh',
  'r',
  'z',
  'c',
  's',
] as const;

export const PINYIN_FINALS = [
  'a',
  'o',
  'e',
  'ai',
  'ei',
  'ao',
  'ou',
  'an',
  'en',
  'ang',
  'eng',
  'ong',
  'i',
  'ia',
  'ie',
  'iao',
  'iou',
  'ian',
  'in',
  'iang',
  'ing',
  'iong',
  'u',
  'ua',
  'uo',
  'uai',
  'uei',
  'uan',
  'uen',
  'uang',
  'ueng',
  'ü',
  'üe',
  'üan',
  'ün',
  'er',
] as const;

export const PinyinInitialSchema = z.enum(PINYIN_INITIALS);
export const PinyinFinalSchema = z.enum(PINYIN_FINALS);
export const PinyinToneSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export type PinyinInitial = z.infer<typeof PinyinInitialSchema>;
export type PinyinFinal = z.infer<typeof PinyinFinalSchema>;
export type PinyinTone = z.infer<typeof PinyinToneSchema>;

const LEGAL_FINALS_BY_INITIAL: Readonly<Record<PinyinInitial, readonly PinyinFinal[]>> = {
  none: [
    'a',
    'o',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'er',
    'i',
    'ia',
    'ie',
    'iao',
    'iou',
    'ian',
    'in',
    'iang',
    'ing',
    'iong',
    'u',
    'ua',
    'uo',
    'uai',
    'uei',
    'uan',
    'uen',
    'uang',
    'ueng',
    'ü',
    'üe',
    'üan',
    'ün',
  ],
  b: [
    'a',
    'o',
    'ai',
    'ei',
    'ao',
    'an',
    'en',
    'ang',
    'eng',
    'i',
    'ie',
    'iao',
    'ian',
    'in',
    'ing',
    'u',
  ],
  p: [
    'a',
    'o',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'i',
    'ie',
    'iao',
    'ian',
    'in',
    'ing',
    'u',
  ],
  m: [
    'a',
    'o',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'i',
    'ie',
    'iao',
    'iou',
    'ian',
    'in',
    'ing',
    'u',
  ],
  f: ['a', 'o', 'ei', 'ou', 'an', 'en', 'ang', 'eng', 'u'],
  d: [
    'a',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'ong',
    'i',
    'ie',
    'iao',
    'iou',
    'ian',
    'ing',
    'u',
    'uo',
    'uei',
    'uan',
    'uen',
  ],
  t: [
    'a',
    'e',
    'ai',
    'ao',
    'ou',
    'an',
    'ang',
    'eng',
    'ong',
    'i',
    'ie',
    'iao',
    'ian',
    'ing',
    'u',
    'uo',
    'uei',
    'uan',
    'uen',
  ],
  n: [
    'a',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'ong',
    'i',
    'ie',
    'iao',
    'iou',
    'ian',
    'in',
    'iang',
    'ing',
    'u',
    'uo',
    'uan',
    'ü',
    'üe',
  ],
  l: [
    'a',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'ang',
    'eng',
    'ong',
    'i',
    'ia',
    'ie',
    'iao',
    'iou',
    'ian',
    'in',
    'iang',
    'ing',
    'u',
    'uo',
    'uan',
    'uen',
    'ü',
    'üe',
  ],
  g: [
    'a',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'ong',
    'u',
    'ua',
    'uo',
    'uai',
    'uei',
    'uan',
    'uen',
    'uang',
  ],
  k: [
    'a',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'ong',
    'u',
    'ua',
    'uo',
    'uai',
    'uei',
    'uan',
    'uen',
    'uang',
  ],
  h: [
    'a',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'ong',
    'u',
    'ua',
    'uo',
    'uai',
    'uei',
    'uan',
    'uen',
    'uang',
  ],
  j: ['i', 'ia', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'iong', 'ü', 'üe', 'üan', 'ün'],
  q: ['i', 'ia', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'iong', 'ü', 'üe', 'üan', 'ün'],
  x: ['i', 'ia', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'iong', 'ü', 'üe', 'üan', 'ün'],
  zh: [
    'a',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'ong',
    'i',
    'u',
    'ua',
    'uo',
    'uai',
    'uei',
    'uan',
    'uen',
    'uang',
  ],
  ch: [
    'a',
    'e',
    'ai',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'ong',
    'i',
    'u',
    'ua',
    'uo',
    'uai',
    'uei',
    'uan',
    'uen',
    'uang',
  ],
  sh: [
    'a',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'i',
    'u',
    'ua',
    'uo',
    'uai',
    'uei',
    'uan',
    'uen',
    'uang',
  ],
  r: ['e', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'i', 'u', 'ua', 'uo', 'uei', 'uan', 'uen'],
  z: [
    'a',
    'e',
    'ai',
    'ei',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'ong',
    'i',
    'u',
    'uo',
    'uei',
    'uan',
    'uen',
  ],
  c: [
    'a',
    'e',
    'ai',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'ong',
    'i',
    'u',
    'uo',
    'uei',
    'uan',
    'uen',
  ],
  s: [
    'a',
    'e',
    'ai',
    'ao',
    'ou',
    'an',
    'en',
    'ang',
    'eng',
    'ong',
    'i',
    'u',
    'uo',
    'uei',
    'uan',
    'uen',
  ],
};

const ZERO_INITIAL_SPELLINGS: Readonly<Partial<Record<PinyinFinal, string>>> = {
  i: 'yi',
  ia: 'ya',
  ie: 'ye',
  iao: 'yao',
  iou: 'you',
  ian: 'yan',
  in: 'yin',
  iang: 'yang',
  ing: 'ying',
  iong: 'yong',
  u: 'wu',
  ua: 'wa',
  uo: 'wo',
  uai: 'wai',
  uei: 'wei',
  uan: 'wan',
  uen: 'wen',
  uang: 'wang',
  ueng: 'weng',
  ü: 'yu',
  üe: 'yue',
  üan: 'yuan',
  ün: 'yun',
};

const TONE_MARKS: Readonly<Record<string, readonly [string, PinyinTone]>> = {
  ā: ['a', 1],
  á: ['a', 2],
  ǎ: ['a', 3],
  à: ['a', 4],
  ē: ['e', 1],
  é: ['e', 2],
  ě: ['e', 3],
  è: ['e', 4],
  ī: ['i', 1],
  í: ['i', 2],
  ǐ: ['i', 3],
  ì: ['i', 4],
  ō: ['o', 1],
  ó: ['o', 2],
  ǒ: ['o', 3],
  ò: ['o', 4],
  ū: ['u', 1],
  ú: ['u', 2],
  ǔ: ['u', 3],
  ù: ['u', 4],
  ǖ: ['ü', 1],
  ǘ: ['ü', 2],
  ǚ: ['ü', 3],
  ǜ: ['ü', 4],
};

const MARKED_VOWELS: Readonly<Record<string, readonly [string, string, string, string]>> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

function spellPinyinBase(initial: PinyinInitial, final: PinyinFinal): string {
  if (initial === 'none') {
    return ZERO_INITIAL_SPELLINGS[final] ?? final;
  }

  if (['j', 'q', 'x'].includes(initial) && final.startsWith('ü')) {
    return `${initial}${final.replace('ü', 'u')}`;
  }

  const writtenFinal =
    final === 'iou' ? 'iu' : final === 'uei' ? 'ui' : final === 'uen' ? 'un' : final;
  return `${initial}${writtenFinal}`;
}

const ANALYSIS_BY_BASE = new Map<string, { initial: PinyinInitial; final: PinyinFinal }>();
for (const initial of PINYIN_INITIALS) {
  for (const final of LEGAL_FINALS_BY_INITIAL[initial]) {
    const base = spellPinyinBase(initial, final);
    const existing = ANALYSIS_BY_BASE.get(base);
    if (existing) {
      throw new Error(
        `Duplicate Pinyin analysis for ${base}: ${existing.initial}/${existing.final} and ${initial}/${final}.`,
      );
    }
    ANALYSIS_BY_BASE.set(base, { initial, final });
  }
}

function toneMarkIndex(base: string): number {
  const a = base.indexOf('a');
  if (a >= 0) return a;
  const e = base.indexOf('e');
  if (e >= 0) return e;
  const ou = base.indexOf('ou');
  if (ou >= 0) return ou;

  for (let index = base.length - 1; index >= 0; index -= 1) {
    if ('iouü'.includes(base[index]!)) return index;
  }
  return -1;
}

function applyToneMark(base: string, tone: PinyinTone): string {
  if (tone === 5) return base;
  const index = toneMarkIndex(base);
  if (index < 0) return base;
  const vowel = base[index]!;
  const marked = MARKED_VOWELS[vowel]?.[tone - 1];
  return marked ? `${base.slice(0, index)}${marked}${base.slice(index + 1)}` : base;
}

function normalizeInternal(input: string) {
  let value = input
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replaceAll('u:', 'ü')
    .replaceAll('v', 'ü');
  const digitMatch = value.match(/([0-5])$/);
  const digitTone = digitMatch
    ? ((digitMatch[1] === '0' || digitMatch[1] === '5' ? 5 : Number(digitMatch[1])) as PinyinTone)
    : undefined;
  if (digitMatch) value = value.slice(0, -1);

  let markedTone: PinyinTone | undefined;
  let base = '';
  for (const character of value) {
    const toneMark = TONE_MARKS[character];
    if (!toneMark) {
      base += character;
      continue;
    }
    if (markedTone !== undefined && markedTone !== toneMark[1]) return null;
    markedTone = toneMark[1];
    base += toneMark[0];
  }

  if (digitTone !== undefined && markedTone !== undefined && digitTone !== markedTone) return null;
  if (!/^[a-zü]+$/.test(base)) return null;

  const analysis = ANALYSIS_BY_BASE.get(base);
  if (!analysis) return null;
  const tone = digitTone ?? markedTone ?? 5;
  return {
    base,
    display: applyToneMark(base, tone),
    numbered: `${base}${tone}`,
    tone,
    initial: analysis.initial,
    final: analysis.final,
    normalizationVersion: PINYIN_NORMALIZATION_VERSION,
  };
}

export const NormalizedPinyinSyllableSchema = z
  .object({
    base: z.string().min(1).max(8),
    display: z.string().min(1).max(8),
    numbered: z.string().min(2).max(9),
    tone: PinyinToneSchema,
    initial: PinyinInitialSchema,
    final: PinyinFinalSchema,
    normalizationVersion: z.literal(PINYIN_NORMALIZATION_VERSION),
  })
  .strict();

export type NormalizedPinyinSyllable = z.infer<typeof NormalizedPinyinSyllableSchema>;

export const PinyinSyllableInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(12)
  .refine(
    (value) => normalizeInternal(value) !== null,
    'Expected one legal Mandarin Pinyin syllable.',
  );

export function normalizePinyinSyllable(input: string): NormalizedPinyinSyllable | null {
  const normalized = normalizeInternal(input);
  return normalized ? NormalizedPinyinSyllableSchema.parse(normalized) : null;
}

export function isLegalPinyinCombination(initial: PinyinInitial, final: PinyinFinal): boolean {
  return LEGAL_FINALS_BY_INITIAL[initial].includes(final);
}

export function canonicalPinyinBase(initial: PinyinInitial, final: PinyinFinal): string | null {
  return isLegalPinyinCombination(initial, final) ? spellPinyinBase(initial, final) : null;
}

export const LEGAL_PINYIN_BASE_SYLLABLES = Object.freeze([...ANALYSIS_BY_BASE.keys()].sort());
