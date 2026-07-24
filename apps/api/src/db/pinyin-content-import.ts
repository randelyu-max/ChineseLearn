import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { normalizePinyinSyllable } from '@hanziquest/contracts';
import { approvedPinyinContentFixture, type PinyinContentPackage } from '@hanziquest/curriculum';
import { validatePinyinContent } from '@hanziquest/content-validator';
import type { PoolClient } from 'pg';

export const PINYIN_CURRICULUM_VERSION_ID = '50000000-0000-4000-8000-000000000900';
export const PINYIN_CURRICULUM_VERSION = 'pinyin-1.0.0';

const toneConceptIds = {
  1: '50000000-0000-4000-8000-000000000301',
  2: '50000000-0000-4000-8000-000000000302',
  3: '50000000-0000-4000-8000-000000000303',
  4: '50000000-0000-4000-8000-000000000304',
  5: '50000000-0000-4000-8000-000000000305',
} as const;

const bundledAssetSizes: Readonly<Record<string, number>> = Object.freeze({
  'apps/mobile/assets/audio/pinyin/ma2.mp3': 11_230,
  'apps/mobile/assets/audio/pinyin/ma3.mp3': 13_010,
  'apps/mobile/assets/audio/pinyin/ma4.mp3': 9_301,
});

type PinyinConceptImportRow = Readonly<{
  audioAssetId: string | null;
  canonicalValue: string;
  conceptCode: string;
  displayValue: string;
  finalConceptId: string | null;
  id: string;
  initialConceptId: string | null;
  kind: 'final' | 'initial' | 'syllable' | 'tone';
  metadata: Readonly<Record<string, unknown>>;
  numberedValue: string | null;
  toneNumber: number | null;
}>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function manifestSha256(content: PinyinContentPackage): string {
  return createHash('sha256').update(stableJson(content)).digest('hex');
}

export function buildPinyinConceptImportRows(input: unknown): readonly PinyinConceptImportRow[] {
  const validated = validatePinyinContent(input, { source: 'pinyin-content-v1' });
  if (!validated.valid) {
    throw new Error(
      `Pinyin content validation failed: ${validated.errors
        .map((issue) => `${issue.code}:${issue.path}`)
        .join(', ')}`,
    );
  }
  const content = validated.data;
  return Object.freeze([
    ...content.initials.map((item): PinyinConceptImportRow => ({
      audioAssetId: null,
      canonicalValue: item.value,
      conceptCode: `pinyin.initial.${item.value}`,
      displayValue: item.value,
      finalConceptId: null,
      id: item.id,
      initialConceptId: null,
      kind: 'initial',
      metadata: Object.freeze({
        articulationHintZh: item.articulationHintZh,
        labelZh: item.labelZh,
        sourceStatus: item.status,
      }),
      numberedValue: null,
      toneNumber: null,
    })),
    ...content.finals.map((item): PinyinConceptImportRow => ({
      audioAssetId: null,
      canonicalValue: item.value,
      conceptCode: `pinyin.final.${item.value.replace('ü', 'v')}`,
      displayValue: item.value,
      finalConceptId: null,
      id: item.id,
      initialConceptId: null,
      kind: 'final',
      metadata: Object.freeze({
        articulationHintZh: item.articulationHintZh,
        labelZh: item.labelZh,
        sourceStatus: item.status,
      }),
      numberedValue: null,
      toneNumber: null,
    })),
    ...content.tones.map((item): PinyinConceptImportRow => ({
      audioAssetId: null,
      canonicalValue: `tone-${item.tone}`,
      conceptCode: `pinyin.tone.${item.tone}`,
      displayValue: item.labelZh,
      finalConceptId: null,
      id: toneConceptIds[item.tone],
      initialConceptId: null,
      kind: 'tone',
      metadata: Object.freeze({
        contour: item.contour,
        exampleSyllable: item.exampleSyllable,
        sourceStatus: item.status,
      }),
      numberedValue: null,
      toneNumber: item.tone,
    })),
    ...content.syllables.map((item): PinyinConceptImportRow => {
      const normalized = normalizePinyinSyllable(item.numbered);
      if (!normalized) throw new Error(`Validated Pinyin syllable did not normalize: ${item.id}`);
      return {
        audioAssetId: item.audioAssetId ?? null,
        canonicalValue: normalized.base,
        conceptCode: `pinyin.syllable.${item.numbered.replace('ü', 'v')}`,
        displayValue: item.display,
        finalConceptId: item.finalId,
        id: item.id,
        initialConceptId: item.initialId,
        kind: 'syllable',
        metadata: Object.freeze({
          mouthShapeHintZh: item.mouthShapeHintZh ?? null,
          sourceStatus: item.status,
        }),
        numberedValue: item.numbered,
        toneNumber: item.tone,
      };
    }),
  ]);
}

