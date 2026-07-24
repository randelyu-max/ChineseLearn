import {
  PRODUCTION_CURRICULUM_RELEASE_SCHEMA_VERSION,
  type ProductionCurriculumRelease,
} from '@hanziquest/curriculum';

export type ProductionReleaseValidationIssue = Readonly<{
  code:
    | 'SCHEMA_VERSION_INVALID'
    | 'EDITORIAL_REVIEW_REQUIRED'
    | 'MEDIA_AUTHORIZATION_REQUIRED'
    | 'COVERAGE_DECLARATION_INVALID'
    | 'EMPTY_RELEASE';
  path: string;
}>;

export type ProductionReleaseValidationResult =
  | Readonly<{ valid: true; data: ProductionCurriculumRelease; errors: readonly [] }>
  | Readonly<{ valid: false; errors: readonly ProductionReleaseValidationIssue[] }>;

export function validateProductionCurriculumRelease(
  input: ProductionCurriculumRelease,
): ProductionReleaseValidationResult {
  const errors: ProductionReleaseValidationIssue[] = [];
  if (input.schemaVersion !== PRODUCTION_CURRICULUM_RELEASE_SCHEMA_VERSION) {
    errors.push({ code: 'SCHEMA_VERSION_INVALID', path: 'schemaVersion' });
  }
  if (input.editorialReview.status !== 'approved') {
    errors.push({ code: 'EDITORIAL_REVIEW_REQUIRED', path: 'editorialReview.status' });
  }
  input.media.forEach((asset, index) => {
    if (!asset.authorized || !asset.licenseIdentifier || !asset.sourceReference) {
      errors.push({ code: 'MEDIA_AUTHORIZATION_REQUIRED', path: `media.${index}` });
    }
  });
  for (const [key, value] of Object.entries(input.coverage)) {
    if (key === 'pinyinFoundationIncluded') continue;
    if (typeof value !== 'object' || value.actual < 0 || value.target <= 0) {
      errors.push({ code: 'COVERAGE_DECLARATION_INVALID', path: `coverage.${key}` });
    }
  }
  if (
    input.lessons.length === 0 ||
    input.characters.length === 0 ||
    input.words.length === 0 ||
    input.sentences.length === 0
  ) {
    errors.push({ code: 'EMPTY_RELEASE', path: 'release' });
  }
  return errors.length === 0 ? { valid: true, data: input, errors: [] } : { valid: false, errors };
}
