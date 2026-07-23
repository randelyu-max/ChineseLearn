import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const runtimeRoots = ['apps', 'packages', 'database'];
const ignoredDirectories = new Set([
  '.expo',
  '.next',
  '.temp',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
]);
const textExtensions = new Set([
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const forbidden = [
  /\bopenai\b/i,
  /\bAI provider\b/i,
  /\bAI (?:API key|consent|Edge Function|entitlement|feature flag|Prompt|usage)\b/i,
  /\bai[_-](?:consent|entitlement|feature|generated|generation|job|moderation|personalization|prompt|provider|usage)\b/i,
  /\bOPENAI_API_KEY\b/,
  /\bmodel_alias\b/i,
  /\bmoderation_(?:result|summary)\b/i,
  /\bpremium AI\b/i,
  /\bprompt_version\b/i,
  /\bprovider_(?:payload|request)\b/i,
  /\bstructured outputs?\b/i,
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile() && textExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const violations = [];
for (const runtimeRoot of runtimeRoots) {
  for (const file of await collectFiles(join(root, runtimeRoot))) {
    const content = await readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const pattern of forbidden) {
        if (pattern.test(line)) {
          violations.push(`${relative(root, file)}:${index + 1}: ${line.trim()}`);
          break;
        }
      }
    });
  }
}

if (violations.length > 0) {
  throw new Error(`Forbidden V1 runtime surface found:\n${violations.join('\n')}`);
}

console.log('V1 runtime verification passed: apps, packages, and database contain no AI surface.');
