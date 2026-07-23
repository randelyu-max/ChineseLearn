import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const removedVendor = ['supa', 'base'].join('');
const forbidden = [
  new RegExp(`@${removedVendor}\\b`, 'i'),
  new RegExp(`\\b${removedVendor}\\b`, 'i'),
  new RegExp(`EXPO_PUBLIC_${removedVendor.toUpperCase()}`, 'i'),
  /\bauth\.uid\s*\(/i,
  /\bauth\.users\b/i,
];
const extensions = new Set(['.js', '.json', '.mjs', '.sql', '.ts', '.tsx', '.yaml', '.yml']);
const roots = ['apps', 'packages', 'database', 'scripts'];
const standaloneFiles = [
  '.env.example',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.github/workflows/ci.yml',
];

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['dist', 'node_modules'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(path)));
    else if (entry.isFile() && extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = [
  ...(await Promise.all(roots.map((directory) => filesIn(join(root, directory))))).flat(),
  ...standaloneFiles.map((path) => join(root, path)),
];
const violations = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (forbidden.some((pattern) => pattern.test(line))) {
      violations.push(`${relative(root, file)}:${index + 1}`);
    }
  }
}
if (violations.length > 0) {
  throw new Error(`Removed backend coupling found:\n${violations.join('\n')}`);
}
console.log('Portable backend verification passed: no removed SDK, configuration, or auth helper.');
