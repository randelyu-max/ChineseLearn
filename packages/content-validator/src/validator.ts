import {
  CurriculumPackageSchema,
  type CurriculumPackage,
  type ScriptText,
} from '@hanziquest/curriculum';

export const VALIDATION_ERROR_CODES = [
  'SCHEMA_INVALID',
  'DUPLICATE_ID',
  'DUPLICATE_CONTENT',
  'MISSING_REFERENCE',
  'UNKNOWN_GLYPH',
  'TARGET_NOT_PRESENT',
  'UNKNOWN_CHARACTER_LIMIT_EXCEEDED',
  'UNKNOWN_CHARACTER_RATIO_EXCEEDED',
  'SENTENCE_TOO_LONG',
  'SCRIPT_MIXED',
  'ANSWER_INDEX_OUT_OF_RANGE',
  'ANSWER_NOT_UNIQUE',
  'KNOWN_COVERAGE_TOO_LOW',
  'KNOWN_COVERAGE_MISMATCH',
  'CURRICULUM_GRAPH_CYCLE',
] as const;

export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[number];

export type ContentValidationIssue = {
  code: ValidationErrorCode;
  message: string;
  objectId?: string;
  path: string;
  source: string;
};

export type ContentValidationResult =
  | { valid: true; data: CurriculumPackage; errors: [] }
  | { valid: false; errors: ContentValidationIssue[] };

export type ContentValidationOptions = {
  maximumSentenceCharacters?: number;
  maximumUnknownCharacterRatio?: number;
  minimumStoryKnownCoverage?: number;
  source?: string;
};

type ResolvedOptions = Required<ContentValidationOptions>;
type AddIssue = (
  code: ValidationErrorCode,
  message: string,
  path: string,
  objectId?: string,
) => void;

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/gu;

function hanCharacters(text: string): string[] {
  return text.match(HAN_CHARACTER_PATTERN) ?? [];
}

function selectedText(
  text: ScriptText,
  script: CurriculumPackage['track']['scriptVariant'],
): string {
  return script === 'simplified' ? text.simplified : text.traditional;
}

function checkReferences(
  references: readonly string[],
  knownIds: ReadonlySet<string>,
  path: string,
  referenceType: string,
  ownerId: string,
  addIssue: AddIssue,
): void {
  references.forEach((referenceId, index) => {
    if (!knownIds.has(referenceId)) {
      addIssue(
        'MISSING_REFERENCE',
        `Missing ${referenceType} reference ${referenceId}.`,
        `${path}.${index}`,
        ownerId,
      );
    }
  });
}

function checkDuplicateIds(curriculum: CurriculumPackage, addIssue: AddIssue): void {
  const seen = new Map<string, string>();
  const candidates: Array<{ id: string; path: string }> = [
    { id: curriculum.track.id, path: 'track.id' },
    ...curriculum.worlds.map((item, index) => ({ id: item.id, path: `worlds.${index}.id` })),
    ...curriculum.units.map((item, index) => ({ id: item.id, path: `units.${index}.id` })),
    ...curriculum.lessons.map((item, index) => ({ id: item.id, path: `lessons.${index}.id` })),
    ...curriculum.activities.map((item, index) => ({
      id: item.id,
      path: `activities.${index}.id`,
    })),
    ...curriculum.characters.map((item, index) => ({
      id: item.conceptId,
      path: `characters.${index}.conceptId`,
    })),
    ...curriculum.words.map((item, index) => ({ id: item.id, path: `words.${index}.id` })),
    ...curriculum.sentences.map((item, index) => ({ id: item.id, path: `sentences.${index}.id` })),
    ...curriculum.stories.map((item, index) => ({ id: item.id, path: `stories.${index}.id` })),
    ...curriculum.assets.map((item, index) => ({ id: item.id, path: `assets.${index}.id` })),
    ...curriculum.stories.flatMap((story, storyIndex) =>
      story.comprehensionQuestions.map((question, questionIndex) => ({
        id: question.id,
        path: `stories.${storyIndex}.comprehensionQuestions.${questionIndex}.id`,
      })),
    ),
  ];

  for (const candidate of candidates) {
    const previousPath = seen.get(candidate.id);
    if (previousPath) {
      addIssue(
        'DUPLICATE_ID',
        `ID ${candidate.id} is already used at ${previousPath}.`,
        candidate.path,
        candidate.id,
      );
    } else {
      seen.set(candidate.id, candidate.path);
    }
  }
}

