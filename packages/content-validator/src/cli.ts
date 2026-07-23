import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { homeDemoCurriculumPackage } from '@hanziquest/curriculum';

import { formatValidationIssue, validateCurriculumContent } from './validator.ts';

async function loadInput(
  fileArgument: string | undefined,
): Promise<{ input: unknown; source: string }> {
  if (!fileArgument) {
    return { input: homeDemoCurriculumPackage, source: '<my-home-20-character-demo>' };
  }

  const source = resolve(fileArgument);
  const input: unknown = JSON.parse(await readFile(source, 'utf8'));
  return { input, source };
}

async function main(): Promise<void> {
  const { input, source } = await loadInput(process.argv[2]);
  const result = validateCurriculumContent(input, { source });

  if (!result.valid) {
    result.errors.forEach((issue) => console.error(formatValidationIssue(issue)));
    process.exitCode = 1;
    return;
  }

  console.log(`Content validation passed: ${source}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown content validation failure.');
  process.exitCode = 1;
});
