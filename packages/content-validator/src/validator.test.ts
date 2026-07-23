import { demoCurriculumPackage, type CurriculumPackage } from '@hanziquest/curriculum';
import { describe, expect, it } from 'vitest';

import { formatValidationIssue, validateCurriculumContent } from './validator.ts';

function copyFixture(): CurriculumPackage {
  return structuredClone(demoCurriculumPackage);
}

function errorCodes(input: unknown): string[] {
  const result = validateCurriculumContent(input, { source: 'fixture.json' });
  return result.valid ? [] : result.errors.map((error) => error.code);
}

describe('validateCurriculumContent', () => {
  it('locates schema failures at the source and field path', () => {
    const invalid = { ...copyFixture(), minimumAppVersion: 'latest' };
    const result = validateCurriculumContent(invalid, { source: 'bad.json' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toEqual(
        expect.objectContaining({
          code: 'SCHEMA_INVALID',
          path: 'minimumAppVersion',
          source: 'bad.json',
        }),
      );
    }
  });

  it('detects a missing reference with object ID and path', () => {
    const invalid = copyFixture();
    invalid.lessons[0]!.activityIds = ['00000000-0000-4000-8000-000000009999'];
    const result = validateCurriculumContent(invalid, { source: 'missing.json' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const issue = result.errors.find((error) => error.code === 'MISSING_REFERENCE');
      expect(issue).toEqual(
        expect.objectContaining({
          objectId: invalid.lessons[0]!.id,
          path: 'lessons.0.activityIds.0',
        }),
      );
      expect(formatValidationIssue(issue!)).toContain('missing.json:lessons.0.activityIds.0');
    }
  });

  it('detects an activity reference to a missing licensed asset', () => {
    const invalid = copyFixture();
    invalid.activities[0]!.references.assetIds = ['00000000-0000-4000-8000-000000009998'];
    const result = validateCurriculumContent(invalid, { source: 'assets.json' });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_REFERENCE',
          objectId: invalid.activities[0]!.id,
          path: 'activities.0.references.assetIds.0',
        }),
      );
    }
  });

  it('detects a target character that is absent from text', () => {
    const invalid = copyFixture();
    invalid.words[0]!.text = { simplified: '吃', traditional: '吃' };
    expect(errorCodes(invalid)).toContain('TARGET_NOT_PRESENT');
  });

  it('detects excessive target-character ratio', () => {
    const invalid = copyFixture();
    invalid.sentences[0]!.targetConceptIds = [
      invalid.characters[2]!.conceptId,
      invalid.characters[3]!.conceptId,
      invalid.characters[0]!.conceptId,
      invalid.characters[1]!.conceptId,
    ];
    invalid.sentences[0]!.maxUnknownCharacters = 4;
    expect(errorCodes(invalid)).toContain('UNKNOWN_CHARACTER_RATIO_EXCEEDED');
  });

  it('detects simplified and traditional mixing', () => {
    const invalid = copyFixture();
    invalid.sentences[0]!.text.simplified = '我要吃飯。';
    expect(errorCodes(invalid)).toContain('SCRIPT_MIXED');
  });

  it('detects sentence length limits', () => {
    const invalid = copyFixture();
    invalid.sentences[0]!.text = {
      simplified: '我'.repeat(21),
      traditional: '我'.repeat(21),
    };
    invalid.sentences[0]!.targetConceptIds = [invalid.characters[2]!.conceptId];
    invalid.sentences[0]!.maxUnknownCharacters = 10;
    expect(errorCodes(invalid)).toContain('SENTENCE_TOO_LONG');
  });

  it('detects out-of-range and non-unique answers', () => {
    const outOfRange = copyFixture();
    outOfRange.stories[0]!.comprehensionQuestions[0]!.correctOptionIndex = 9;
    expect(errorCodes(outOfRange)).toContain('ANSWER_INDEX_OUT_OF_RANGE');

    const duplicate = copyFixture();
    const question = duplicate.stories[0]!.comprehensionQuestions[0]!;
    question.options[1] = structuredClone(question.options[0]!);
    expect(errorCodes(duplicate)).toContain('ANSWER_NOT_UNIQUE');
  });

  it('detects prerequisite cycles', () => {
    const invalid = copyFixture();
    invalid.worlds[0]!.prerequisiteWorldIds = [invalid.worlds[0]!.id];
    expect(errorCodes(invalid)).toContain('CURRICULUM_GRAPH_CYCLE');
  });

  it('detects unknown glyphs and duplicate IDs', () => {
    const unknownGlyph = copyFixture();
    unknownGlyph.sentences[0]!.text = { simplified: '龙', traditional: '龍' };
    unknownGlyph.sentences[0]!.targetConceptIds = [unknownGlyph.characters[0]!.conceptId];
    expect(errorCodes(unknownGlyph)).toContain('UNKNOWN_GLYPH');

    const duplicateId = copyFixture();
    duplicateId.words[0]!.id = duplicateId.lessons[0]!.id;
    expect(errorCodes(duplicateId)).toContain('DUPLICATE_ID');
  });
});