function checkDuplicateContent(curriculum: CurriculumPackage, addIssue: AddIssue): void {
  const characterGlyphs = new Map<string, string>();
  curriculum.characters.forEach((character, index) => {
    const key = `${character.glyph.simplified}\u0000${character.glyph.traditional}`;
    const previousId = characterGlyphs.get(key);
    if (previousId) {
      addIssue(
        'DUPLICATE_CONTENT',
        `Character glyph duplicates concept ${previousId}.`,
        `characters.${index}.glyph`,
        character.conceptId,
      );
    } else {
      characterGlyphs.set(key, character.conceptId);
    }
  });

  const wordTexts = new Map<string, string>();
  curriculum.words.forEach((word, index) => {
    const key = `${word.text.simplified}\u0000${word.text.traditional}`;
    const previousId = wordTexts.get(key);
    if (previousId) {
      addIssue(
        'DUPLICATE_CONTENT',
        `Word text duplicates word ${previousId}.`,
        `words.${index}.text`,
        word.id,
      );
    } else {
      wordTexts.set(key, word.id);
    }
  });
}

function checkAllReferences(curriculum: CurriculumPackage, addIssue: AddIssue): void {
  const worldIds = new Set(curriculum.worlds.map((item) => item.id));
  const unitIds = new Set(curriculum.units.map((item) => item.id));
  const lessonIds = new Set(curriculum.lessons.map((item) => item.id));
  const activityIds = new Set(curriculum.activities.map((item) => item.id));
  const characterIds = new Set(curriculum.characters.map((item) => item.conceptId));
  const wordIds = new Set(curriculum.words.map((item) => item.id));
  const sentenceIds = new Set(curriculum.sentences.map((item) => item.id));
  const storyIds = new Set(curriculum.stories.map((item) => item.id));
  const assetIds = new Set(curriculum.assets.map((item) => item.id));

  checkReferences(
    curriculum.track.worldIds,
    worldIds,
    'track.worldIds',
    'world',
    curriculum.track.id,
    addIssue,
  );

  curriculum.worlds.forEach((world, index) => {
    checkReferences(world.unitIds, unitIds, `worlds.${index}.unitIds`, 'unit', world.id, addIssue);
    checkReferences(
      world.prerequisiteWorldIds,
      worldIds,
      `worlds.${index}.prerequisiteWorldIds`,
      'world prerequisite',
      world.id,
      addIssue,
    );
  });

  curriculum.units.forEach((unit, index) => {
    checkReferences(
      unit.lessonIds,
      lessonIds,
      `units.${index}.lessonIds`,
      'lesson',
      unit.id,
      addIssue,
    );
    checkReferences(
      unit.prerequisiteUnitIds,
      unitIds,
      `units.${index}.prerequisiteUnitIds`,
      'unit prerequisite',
      unit.id,
      addIssue,
    );
  });

  curriculum.lessons.forEach((lesson, index) => {
    checkReferences(
      lesson.activityIds,
      activityIds,
      `lessons.${index}.activityIds`,
      'activity',
      lesson.id,
      addIssue,
    );
    checkReferences(
      lesson.prerequisiteLessonIds,
      lessonIds,
      `lessons.${index}.prerequisiteLessonIds`,
      'lesson prerequisite',
      lesson.id,
      addIssue,
    );
  });

  curriculum.activities.forEach((activity, index) => {
    checkReferences(
      activity.targetConceptIds,
      characterIds,
      `activities.${index}.targetConceptIds`,
      'character concept',
      activity.id,
      addIssue,
    );
    checkReferences(
      activity.references.characterConceptIds,
      characterIds,
      `activities.${index}.references.characterConceptIds`,
      'character concept',
      activity.id,
      addIssue,
    );
    checkReferences(
      activity.references.wordIds,
      wordIds,
      `activities.${index}.references.wordIds`,
      'word',
      activity.id,
      addIssue,
    );
    checkReferences(
      activity.references.sentenceIds,
      sentenceIds,
      `activities.${index}.references.sentenceIds`,
      'sentence',
      activity.id,
      addIssue,
    );
    checkReferences(
      activity.references.storyIds,
      storyIds,
      `activities.${index}.references.storyIds`,
      'story',
      activity.id,
      addIssue,
    );
    checkReferences(
      activity.references.assetIds,
      assetIds,
      `activities.${index}.references.assetIds`,
      'content asset',
      activity.id,
      addIssue,
    );
  });

  curriculum.words.forEach((word, index) => {
    checkReferences(
      word.characterConceptIds,
      characterIds,
      `words.${index}.characterConceptIds`,
      'character concept',
      word.id,
      addIssue,
    );
    checkReferences(
      word.targetConceptIds,
      characterIds,
      `words.${index}.targetConceptIds`,
      'target character concept',
      word.id,
      addIssue,
    );
  });

  curriculum.sentences.forEach((sentence, index) => {
    checkReferences(
      sentence.characterConceptIds,
      characterIds,
      `sentences.${index}.characterConceptIds`,
      'character concept',
      sentence.id,
      addIssue,
    );
    checkReferences(
      sentence.targetConceptIds,
      characterIds,
      `sentences.${index}.targetConceptIds`,
      'target character concept',
      sentence.id,
      addIssue,
    );
  });

  curriculum.stories.forEach((story, storyIndex) => {
    checkReferences(
      story.sentenceIds,
      sentenceIds,
      `stories.${storyIndex}.sentenceIds`,
      'sentence',
      story.id,
      addIssue,
    );
    checkReferences(
      story.targetConceptIds,
      characterIds,
      `stories.${storyIndex}.targetConceptIds`,
      'target character concept',
      story.id,
      addIssue,
    );
    story.comprehensionQuestions.forEach((question, questionIndex) => {
      checkReferences(
        question.evidenceSentenceIds,
        sentenceIds,
        `stories.${storyIndex}.comprehensionQuestions.${questionIndex}.evidenceSentenceIds`,
        'evidence sentence',
        question.id,
        addIssue,
      );
    });
  });

  curriculum.characters.forEach((character, index) => {
    checkReferences(
      character.prerequisiteConceptIds,
      characterIds,
      `characters.${index}.prerequisiteConceptIds`,
      'character prerequisite',
      character.conceptId,
      addIssue,
    );
    checkReferences(
      character.confusableConceptIds,
      characterIds,
      `characters.${index}.confusableConceptIds`,
      'confusable character',
      character.conceptId,
      addIssue,
    );
    if (character.audioAssetId) {
      checkReferences(
        [character.audioAssetId],
        assetIds,
        `characters.${index}.audioAssetId`,
        'audio asset',
        character.conceptId,
        addIssue,
      );
    }
  });

  curriculum.words.forEach((word, index) => {
    if (word.audioAssetId) {
      checkReferences(
        [word.audioAssetId],
        assetIds,
        `words.${index}.audioAssetId`,
        'audio asset',
        word.id,
        addIssue,
      );
    }
  });
  curriculum.sentences.forEach((sentence, index) => {
    if (sentence.audioAssetId) {
      checkReferences(
        [sentence.audioAssetId],
        assetIds,
        `sentences.${index}.audioAssetId`,
        'audio asset',
        sentence.id,
        addIssue,
      );
    }
  });
}

