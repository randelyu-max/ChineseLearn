import { SemanticVersionSchema } from '@hanziquest/contracts';

type ParsedSemanticVersion = {
  core: [number, number, number];
  prerelease: string[] | undefined;
};

function parseSemanticVersion(version: string): ParsedSemanticVersion {
  const parsed = SemanticVersionSchema.parse(version);
  const [withoutBuild] = parsed.split('+');
  const match = /^(\d+\.\d+\.\d+)(?:-(.+))?$/.exec(withoutBuild!);
  const core = match![1]!.split('.').map(Number) as [number, number, number];
  return { core, prerelease: match![2]?.split('.') };
}

function comparePrereleaseIdentifiers(left: string, right: string): -1 | 0 | 1 {
  const leftIsNumeric = /^\d+$/.test(left);
  const rightIsNumeric = /^\d+$/.test(right);

  if (leftIsNumeric && rightIsNumeric) {
    const difference = Number(left) - Number(right);
    return difference === 0 ? 0 : difference < 0 ? -1 : 1;
  }
  if (leftIsNumeric !== rightIsNumeric) {
    return leftIsNumeric ? -1 : 1;
  }
  return left === right ? 0 : left < right ? -1 : 1;
}

export function compareSemanticVersions(left: string, right: string): -1 | 0 | 1 {
  const leftVersion = parseSemanticVersion(left);
  const rightVersion = parseSemanticVersion(right);

  for (let index = 0; index < leftVersion.core.length; index += 1) {
    const difference = leftVersion.core[index]! - rightVersion.core[index]!;
    if (difference !== 0) {
      return difference < 0 ? -1 : 1;
    }
  }

  if (leftVersion.prerelease === undefined && rightVersion.prerelease === undefined) {
    return 0;
  }
  if (leftVersion.prerelease === undefined) {
    return 1;
  }
  if (rightVersion.prerelease === undefined) {
    return -1;
  }

  const length = Math.max(leftVersion.prerelease.length, rightVersion.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftVersion.prerelease[index];
    const rightIdentifier = rightVersion.prerelease[index];
    if (leftIdentifier === undefined) {
      return -1;
    }
    if (rightIdentifier === undefined) {
      return 1;
    }

    const result = comparePrereleaseIdentifiers(leftIdentifier, rightIdentifier);
    if (result !== 0) {
      return result;
    }
  }

  return 0;
}

export function isCurriculumCompatible(appVersion: string, minimumAppVersion: string): boolean {
  return compareSemanticVersions(appVersion, minimumAppVersion) >= 0;
}
