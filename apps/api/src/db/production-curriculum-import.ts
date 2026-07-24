import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  approvedPinyinContentFixture,
  productionCurriculumReleaseV1,
  type ProductionCurriculumRelease,
} from '@hanziquest/curriculum';
import {
  validatePinyinContent,
  validateProductionCurriculumRelease,
} from '@hanziquest/content-validator';
import type { PoolClient } from 'pg';

import { buildPinyinConceptImportRows, verifyPinyinBundledAudio } from './pinyin-content-import.js';

export const PRODUCTION_RELEASE_IMPORT_VERSION = 'production-release-import-v1';

export class ProductionReleaseImportError extends Error {
  constructor(
    readonly code: 'CONTENT_INVALID' | 'HASH_MISMATCH' | 'MEDIA_UNAUTHORIZED' | 'RELEASE_CONFLICT',
    message: string,
  ) {
    super(message);
  }
}

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

export function productionReleaseManifestSha256(release: ProductionCurriculumRelease): string {
  return createHash('sha256')
    .update(stableJson({ pinyin: approvedPinyinContentFixture, release }))
    .digest('hex');
}

function productionPinyinId(id: string | null): string | null {
  return id?.replace(/^50000000-/, '82000000-') ?? null;
}

async function assertExistingRelease(
  client: PoolClient,
  release: ProductionCurriculumRelease,
  digest: string,
): Promise<boolean> {
  const result = await client.query<{
    import_status: string;
    manifest_sha256: string;
  }>(
    `select import_status, manifest_sha256
       from public.curriculum_release_imports
       where curriculum_version_id = $1`,
    [release.releaseId],
  );
  const existing = result.rows[0];
  if (!existing) return false;
  if (existing.manifest_sha256 !== digest) {
    throw new ProductionReleaseImportError(
      'HASH_MISMATCH',
      'The release ID already exists with a different manifest hash.',
    );
  }
  if (existing.import_status !== 'published') {
    throw new ProductionReleaseImportError(
      'RELEASE_CONFLICT',
      'The release ID exists but is not in the published terminal state.',
    );
  }
  return true;
}

async function insertMedia(
  client: PoolClient,
  release: ProductionCurriculumRelease,
  repositoryRoot: string,
): Promise<void> {
  for (const asset of release.media) {
    if (!asset.authorized) {
      throw new ProductionReleaseImportError(
        'MEDIA_UNAUTHORIZED',
        `Release media is not authorized: ${asset.assetKey}`,
      );
    }
    await client.query(
      `insert into public.media_assets (
         id, asset_key, storage_bucket, storage_path, mime_type, size_bytes, sha256,
         locale, alt_text_zh, metadata, is_published
       ) values ($1, $2, 'system', $3, 'application/x-system-tts', 0, $4, $5,
         '普通话系统语音', $6::jsonb, false)`,
      [
        asset.id,
        asset.assetKey,
        asset.sourceReference,
        createHash('sha256').update(asset.sourceReference).digest('hex'),
        asset.locale,
        JSON.stringify({
          authorized: asset.authorized,
          delivery: asset.delivery,
          licenseIdentifier: asset.licenseIdentifier,
        }),
      ],
    );
  }

  for (const asset of approvedPinyinContentFixture.assets) {
    if (asset.delivery !== 'bundled_file' || !asset.localPath || !asset.sha256) continue;
    const path = resolve(repositoryRoot, asset.localPath);
    const [bytes, details] = await Promise.all([readFile(path), stat(path)]);
    if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
      throw new ProductionReleaseImportError(
        'HASH_MISMATCH',
        `Bundled media hash mismatch: ${asset.localPath}`,
      );
    }
    await client.query(
      `insert into public.media_assets (
         id, asset_key, storage_bucket, storage_path, mime_type, size_bytes, sha256,
         locale, alt_text_zh, metadata, is_published
       ) values ($1, $2, 'bundled', $3, 'audio/mpeg', $4, $5, $6, $7, $8::jsonb, false)
       on conflict (id) do nothing`,
      [
        asset.id,
        `pinyin-${asset.localPath.match(/(ma[234])\.mp3$/)?.[1] ?? asset.id}-v1`,
        asset.localPath,
        details.size,
        asset.sha256,
        asset.locale,
        '普通话拼音音频',
        JSON.stringify({
          attribution: asset.attribution,
          licenseIdentifier: asset.licenseIdentifier,
          sourceName: asset.sourceName,
          sourceReference: asset.sourceReference,
        }),
      ],
    );
  }
}