function checkTextAndTargets(
  curriculum: CurriculumPackage,
  options: ResolvedOptions,
  addIssue: AddIssue,
): void {
  const script = curriculum.track.scriptVariant;
  const charactersById = new Map(
    curriculum.characters.map((character) => [character.conceptId, character]),
  );
  const glyphSet = new Set(
    curriculum.characters.map((character) => selectedText(character.glyph, script)),
  );
  const simplifiedOnly = new Set<string>();
  const traditionalOnly = new Set<string>();

  curriculum.characters.forEach((character) => {
    if (character.glyph.simplified !== character.glyph.traditional) {
      simplifiedOnly.add(character.glyph.simplified);
      traditionalOnly.add(character.glyph.traditional);
    }
  });
  for (const glyph of [...simplifiedOnly]) {
    if (traditionalOnly.has(glyph)) {
      simplifiedOnly.delete(glyph);
      traditionalOnly.delete(glyph);
    }
  }

  const checkScriptText = (text: ScriptText, path: string, objectId: string): void => {
    const wrongSimplified = hanCharacters(text.simplified).find((glyph) =>
      traditionalOnly.has(glyph),
    );
    if (wrongSimplified) {
      addIssue(
        'SCRIPT_MIXED',
        `Simplified text contains traditional-only glyph ${wrongSimplified}.`,
        `${path}.simplified`,
        objectId,
      );
    }
    const wrongTraditional = hanCharacters(text.traditional).find((glyph) =>
      simplifiedOnly.has(glyph),
    );
    if (wrongTraditional) {
      addIssue(
        'SCRIPT_MIXED',
        `Traditional text contains simplified-only glyph ${wrongTraditional}.`,
        `${path}.traditional`,
        objectId,
      );
    }
  };

  const checkTargetPresence = (
    text: ScriptText,
    targetIds: readonly string[],
    path: string,
    objectId: string,
  ): void => {
    for (const targetId of targetIds) {
      const character = charactersById.get(targetId);
      if (
        character &&
        !selectedText(text, script).includes(selectedText(character.glyph, script))
      ) {
        addIssue(
          'TARGET_NOT_PRESENT',
          `Target character ${targetId} is not present in the selected-script text.`,
          path,
          objectId,
        );
      }
    }
  };

  curriculum.words.forEach((word, index) => {
    checkScriptText(word.text, `words.${index}.text`, word.id);
    checkTargetPresence(word.text, word.targetConceptIds, `words.${index}.text`, word.id);
  });

  curriculum.sentences.forEach((sentence, index) => {
    const path = `sentences.${index}.text`;
    checkScriptText(sentence.text, path, sentence.id);
    checkTargetPresence(sentence.text, sentence.targetConceptIds, path, sentence.id);

    const textCharacters = hanCharacters(selectedText(sentence.text, script));
    const unknownGlyphs = new Set(
      sentence.targetConceptIds
        .map((targetId) => charactersById.get(targetId))
        .filter((character) => character !== undefined)
        .map((character) => selectedText(character.glyph, script)),
    );
    const unknownCount = textCharacters.filter((glyph) => unknownGlyphs.has(glyph)).length;
    const unknownRatio = textCharacters.length === 0 ? 0 : unknownCount / textCharacters.length;

    if (textCharacters.length > options.maximumSentenceCharacters) {
      addIssue(
        'SENTENCE_TOO_LONG',
        `Sentence has ${textCharacters.length} Han characters; maximum is ${options.maximumSentenceCharacters}.`,
        path,
        sentence.id,
      );
    }
    if (unknownCount > sentence.maxUnknownCharacters) {
      addIssue(
        'UNKNOWN_CHARACTER_LIMIT_EXCEEDED',
        `Sentence contains ${unknownCount} target-character occurrences; declared maximum is ${sentence.maxUnknownCharacters}.`,
        `sentences.${index}.maxUnknownCharacters`,
        sentence.id,
      );
    }
    if (unknownRatio > options.maximumUnknownCharacterRatio) {
      addIssue(
        'UNKNOWN_CHARACTER_RATIO_EXCEEDED',
        `Target-character ratio ${unknownRatio.toFixed(3)} exceeds ${options.maximumUnknownCharacterRatio.toFixed(3)}.`,
        path,
        sentence.id,
      );
    }

    textCharacters.forEach((glyph) => {
      if (!glyphSet.has(glyph)) {
        addIssue(
          'UNKNOWN_GLYPH',
          `Glyph ${glyph} has no character concept in this curriculum package.`,
          path,
          sentence.id,
        );
      }
    });
  });

  const sentenceById = new Map(curriculum.sentences.map((sentence) => [sentence.id, sentence]));
  curriculum.stories.forEach((story, storyIndex) => {
    checkScriptText(story.title, `stories.${storyIndex}.title`, story.id);
    checkScriptText(story.transferPrompt, `stories.${storyIndex}.transferPrompt`, story.id);

    const storyText = story.sentenceIds
      .map((sentenceId) => sentenceById.get(sentenceId))
      .filter((sentence) => sentence !== undefined)
      .map((sentence) => selectedText(sentence.text, script))
      .join('');
    const combinedText = { simplified: storyText, traditional: storyText };
    checkTargetPresence(
      combinedText,
      story.targetConceptIds,
      `stories.${storyIndex}.sentenceIds`,
      story.id,
    );

    const targetGlyphs = new Set(
      story.targetConceptIds
        .map((targetId) => charactersById.get(targetId))
        .filter((character) => character !== undefined)
        .map((character) => selectedText(character.glyph, script)),
    );
    const textCharacters = hanCharacters(storyText);
    const targetCount = textCharacters.filter((glyph) => targetGlyphs.has(glyph)).length;
    const calculatedCoverage =
      textCharacters.length === 0 ? 0 : 1 - targetCount / textCharacters.length;

    if (calculatedCoverage < options.minimumStoryKnownCoverage) {
      addIssue(
        'KNOWN_COVERAGE_TOO_LOW',
        `Story known-character coverage ${calculatedCoverage.toFixed(3)} is below ${options.minimumStoryKnownCoverage.toFixed(3)}.`,
        `stories.${storyIndex}.knownCharacterCoverage`,
        story.id,
      );
    }
    if (Math.abs(calculatedCoverage - story.knownCharacterCoverage) > 0.02) {
      addIssue(
        'KNOWN_COVERAGE_MISMATCH',
        `Declared coverage ${story.knownCharacterCoverage.toFixed(3)} does not match calculated coverage ${calculatedCoverage.toFixed(3)}.`,
        `stories.${storyIndex}.knownCharacterCoverage`,
        story.id,
      );
    }

    story.comprehensionQuestions.forEach((question, questionIndex) => {
      const questionPath = `stories.${storyIndex}.comprehensionQuestions.${questionIndex}`;
      checkScriptText(question.prompt, `${questionPath}.prompt`, question.id);
      question.options.forEach((option, optionIndex) => {
        checkScriptText(option, `${questionPath}.options.${optionIndex}`, question.id);
      });

      if (question.correctOptionIndex >= question.options.length) {
        addIssue(
          'ANSWER_INDEX_OUT_OF_RANGE',
          `Correct option index ${question.correctOptionIndex} is outside ${question.options.length} options.`,
          `${questionPath}.correctOptionIndex`,
          question.id,
        );
      } else {
        const answer = selectedText(question.options[question.correctOptionIndex]!, script).trim();
        const matches = question.options.filter(
          (option) => selectedText(option, script).trim() === answer,
        ).length;
        if (matches !== 1) {
          addIssue(
            'ANSWER_NOT_UNIQUE',
            'The declared correct answer appears more than once.',
            `${questionPath}.options`,
            question.id,
          );
        }
      }
    });
  });
}

