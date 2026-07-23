import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { approvedPinyinContentFixture, homeDemoCurriculumPackage } from '@hanziquest/curriculum';

import { formatHumorValidationIssue, validateHumorContent } from './humor-validator.ts';
import { formatPinyinValidationIssue, validatePinyinContent } from './pinyin-validator.ts';
import { formatValidationIssue, validateCurriculumContent } from './validator.ts';

async function loadInput(
  fileArgument: string | undefined,
): Promise<{ input: unknown; source: string } | null> {
  if (!fileArgument) return null;
  const source = resolve(fileArgument);
  const input: unknown = JSON.parse(await readFile(source, 'utf8'));
  return { input, source };
}

async function main(): Promise<void> {
  const loaded = await loadInput(process.argv[2]);
  if (!loaded) {
    const curriculum = validateCurriculumContent(homeDemoCurriculumPackage, {
      source: '<my-home-20-character-demo>',
    });
    const pinyin = validatePinyinContent(approvedPinyinContentFixture, {
      source: '<approved-pinyin-content>',
    });
    if (!curriculum.valid) {
      curriculum.errors.forEach((issue) => console.error(formatValidationIssue(issue)));
    }
    if (!pinyin.valid) {
      pinyin.errors.forEach((issue) => console.error(formatPinyinValidationIssue(issue)));
    }
    if (!curriculum.valid || !pinyin.valid) {
      process.exitCode = 1;
      return;
    }
    console.log('Content validation passed: curriculum and approved Pinyin content');
    return;
  }

  if (
    typeof loaded.input === 'object' &&
    loaded.input !== null &&
    'schemaVersion' in loaded.input &&
    loaded.input.schemaVersion === 'pinyin-content-v1'
  ) {
    const result = validatePinyinContent(loaded.input, {
      source: loaded.source,
    });
    if (!result.valid) {
      result.errors.forEach((issue) => console.error(formatPinyinValidationIssue(issue)));
      process.exitCode = 1;
      return;
    }
    console.log(`Pinyin content validation passed: ${loaded.source}`);
    return;
  }

  if (
    typeof loaded.input === 'object' &&
    loaded.input !== null &&
    'schemaVersion' in loaded.input &&
    loaded.input.schemaVersion === 'humor-content-v1'
  ) {
    const result = validateHumorContent(loaded.input, {
      source: loaded.source,
    });
    if (!result.valid) {
      result.errors.forEach((issue) => console.error(formatHumorValidationIssue(issue)));
      process.exitCode = 1;
      return;
    }
    console.log(`Humor content validation passed: ${loaded.source}`);
    return;
  }

  const result = validateCurriculumContent(loaded.input, {
    source: loaded.source,
  });
  if (!result.valid) {
    result.errors.forEach((issue) => console.error(formatValidationIssue(issue)));
    process.exitCode = 1;
    return;
  }

  console.log(`Content validation passed: ${loaded.source}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown content validation failure.');
  process.exitCode = 1;
});
