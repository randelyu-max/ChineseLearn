import { normalizePinyinSyllable } from '@hanziquest/contracts';
import { PinyinContentPackageSchema, type PinyinContentPackage } from '@hanziquest/curriculum';

export const PINYIN_VALIDATION_ERROR_CODES = [
  'PINYIN_SCHEMA_INVALID',
  'PINYIN_DUPLICATE_ID',
  'PINYIN_DUPLICATE_VALUE',
  'PINYIN_MISSING_REFERENCE',
  'PINYIN_ILLEGAL_COMBINATION',
  'PINYIN_NORMALIZATION_MISMATCH',
  'PINYIN_TONE_TABLE_INCOMPLETE',
  'PINYIN_ASSET_NOT_AUDIO',
] as const;

export type PinyinValidationErrorCode = (typeof PINYIN_VALIDATION_ERROR_CODES)[number];

export type PinyinValidationIssue = {
  code: PinyinValidationErrorCode;
  message: string;
  objectId?: string;
  path: string;
  source: string;
};

export type PinyinValidationResult =
  | { valid: true; data: PinyinContentPackage; errors: [] }
  | { valid: false; errors: PinyinValidationIssue[] };

type AddIssue = (
  code: PinyinValidationErrorCode,
  message: string,
  path: string,
  objectId?: string,
) => void;

function checkDuplicateIds(content: PinyinContentPackage, addIssue: AddIssue): void {
  const seen = new Map<string, string>();
  const candidates = [
    ...content.initials.map((item, index) => ({
      id: item.id,
      path: `initials.${index}.id`,
    })),
    ...content.finals.map((item, index) => ({
      id: item.id,
      path: `finals.${index}.id`,
    })),
    ...content.syllables.map((item, index) => ({
      id: item.id,
      path: `syllables.${index}.id`,
    })),
    ...content.assets.map((item, index) => ({
      id: item.id,
      path: `assets.${index}.id`,
    })),
  ];

  candidates.forEach((candidate) => {
    const previousPath = seen.get(candidate.id);
    if (previousPath) {
      addIssue(
        'PINYIN_DUPLICATE_ID',
        `ID ${candidate.id} is already used at ${previousPath}.`,
        candidate.path,
        candidate.id,
      );
    } else {
      seen.set(candidate.id, candidate.path);
    }
  });
}

function checkUniqueValues(content: PinyinContentPackage, addIssue: AddIssue): void {
  const check = (
    items: ReadonlyArray<{ value: string; path: string; objectId?: string }>,
    label: string,
  ): void => {
    const seen = new Map<string, string>();
    items.forEach((item) => {
      const previousPath = seen.get(item.value);
      if (previousPath) {
        addIssue(
          'PINYIN_DUPLICATE_VALUE',
          `${label} ${item.value} is already declared at ${previousPath}.`,
          item.path,
          item.objectId,
        );
      } else {
        seen.set(item.value, item.path);
      }
    });
  };

  check(
    content.initials.map((item, index) => ({
      value: item.value,
      path: `initials.${index}.value`,
      objectId: item.id,
    })),
    'Initial',
  );
  check(
    content.finals.map((item, index) => ({
      value: item.value,
      path: `finals.${index}.value`,
      objectId: item.id,
    })),
    'Final',
  );
  check(
    content.syllables.map((item, index) => ({
      value: normalizePinyinSyllable(item.numbered)?.numbered ?? item.numbered,
      path: `syllables.${index}.numbered`,
      objectId: item.id,
    })),
    'Syllable',
  );
}

function checkToneTable(content: PinyinContentPackage, addIssue: AddIssue): void {
  const declared = new Set(content.tones.map((tone) => tone.tone));
  const expected = [1, 2, 3, 4, 5] as const;
  if (declared.size !== expected.length || expected.some((tone) => !declared.has(tone))) {
    addIssue(
      'PINYIN_TONE_TABLE_INCOMPLETE',
      'Tone content must declare tones 1, 2, 3, 4, and neutral tone 5 exactly once.',
      'tones',
    );
  }

  content.tones.forEach((tone, index) => {
    const normalized = normalizePinyinSyllable(tone.exampleSyllable);
    if (!normalized) {
      addIssue(
        'PINYIN_ILLEGAL_COMBINATION',
        `${tone.exampleSyllable} is not a legal Mandarin Pinyin syllable.`,
        `tones.${index}.exampleSyllable`,
      );
    } else if (normalized.tone !== tone.tone) {
      addIssue(
        'PINYIN_NORMALIZATION_MISMATCH',
        `Tone example normalizes to tone ${normalized.tone}, not ${tone.tone}.`,
        `tones.${index}.exampleSyllable`,
      );
    }
  });
}