export async function importProductionCurriculumRelease(
  client: PoolClient,
  options: {
    repositoryRoot: string;
    release?: ProductionCurriculumRelease;
  },
): Promise<{
  alreadyImported: boolean;
  manifestSha256: string;
  releaseId: string;
}> {
  const release = options.release ?? productionCurriculumReleaseV1;
  const releaseValidation = validateProductionCurriculumRelease(release);
  const pinyinValidation = validatePinyinContent(approvedPinyinContentFixture, {
    source: 'production-release:pinyin',
  });
  if (!releaseValidation.valid || !pinyinValidation.valid) {
    throw new ProductionReleaseImportError(
      'CONTENT_INVALID',
      'Production Curriculum validation failed.',
    );
  }
  await verifyPinyinBundledAudio(approvedPinyinContentFixture, options.repositoryRoot);
  const digest = productionReleaseManifestSha256(release);
  if (await assertExistingRelease(client, release, digest)) {
    return { alreadyImported: true, manifestSha256: digest, releaseId: release.releaseId };
  }

  await client.query(
    `insert into public.curriculum_versions (
       id, version, spoken_track, script_track, status, min_app_version,
       manifest_sha256, notes
     ) values ($1, $2, $3, $4, 'review', $5, $6, $7)`,
    [
      release.releaseId,
      release.version,
      release.spokenTrack,
      release.scriptTrack,
      release.minimumAppVersion,
      digest,
      'Formal production release imported by production-release-import-v1.',
    ],
  );
  await client.query(
    `insert into public.curriculum_release_imports (
       curriculum_version_id, release_schema_version, manifest_sha256,
       coverage_report, review_checklist_id, import_status
     ) values ($1, $2, $3, $4::jsonb, $5, 'staging')`,
    [
      release.releaseId,
      release.schemaVersion,
      digest,
      JSON.stringify(release.coverage),
      release.editorialReview.checklistId,
    ],
  );
  await insertMedia(client, release, options.repositoryRoot);

  const pinyinRows = buildPinyinConceptImportRows(approvedPinyinContentFixture);
  for (const row of pinyinRows) {
    await client.query(
      `insert into public.pinyin_concepts (
         id, curriculum_version_id, concept_code, kind, canonical_value, display_value,
         numbered_value, tone_number, initial_concept_id, final_concept_id, audio_asset_id,
         content_status, is_published, metadata
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
         'approved', false, $12::jsonb)`,
      [
        productionPinyinId(row.id),
        release.releaseId,
        row.conceptCode,
        row.kind,
        row.canonicalValue,
        row.displayValue,
        row.numberedValue,
        row.toneNumber,
        productionPinyinId(row.initialConceptId),
        productionPinyinId(row.finalConceptId),
        row.audioAssetId,
        JSON.stringify(row.metadata),
      ],
    );
  }

  await client.query(
    `insert into public.worlds (
       id, curriculum_version_id, slug, sort_order, title_zh, title_en, is_published
     ) values ($1, $2, $3, 0, $4, $5, false)`,
    [
      release.world.id,
      release.releaseId,
      release.world.slug,
      release.world.titleZh,
      release.world.titleEn,
    ],
  );
  await client.query(
    `insert into public.units (
       id, world_id, slug, sort_order, title_zh, title_en, is_published
     ) values ($1, $2, $3, 0, $4, $5, false)`,
    [
      release.unit.id,
      release.world.id,
      release.unit.slug,
      release.unit.titleZh,
      release.unit.titleEn,
    ],
  );
  for (const [index, lesson] of release.lessons.entries()) {
    await client.query(
      `insert into public.lessons (
         id, unit_id, slug, sort_order, title_zh, content_spec, is_published
       ) values ($1, $2, $3, $4, $5, $6::jsonb, false)`,
      [
        lesson.id,
        release.unit.id,
        lesson.slug,
        index,
        lesson.titleZh,
        JSON.stringify({ exercises: lesson.exercises }),
      ],
    );
    for (const [conceptIndex, concept] of lesson.concepts.entries()) {
      await client.query(
        `insert into public.lesson_concepts (
           lesson_id, concept_type, concept_id, role, sort_order
         ) values ($1, $2, $3, $4, $5)`,
        [lesson.id, concept.conceptType, concept.conceptId, concept.role, conceptIndex],
      );
    }
  }

  for (const character of release.characters) {
    await client.query(
      `insert into public.characters (
         id, concept_code, simplified_glyph, traditional_glyph, pinyin_syllables,
         meaning_zh, meaning_en, is_published
       ) values ($1, $2, $3, $4, array[$5], $6, $7, false)`,
      [
        character.id,
        character.code,
        character.simplified,
        character.traditional,
        character.pinyin,
        character.meaningZh,
        character.meaningEn,
      ],
    );
  }
  for (const word of release.words) {
    await client.query(
      `insert into public.words (
         id, concept_code, simplified_text, traditional_text, pinyin,
         canonical_pinyin, character_ids, is_published
       ) values ($1, $2, $3, $4, $5, $5, $6::uuid[], false)`,
      [word.id, word.code, word.simplified, word.traditional, word.pinyin, word.characterIds],
    );
  }
  for (const sentence of release.sentences) {
    await client.query(
      `insert into public.sentences (
         id, concept_code, simplified_text, traditional_text, word_ids,
         target_character_ids, canonical_pinyin, is_published
       ) values ($1, $2, $3, $4, $5::uuid[], $6::uuid[], $7, false)`,
      [
        sentence.id,
        sentence.code,
        sentence.simplified,
        sentence.traditional,
        sentence.wordIds,
        sentence.targetCharacterIds,
        `pinyin:${sentence.pinyin}`,
      ],
    );
  }
  for (const story of release.stories) {
    await client.query(
      `insert into public.stories (
         id, curriculum_version_id, concept_code, title_zh, title_en, script_track,
         source, sentences, questions, target_character_ids, validation_report,
         approved_at, is_published
       ) values ($1, $2, $3, $4, $5, 'simplified', 'editorial',
         $6::jsonb, $7::jsonb, $8::uuid[], $9::jsonb, now(), false)`,
      [
        story.id,
        release.releaseId,
        story.code,
        story.titleZh,
        story.titleEn,
        JSON.stringify(story.sentenceIds),
        JSON.stringify(story.questions),
        story.targetCharacterIds,
        JSON.stringify({ checklistId: release.editorialReview.checklistId }),
      ],
    );
  }

  await client.query(
    `update public.media_assets set is_published = true where id = any($1::uuid[])`,
    [
      [
        ...release.media.map((asset) => asset.id),
        ...approvedPinyinContentFixture.assets.map((asset) => asset.id),
      ],
    ],
  );
  await client.query(
    `update public.pinyin_concepts
       set content_status = 'published', is_published = true
       where curriculum_version_id = $1`,
    [release.releaseId],
  );
  await client.query(
    `update public.worlds set is_published = true where curriculum_version_id = $1`,
    [release.releaseId],
  );
  await client.query(`update public.units set is_published = true where world_id = $1`, [
    release.world.id,
  ]);
  await client.query(`update public.lessons set is_published = true where unit_id = $1`, [
    release.unit.id,
  ]);
  await client.query(
    `update public.characters set is_published = true where id = any($1::uuid[])`,
    [release.characters.map((item) => item.id)],
  );
  await client.query(`update public.words set is_published = true where id = any($1::uuid[])`, [
    release.words.map((item) => item.id),
  ]);
  await client.query(`update public.sentences set is_published = true where id = any($1::uuid[])`, [
    release.sentences.map((item) => item.id),
  ]);
  await client.query(
    `update public.stories set is_published = true where curriculum_version_id = $1`,
    [release.releaseId],
  );
  await client.query(
    `update public.curriculum_versions
       set status = 'published', published_at = now()
       where id = $1`,
    [release.releaseId],
  );
  await client.query(
    `update public.curriculum_release_imports
       set import_status = 'published', published_at = now()
       where curriculum_version_id = $1`,
    [release.releaseId],
  );
  await client.query(
    `insert into public.active_curriculum_releases (
       spoken_track, script_track, curriculum_version_id
     ) values ($1, $2, $3)
     on conflict (spoken_track, script_track) do update
       set curriculum_version_id = excluded.curriculum_version_id,
           activated_at = now()`,
    [release.spokenTrack, release.scriptTrack, release.releaseId],
  );
  return { alreadyImported: false, manifestSha256: digest, releaseId: release.releaseId };
}
