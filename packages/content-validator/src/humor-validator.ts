import {
  HumorContentPackageSchema,
  type HumorContentItem,
  type HumorContentPackage,
  type ScriptText,
} from '@hanziquest/curriculum';

export const HUMOR_VALIDATION_ERROR_CODES = [
  'HUMOR_SCHEMA_INVALID',
  'HUMOR_DUPLICATE_ID',
  'HUMOR_TARGET_MISMATCH',
  'HUMOR_ANSWER_MISMATCH',
  'HUMOR_TARGET_NOT_PRESENT',
  'HUMOR_NEUTRAL_FALLBACK_INVALID',
  'HUMOR_UNSAFE_LANGUAGE',
  'HUMOR_EDITORIAL_REVIEW_REQUIRED',
  'HUMOR_MEMORY_SCENE_DISCLOSURE_REQUIRED',
  'HUMOR_ETYMOLOGY_CLAIM_NOT_ALLOWED',
] as const;

export type HumorValidationErrorCode = (typeof HUMOR_VALIDATION_ERROR_CODES)[number];

export type HumorValidationIssue = {
  code: HumorValidationErrorCode;
  message: string;
  objectId?: string;
  path: string;
  source: string;
};

export type HumorValidationResult =
  | { valid: true; data: HumorContentPackage; errors: [] }
  | { valid: false; errors: HumorValidationIssue[] };

type AddIssue = (
  code: HumorValidationErrorCode,
  message: string,
  path: string,
  objectId?: string,
) => void;

const SCRIPT_KEYS = ['simplified', 'traditional'] as const;
const UNSAFE_LANGUAGE_PATTERNS: ReadonlyArray<Readonly<{ label: string; pattern: RegExp }>> = [
  {
    label: 'humiliation',
    pattern: /笨|蠢|白痴|废物|廢物|失败者|失敗者|\bstupid\b|\bdumb\b|\bidiot\b|\bloser\b/iu,
  },
  {
    label: 'error mockery',
    pattern:
      /连.{0,12}都不会|連.{0,12}都不會|这么简单.{0,12}错|這麼簡單.{0,12}錯|又答错|又答錯|哈哈.{0,12}(错|錯)|\bcan't even\b|\bwrong again\b|\beasy.{0,12}wrong\b/iu,
  },
  {
    label: 'identity stereotype',
    pattern:
      /(?:中国人|中國人|华人|華人|亚洲人|亞洲人|男人|女人|男生|女生|老人|年轻人|年輕人).{0,12}(?:都|总是|總是|天生|就是|一定)|\b(?:Chinese|Asian|men|women|boys|girls|old people|young people)\b.{0,20}\b(?:always|naturally|are all)\b/iu,
  },
];
const NON_NEUTRAL_FALLBACK_PATTERN = /哈哈|笑死|😂|🤣|\blol\b|\bjoke\b|\bjust kidding\b/iu;
const MNEMONIC_DISCLOSURE_PATTERN = /记忆联想|記憶聯想|memory association/iu;
const NOT_ETYMOLOGY_PATTERN = /不是字源|並非字源|并非字源|not etymology|not an etymology/iu;

function equalScriptText(left: ScriptText, right: ScriptText): boolean {
  return SCRIPT_KEYS.every((script) => left[script] === right[script]);
}

function allItemText(item: HumorContentItem): string {
  const fields = [
    item.humorousVariant.prompt,
    item.humorousVariant.correctAnswer,
    item.neutralFallback.prompt,
    item.neutralFallback.correctAnswer,
    item.knowledgeClaim.disclosure,
  ].filter((field): field is ScriptText => field !== undefined);
  return fields.flatMap((field) => SCRIPT_KEYS.map((script) => field[script])).join('\n');
}

function checkDuplicateIds(content: HumorContentPackage, addIssue: AddIssue): void {
  const seen = new Map<string, number>();
  content.items.forEach((item, index) => {
    const previousIndex = seen.get(item.id);
    if (previousIndex !== undefined) {
      addIssue(
        'HUMOR_DUPLICATE_ID',
        `Humor item ID ${item.id} is already used at items.${previousIndex}.id.`,
        `items.${index}.id`,
        item.id,
      );
    } else {
      seen.set(item.id, index);
    }
  });
}