function checkSyllables(content: PinyinContentPackage, addIssue: AddIssue): void {
  const initialById = new Map(content.initials.map((initial) => [initial.id, initial]));
  const finalById = new Map(content.finals.map((final) => [final.id, final]));
  const assetById = new Map(content.assets.map((asset) => [asset.id, asset]));

  content.syllables.forEach((syllable, index) => {
    const initial = initialById.get(syllable.initialId);
    const final = finalById.get(syllable.finalId);
    if (!initial) {
      addIssue(
        'PINYIN_MISSING_REFERENCE',
        `Missing initial reference ${syllable.initialId}.`,
        `syllables.${index}.initialId`,
        syllable.id,
      );
    }
    if (!final) {
      addIssue(
        'PINYIN_MISSING_REFERENCE',
        `Missing final reference ${syllable.finalId}.`,
        `syllables.${index}.finalId`,
        syllable.id,
      );
    }

    const normalized = normalizePinyinSyllable(syllable.numbered);
    if (!normalized) {
      addIssue(
        'PINYIN_ILLEGAL_COMBINATION',
        `${syllable.numbered} is not a legal Mandarin Pinyin syllable.`,
        `syllables.${index}.numbered`,
        syllable.id,
      );
    } else {
      if (normalized.numbered !== syllable.numbered) {
        addIssue(
          'PINYIN_NORMALIZATION_MISMATCH',
          `${syllable.numbered} must use canonical numbered form ${normalized.numbered}.`,
          `syllables.${index}.numbered`,
          syllable.id,
        );
      }
      if (initial && normalized.initial !== initial.value) {
        addIssue(
          'PINYIN_ILLEGAL_COMBINATION',
          `${syllable.numbered} uses initial ${normalized.initial}, not ${initial.value}.`,
          `syllables.${index}.initialId`,
          syllable.id,
        );
      }
      if (final && normalized.final !== final.value) {
        addIssue(
          'PINYIN_ILLEGAL_COMBINATION',
          `${syllable.numbered} uses final ${normalized.final}, not ${final.value}.`,
          `syllables.${index}.finalId`,
          syllable.id,
        );
      }
      if (normalized.tone !== syllable.tone) {
        addIssue(
          'PINYIN_NORMALIZATION_MISMATCH',
          `${syllable.numbered} normalizes to tone ${normalized.tone}, not ${syllable.tone}.`,
          `syllables.${index}.tone`,
          syllable.id,
        );
      }
      if (normalized.display !== syllable.display) {
        addIssue(
          'PINYIN_NORMALIZATION_MISMATCH',
          `${syllable.numbered} must display as ${normalized.display}.`,
          `syllables.${index}.display`,
          syllable.id,
        );
      }
    }

    if (syllable.audioAssetId) {
      const asset = assetById.get(syllable.audioAssetId);
      if (!asset) {
        addIssue(
          'PINYIN_MISSING_REFERENCE',
          `Missing audio asset reference ${syllable.audioAssetId}.`,
          `syllables.${index}.audioAssetId`,
          syllable.id,
        );
      } else if (asset.kind !== 'audio') {
        addIssue(
          'PINYIN_ASSET_NOT_AUDIO',
          `Asset ${asset.id} is not an audio asset.`,
          `syllables.${index}.audioAssetId`,
          syllable.id,
        );
      }
    }
  });
}

export function validatePinyinContent(
  input: unknown,
  options: { source?: string } = {},
): PinyinValidationResult {
  const source = options.source ?? '<memory>';
  const parsed = PinyinContentPackageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        code: 'PINYIN_SCHEMA_INVALID',
        message: issue.message,
        path: issue.path.map(String).join('.'),
        source,
      })),
    };
  }

  const errors: PinyinValidationIssue[] = [];
  const addIssue: AddIssue = (code, message, path, objectId) => {
    errors.push({
      code,
      message,
      ...(objectId === undefined ? {} : { objectId }),
      path,
      source,
    });
  };

  checkDuplicateIds(parsed.data, addIssue);
  checkUniqueValues(parsed.data, addIssue);
  checkToneTable(parsed.data, addIssue);
  checkSyllables(parsed.data, addIssue);

  return errors.length === 0
    ? { valid: true, data: parsed.data, errors: [] }
    : { valid: false, errors };
}

export function formatPinyinValidationIssue(issue: PinyinValidationIssue): string {
  const object = issue.objectId ? ` object=${issue.objectId}` : '';
  return `${issue.source}:${issue.path} [${issue.code}]${object} ${issue.message}`;
}