function checkGraphCycles(
  nodes: ReadonlyArray<{ id: string; prerequisites: readonly string[]; path: string }>,
  addIssue: AddIssue,
): void {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const state = new Map<string, 'visiting' | 'visited'>();
  const reported = new Set<string>();

  const visit = (node: (typeof nodes)[number]): void => {
    state.set(node.id, 'visiting');
    node.prerequisites.forEach((prerequisiteId, index) => {
      const prerequisite = byId.get(prerequisiteId);
      if (!prerequisite) {
        return;
      }
      if (state.get(prerequisiteId) === 'visiting') {
        const key = [node.id, prerequisiteId].sort().join(':');
        if (!reported.has(key)) {
          reported.add(key);
          addIssue(
            'CURRICULUM_GRAPH_CYCLE',
            `Prerequisite edge ${node.id} -> ${prerequisiteId} creates a cycle.`,
            `${node.path}.${index}`,
            node.id,
          );
        }
      } else if (state.get(prerequisiteId) !== 'visited') {
        visit(prerequisite);
      }
    });
    state.set(node.id, 'visited');
  };

  nodes.forEach((node) => {
    if (!state.has(node.id)) {
      visit(node);
    }
  });
}

function checkAllGraphs(curriculum: CurriculumPackage, addIssue: AddIssue): void {
  checkGraphCycles(
    curriculum.worlds.map((world, index) => ({
      id: world.id,
      prerequisites: world.prerequisiteWorldIds,
      path: `worlds.${index}.prerequisiteWorldIds`,
    })),
    addIssue,
  );
  checkGraphCycles(
    curriculum.units.map((unit, index) => ({
      id: unit.id,
      prerequisites: unit.prerequisiteUnitIds,
      path: `units.${index}.prerequisiteUnitIds`,
    })),
    addIssue,
  );
  checkGraphCycles(
    curriculum.lessons.map((lesson, index) => ({
      id: lesson.id,
      prerequisites: lesson.prerequisiteLessonIds,
      path: `lessons.${index}.prerequisiteLessonIds`,
    })),
    addIssue,
  );
  checkGraphCycles(
    curriculum.characters.map((character, index) => ({
      id: character.conceptId,
      prerequisites: character.prerequisiteConceptIds,
      path: `characters.${index}.prerequisiteConceptIds`,
    })),
    addIssue,
  );
}

