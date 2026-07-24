import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const runtimePrefixes = ['apps/', 'packages/', 'database/'];
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
const forbiddenDomain = [
  /\bParentAuthProvider\b/i,
  /\b(?:child|parent)_profiles?\b/i,
  /\bhouseholds?\b/i,
  /\bhousehold_members?\b/i,
  /\bguardians?\b/i,
  /\b(?:child|parent|household|learner|family|guardian)_id\b/i,
  /\b(?:parentRole|childSession|profileSelector|childSwitcher|parentGate|parentPin)\b/i,
  /\b(?:parentDashboard|childDashboard)\b/i,
  /\bmeaning(?:ZhChild|EnParent)\b/,
];
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
];
const rawSignatureBoundary = [
  /\brawImage\b/i,
  /\brawStroke\b/i,
  /\bstrokePoints\b/i,
  /\bimageData\b/i,
  /\bsvgPath\b/i,
  /\bstrokes\b/i,
  /\bpoints\b/i,
];

function trackedFiles() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
    .map((path) => path.replaceAll('\\', '/'));
}

async function readTracked(path) {
  return readFile(join(root, path), 'utf8');
}

function matchingLines(path, content, patterns) {
  const matches = [];
  content.split(/\r?\n/).forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      matches.push(`${path}:${index + 1}`);
    }
  });
  return matches;
}

const files = trackedFiles();
const violations = [];
const textByPath = new Map();
for (const path of files) {
  if (!textExtensions.has(extname(path))) continue;
  const content = await readTracked(path);
  textByPath.set(path, content);
  if (runtimePrefixes.some((prefix) => path.startsWith(prefix)) && extname(path) !== '.md') {
    violations.push(...matchingLines(path, content, forbiddenDomain));
  }
  violations.push(...matchingLines(path, content, secretPatterns));
  if (
    (path.startsWith('apps/api/src/') ||
      path === 'packages/contracts/src/signature.ts' ||
      path.startsWith('database/migrations/')) &&
    !path.endsWith('.test.ts')
  ) {
    violations.push(...matchingLines(path, content, rawSignatureBoundary));
  }
}

const trackedEnvironmentFiles = files.filter(
  (path) => /(^|\/)\.env(?:\.|$)/.test(path) && path !== '.env.example',
);
violations.push(...trackedEnvironmentFiles.map((path) => `${path}: tracked environment file`));

const appConfig = JSON.parse(await readTracked('apps/mobile/app.json')).expo;
const rootPackage = JSON.parse(await readTracked('package.json'));
const mobilePackage = JSON.parse(await readTracked('apps/mobile/package.json'));
const expectedVersion = '1.0.0';
if (
  appConfig.version !== expectedVersion ||
  rootPackage.version !== expectedVersion ||
  mobilePackage.version !== expectedVersion
) {
  violations.push('release version: app and package versions must all be 1.0.0');
}
if (
  appConfig.ios?.bundleIdentifier !== 'com.hanziquest.app' ||
  appConfig.android?.package !== 'com.hanziquest.app'
) {
  violations.push('store identifiers: iOS and Android must use com.hanziquest.app');
}
const audioPlugin = appConfig.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio',
);
if (
  !Array.isArray(audioPlugin) ||
  audioPlugin[1]?.microphonePermission !== false ||
  audioPlugin[1]?.recordAudioAndroid !== false ||
  audioPlugin[1]?.enableBackgroundRecording !== false
) {
  violations.push('privacy config: audio recording and microphone access must remain disabled');
}
if (appConfig.web?.output !== 'static') {
  violations.push('web release config: Expo output must remain static');
}

const ci = await readTracked('.github/workflows/ci.yml');
for (const command of ['pnpm verify:v1-release', 'pnpm content:validate', 'pnpm db:test']) {
  if (!ci.includes(command)) violations.push(`CI release gate missing: ${command}`);
}

let radioControlCount = 0;
for (const [path, content] of textByPath) {
  if (!path.startsWith('apps/mobile/src/') || !path.endsWith('.tsx')) continue;
  for (const match of content.matchAll(/<Pressable\b[\s\S]*?accessibilityRole="radio"[\s\S]*?>/g)) {
    radioControlCount += 1;
    if (!match[0].includes('aria-checked=')) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      violations.push(`${path}:${line}: radio control is missing aria-checked`);
    }
  }
}
if (radioControlCount === 0) {
  violations.push('accessibility contract: expected at least one mobile radio control');
}

if (violations.length > 0) {
  throw new Error(`V1 release boundary verification failed:\n${violations.join('\n')}`);
}

console.log(
  `V1 release boundary verification passed: ${files.length} tracked files scanned; ` +
    `single-user domain, secret, raw-signature, store config, CI, and ${radioControlCount} ` +
    'radio accessibility gates are clean.',
);