export async function verifyPinyinBundledAudio(
  content: PinyinContentPackage,
  repositoryRoot: string,
): Promise<void> {
  for (const asset of content.assets) {
    if (asset.kind !== 'audio' || asset.delivery !== 'bundled_file') continue;
    if (!asset.localPath || !asset.sha256) {
      throw new Error(`Bundled Pinyin audio metadata is incomplete: ${asset.id}`);
    }
    const absolutePath = resolve(repositoryRoot, asset.localPath);
    const [bytes, details] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== asset.sha256)
      throw new Error(`Pinyin audio SHA-256 mismatch: ${asset.localPath}`);
    const expectedSize = bundledAssetSizes[asset.localPath];
    if (expectedSize === undefined || details.size !== expectedSize) {
      throw new Error(`Pinyin audio byte size mismatch: ${asset.localPath}`);
    }
  }
}

async function assertSingleExactRow(
  client: PoolClient,
  table: 'curriculum_versions' | 'media_assets' | 'pinyin_concepts',
  id: string,
  expected: Readonly<Record<string, unknown>>,
): Promise<void> {
  const result = await client.query<Record<string, unknown>>(
    `select * from public.${table} where id = $1`,
    [id],
  );
  const actual = result.rows[0];
  if (!actual) throw new Error(`Pinyin import row is missing after insert: ${table}/${id}`);
  for (const [key, value] of Object.entries(expected)) {
    const actualValue = actual[key];
    if (stableJson(actualValue) !== stableJson(value)) {
      throw new Error(`Pinyin import conflict at ${table}/${id}.${key}`);
    }
  }
}

export async function importApprovedPinyinContent(
  client: PoolClient,
  options: { repositoryRoot: string; content?: PinyinContentPackage },
): Promise<{ conceptCount: number; manifestSha256: string }> {
  const content = options.content ?? approvedPinyinContentFixture;
  const rows = buildPinyinConceptImportRows(content);
  await verifyPinyinBundledAudio(content, options.repositoryRoot);
  const digest = manifestSha256(content);

  await client.query(
    `insert into public.curriculum_versions (
       id, version, spoken_track, script_track, status, min_app_version,
       manifest_sha256, notes, published_at
     ) values ($1, $2, 'mandarin', 'simplified', 'review', $3, $4, $5, null)
     on conflict do nothing`,
    [
      PINYIN_CURRICULUM_VERSION_ID,
      PINYIN_CURRICULUM_VERSION,
      content.minimumAppVersion,
      digest,
      'Approved Pinyin persistence candidate imported from pinyin-content-v1.',
    ],
  );
  await assertSingleExactRow(client, 'curriculum_versions', PINYIN_CURRICULUM_VERSION_ID, {
    manifest_sha256: digest,
    min_app_version: content.minimumAppVersion,
    status: 'review',
    version: PINYIN_CURRICULUM_VERSION,
  });

  for (const asset of content.assets) {
    if (asset.kind !== 'audio' || asset.delivery !== 'bundled_file' || !asset.localPath) continue;
    const metadata = {
      attribution: asset.attribution,
      licenseIdentifier: asset.licenseIdentifier,
      sourceName: asset.sourceName,
      sourceReference: asset.sourceReference,
    };
    await client.query(
      `insert into public.media_assets (
         id, asset_key, storage_bucket, storage_path, mime_type, size_bytes, sha256,
         locale, alt_text_zh, metadata, is_published
       ) values ($1, $2, 'bundled', $3, 'audio/mpeg', $4, $5, $6, $7, $8::jsonb, false)
       on conflict do nothing`,
      [
        asset.id,
        `pinyin-${asset.localPath.match(/(ma[234])\.mp3$/)?.[1] ?? asset.id}-v1`,
        asset.localPath,
        bundledAssetSizes[asset.localPath],
        asset.sha256,
        asset.locale,
        `普通话拼音音频 ${asset.localPath.match(/ma[234]/)?.[0] ?? ''}`.trim(),
        JSON.stringify(metadata),
      ],
    );
    await assertSingleExactRow(client, 'media_assets', asset.id, {
      is_published: false,
      locale: asset.locale,
      metadata,
      sha256: asset.sha256,
      storage_path: asset.localPath,
    });
  }

  for (const row of rows) {
    await client.query(
      `insert into public.pinyin_concepts (
         id, curriculum_version_id, concept_code, kind, canonical_value, display_value,
         numbered_value, tone_number, initial_concept_id, final_concept_id, audio_asset_id,
         content_status, is_published, metadata
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'approved', false, $12::jsonb
       )
       on conflict do nothing`,
      [
        row.id,
        PINYIN_CURRICULUM_VERSION_ID,
        row.conceptCode,
        row.kind,
        row.canonicalValue,
        row.displayValue,
        row.numberedValue,
        row.toneNumber,
        row.initialConceptId,
        row.finalConceptId,
        row.audioAssetId,
        JSON.stringify(row.metadata),
      ],
    );
    await assertSingleExactRow(client, 'pinyin_concepts', row.id, {
      audio_asset_id: row.audioAssetId,
      canonical_value: row.canonicalValue,
      concept_code: row.conceptCode,
      content_status: 'approved',
      curriculum_version_id: PINYIN_CURRICULUM_VERSION_ID,
      display_value: row.displayValue,
      final_concept_id: row.finalConceptId,
      initial_concept_id: row.initialConceptId,
      is_published: false,
      kind: row.kind,
      numbered_value: row.numberedValue,
      tone_number: row.toneNumber,
    });
  }

  return { conceptCount: rows.length, manifestSha256: digest };
}