export function validateCurriculumContent(
  input: unknown,
  options: ContentValidationOptions = {},
): ContentValidationResult {
  const resolvedOptions: ResolvedOptions = {
    maximumSentenceCharacters: options.maximumSentenceCharacters ?? 20,
    maximumUnknownCharacterRatio: options.maximumUnknownCharacterRatio ?? 0.35,
    minimumStoryKnownCoverage: options.minimumStoryKnownCoverage ?? 0.9,
    source: options.source ?? '<memory>',
  };
  const parsed = CurriculumPackageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        code: 'SCHEMA_INVALID',
        message: issue.message,
        path: issue.path.map(String).join('.'),
        source: resolvedOptions.source,
      })),
    };
  }

  const errors: ContentValidationIssue[] = [];
  const addIssue: AddIssue = (code, message, path, objectId) => {
    errors.push({
      code,
      message,
      ...(objectId === undefined ? {} : { objectId }),
      path,
      source: resolvedOptions.source,
    });
  };

  checkDuplicateIds(parsed.data, addIssue);
  checkDuplicateContent(parsed.data, addIssue);
  checkAllReferences(parsed.data, addIssue);
  checkTextAndTargets(parsed.data, resolvedOptions, addIssue);
  checkAllGraphs(parsed.data, addIssue);

  return errors.length === 0
    ? { valid: true, data: parsed.data, errors: [] }
    : { valid: false, errors };
}

export function formatValidationIssue(issue: ContentValidationIssue): string {
  const object = issue.objectId ? ` object=${issue.objectId}` : '';
  return `${issue.source}:${issue.path} [${issue.code}]${object} ${issue.message}`;
}