function checkTargetAndAnswer(item: HumorContentItem, index: number, addIssue: AddIssue): void {
  const path = `items.${index}`;
  for (const [variantName, variant] of [
    ['humorousVariant', item.humorousVariant],
    ['neutralFallback', item.neutralFallback],
  ] as const) {
    if (!equalScriptText(variant.learningTargetDisplay, item.learningTarget.display)) {
      addIssue(
        'HUMOR_TARGET_MISMATCH',
        `${variantName} must preserve the declared learning target.`,
        `${path}.${variantName}.learningTargetDisplay`,
        item.id,
      );
    }
    SCRIPT_KEYS.forEach((script) => {
      const target = item.learningTarget.display[script];
      const visibleText = `${variant.prompt[script]}\n${variant.correctAnswer[script]}`;
      if (!visibleText.includes(target)) {
        addIssue(
          'HUMOR_TARGET_NOT_PRESENT',
          `${variantName} must keep the ${script} learning target visible.`,
          `${path}.${variantName}.prompt.${script}`,
          item.id,
        );
      }
    });
  }
  if (
    item.humorousVariant.correctAnswerId !== item.neutralFallback.correctAnswerId ||
    !equalScriptText(item.humorousVariant.correctAnswer, item.neutralFallback.correctAnswer)
  ) {
    addIssue(
      'HUMOR_ANSWER_MISMATCH',
      'Humorous and neutral presentations must preserve the same correct answer.',
      `${path}.neutralFallback.correctAnswer`,
      item.id,
    );
  }
}

function checkSafety(item: HumorContentItem, index: number, addIssue: AddIssue): void {
  const path = `items.${index}`;
  const itemText = allItemText(item);
  UNSAFE_LANGUAGE_PATTERNS.forEach(({ label, pattern }) => {
    if (pattern.test(itemText)) {
      addIssue(
        'HUMOR_UNSAFE_LANGUAGE',
        `Static humor contains prohibited ${label} language.`,
        `${path}.humorousVariant.prompt`,
        item.id,
      );
    }
  });
  const neutralText = SCRIPT_KEYS.map(
    (script) =>
      `${item.neutralFallback.prompt[script]}\n${item.neutralFallback.correctAnswer[script]}`,
  ).join('\n');
  if (NON_NEUTRAL_FALLBACK_PATTERN.test(neutralText)) {
    addIssue(
      'HUMOR_NEUTRAL_FALLBACK_INVALID',
      'The neutral fallback must not contain explicit joke or laughter markers.',
      `${path}.neutralFallback`,
      item.id,
    );
  }
  if (!['approved', 'published'].includes(item.editorialStatus)) {
    addIssue(
      'HUMOR_EDITORIAL_REVIEW_REQUIRED',
      'Only approved or published human-editorial humor can pass release validation.',
      `${path}.editorialStatus`,
      item.id,
    );
  }
}

function checkKnowledgeClaim(item: HumorContentItem, index: number, addIssue: AddIssue): void {
  const path = `items.${index}.knowledgeClaim`;
  if (item.knowledgeClaim.kind === 'etymology') {
    addIssue(
      'HUMOR_ETYMOLOGY_CLAIM_NOT_ALLOWED',
      'V1 humor cannot present an etymology claim.',
      `${path}.kind`,
      item.id,
    );
  }
  if (item.humorType === 'memory_scene' && item.knowledgeClaim.kind !== 'mnemonic') {
    addIssue(
      'HUMOR_MEMORY_SCENE_DISCLOSURE_REQUIRED',
      'A memory scene must be explicitly classified as a mnemonic.',
      `${path}.kind`,
      item.id,
    );
  }
  if (item.knowledgeClaim.kind === 'mnemonic') {
    const disclosure = item.knowledgeClaim.disclosure;
    const disclosureText = disclosure
      ? SCRIPT_KEYS.map((script) => disclosure[script]).join('\n')
      : '';
    if (
      !MNEMONIC_DISCLOSURE_PATTERN.test(disclosureText) ||
      !NOT_ETYMOLOGY_PATTERN.test(disclosureText)
    ) {
      addIssue(
        'HUMOR_MEMORY_SCENE_DISCLOSURE_REQUIRED',
        'A mnemonic must say that it is a memory association, not etymology.',
        `${path}.disclosure`,
        item.id,
      );
    }
  }
}

export function validateHumorContent(
  input: unknown,
  options: { source?: string } = {},
): HumorValidationResult {
  const source = options.source ?? '<memory>';
  const parsed = HumorContentPackageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        code: 'HUMOR_SCHEMA_INVALID',
        message: issue.message,
        path: issue.path.map(String).join('.'),
        source,
      })),
    };
  }

  const errors: HumorValidationIssue[] = [];
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
  parsed.data.items.forEach((item, index) => {
    checkTargetAndAnswer(item, index, addIssue);
    checkSafety(item, index, addIssue);
    checkKnowledgeClaim(item, index, addIssue);
  });

  return errors.length === 0
    ? { valid: true, data: parsed.data, errors: [] }
    : { valid: false, errors };
}

export function formatHumorValidationIssue(issue: HumorValidationIssue): string {
  const object = issue.objectId ? ` object=${issue.objectId}` : '';
  return `${issue.source}:${issue.path} [${issue.code}]${object} ${issue.message}`;
}
