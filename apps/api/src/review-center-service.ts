import {
  REVIEW_CENTER_CURSOR_SCHEMA_VERSION,
  REVIEW_CENTER_SCHEMA_VERSION,
  ReviewCenterCursorPayloadSchema,
  ReviewCenterResponseDataSchema,
  reviewCenterKinds,
  type ReviewCenterItem,
  type ReviewCenterKind,
  type ReviewCenterQuery,
  type ReviewCenterReasonCode,
  type ReviewCenterResponseData,
} from '@hanziquest/contracts';
import type { PoolClient } from 'pg';

const MAX_REVIEW_SOURCE_ROWS = 5_000;

export type ReviewCenterPagination = Readonly<{
  generatedAt: Date;
  limit: number;
  offset: number;
}>;

export type ReviewCenterSourceRow = Readonly<{
  source: 'schedule' | 'confusion';
  reviewKey: string;
  kind: ReviewCenterKind;
  contentRef: string;
  displayLabel: string;
  secondaryLabel: string | null;
  dueAt: Date;
  reasonCode: ReviewCenterReasonCode;
  estimatedSeconds: number;
  recommendedActivityType: string | null;
  recommendedPinyinPolicy: 'always' | 'adaptive' | 'tap_to_reveal' | 'hidden' | null;
  relatedContentRefs: readonly string[];
}>;

type DatabaseReviewRow = {
  source: 'schedule' | 'confusion';
  review_key: string;
  kind: ReviewCenterKind;
  content_ref: string;
  display_label: string;
  secondary_label: string | null;
  due_at: Date;
  reason_code: ReviewCenterReasonCode;
  estimated_seconds: number;
  recommended_activity_type: string | null;
  recommended_pinyin_policy: 'always' | 'adaptive' | 'tap_to_reveal' | 'hidden' | null;
  related_content_refs: string[];
};

export class ReviewCenterCursorError extends Error {}
export class ReviewCenterCapacityError extends Error {}

function encodeCursor(generatedAt: Date, offset: number): string {
  return Buffer.from(
    JSON.stringify({
      schemaVersion: REVIEW_CENTER_CURSOR_SCHEMA_VERSION,
      generatedAt: generatedAt.toISOString(),
      offset,
    }),
    'utf8',
  ).toString('base64url');
}

function decodeCursor(cursor: string) {
  try {
    return ReviewCenterCursorPayloadSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
  } catch {
    throw new ReviewCenterCursorError('The review-center cursor is invalid.');
  }
}

export function resolveReviewCenterPagination(
  query: ReviewCenterQuery,
  now: Date,
): ReviewCenterPagination {
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    return Object.freeze({
      generatedAt: new Date(cursor.generatedAt),
      limit: query.limit,
      offset: cursor.offset,
    });
  }
  if (!Number.isFinite(now.getTime())) {
    throw new ReviewCenterCursorError('The review-center clock is invalid.');
  }
  return Object.freeze({ generatedAt: new Date(now), limit: query.limit, offset: 0 });
}

function sourceComparator(left: ReviewCenterSourceRow, right: ReviewCenterSourceRow): number {
  return (
    left.dueAt.getTime() - right.dueAt.getTime() || left.reviewKey.localeCompare(right.reviewKey)
  );
}

function itemComparator(
  left: ReviewCenterSourceRow,
  right: ReviewCenterSourceRow,
  generatedAt: Date,
): number {
  const leftOverdue = left.dueAt.getTime() < generatedAt.getTime();
  const rightOverdue = right.dueAt.getTime() < generatedAt.getTime();
  return Number(rightOverdue) - Number(leftOverdue) || sourceComparator(left, right);
}

function uniqueByContentRef(rows: readonly ReviewCenterSourceRow[]): ReviewCenterSourceRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.contentRef)) return false;
    seen.add(row.contentRef);
    return true;
  });
}

function uniqueConfusions(rows: readonly ReviewCenterSourceRow[]): ReviewCenterSourceRow[] {
  const seenPairs = new Set<string>();
  const coveredConcepts = new Set<string>();
  return rows.filter((row) => {
    if (
      seenPairs.has(row.contentRef) ||
      row.relatedContentRefs.some((contentRef) => coveredConcepts.has(contentRef))
    ) {
      return false;
    }
    seenPairs.add(row.contentRef);
    for (const contentRef of row.relatedContentRefs) coveredConcepts.add(contentRef);
    return true;
  });
}

function dueRows(
  sourceRows: readonly ReviewCenterSourceRow[],
  generatedAt: Date,
): ReviewCenterSourceRow[] {
  const due = sourceRows
    .filter((row) => row.dueAt.getTime() <= generatedAt.getTime())
    .sort(sourceComparator);
  const confusions = uniqueConfusions(due.filter((row) => row.source === 'confusion'));
  const confusionConceptRefs = new Set(confusions.flatMap((row) => row.relatedContentRefs));
  const scheduled = uniqueByContentRef(
    due.filter((row) => row.source === 'schedule' && !confusionConceptRefs.has(row.contentRef)),
  );
  return [...confusions, ...scheduled].sort((left, right) =>
    itemComparator(left, right, generatedAt),
  );
}

function responseItem(row: ReviewCenterSourceRow, generatedAt: Date): ReviewCenterItem {
  return {
    reviewKey: row.reviewKey,
    kind: row.kind,
    contentRef: row.contentRef,
    displayLabel: row.displayLabel,
    ...(row.secondaryLabel ? { secondaryLabel: row.secondaryLabel } : {}),
    dueAt: row.dueAt.toISOString(),
    isOverdue: row.dueAt.getTime() < generatedAt.getTime(),
    reasonCode: row.reasonCode,
    estimatedSeconds: row.estimatedSeconds,
    ...(row.recommendedActivityType
      ? { recommendedActivityType: row.recommendedActivityType }
      : {}),
    ...(row.recommendedPinyinPolicy
      ? { recommendedPinyinPolicy: row.recommendedPinyinPolicy }
      : {}),
  };
}

export function buildReviewCenterResponse(
  sourceRows: readonly ReviewCenterSourceRow[],
  pagination: ReviewCenterPagination,
): ReviewCenterResponseData {
  const due = dueRows(sourceRows, pagination.generatedAt);
  const items = due.slice(pagination.offset, pagination.offset + pagination.limit);
  const nextOffset = pagination.offset + items.length;
  const hasMore = nextOffset < due.length;
  const groups = reviewCenterKinds.map((kind) => {
    const matching = due.filter((row) => row.kind === kind);
    return {
      kind,
      count: matching.length,
      overdueCount: matching.filter((row) => row.dueAt.getTime() < pagination.generatedAt.getTime())
        .length,
    };
  });
  const nextDueAt =
    sourceRows
      .filter((row) => row.dueAt.getTime() > pagination.generatedAt.getTime())
      .sort(sourceComparator)[0]
      ?.dueAt.toISOString() ?? null;

  return ReviewCenterResponseDataSchema.parse({
    schemaVersion: REVIEW_CENTER_SCHEMA_VERSION,
    generatedAt: pagination.generatedAt.toISOString(),
    summary: {
      dueNowCount: due.length,
      overdueCount: due.filter((row) => row.dueAt.getTime() < pagination.generatedAt.getTime())
        .length,
      estimatedMinutes:
        due.length === 0
          ? 0
          : Math.ceil(due.reduce((total, row) => total + row.estimatedSeconds, 0) / 60),
      nextDueAt,
    },
    groups,
    items: items.map((row) => responseItem(row, pagination.generatedAt)),
    pageInfo: {
      nextCursor: hasMore ? encodeCursor(pagination.generatedAt, nextOffset) : null,
      hasMore,
    },
  });
}

function sourceRow(row: DatabaseReviewRow): ReviewCenterSourceRow {
  return Object.freeze({
    source: row.source,
    reviewKey: row.review_key,
    kind: row.kind,
    contentRef: row.content_ref,
    displayLabel: row.display_label,
    secondaryLabel: row.secondary_label,
    dueAt: row.due_at,
    reasonCode: row.reason_code,
    estimatedSeconds: row.estimated_seconds,
    recommendedActivityType: row.recommended_activity_type,
    recommendedPinyinPolicy: row.recommended_pinyin_policy,
    relatedContentRefs: Object.freeze(row.related_content_refs),
  });
}

export async function loadReviewCenter(
  client: PoolClient,
  userId: string,
  pagination: ReviewCenterPagination,
): Promise<ReviewCenterResponseData> {
  const result = await client.query<DatabaseReviewRow>(
    `with profile_settings as (
       select script_preference, pinyin_support_mode
       from public.profiles
       where id = $1
     ),
     active_curriculum as (
       select id
       from public.curriculum_versions
       where status = 'published'
       order by published_at desc nulls last, created_at desc, id
       limit 1
     ),
     published_lessons as (
       select l.id
       from public.lessons l
       join public.units u on u.id = l.unit_id and u.is_published
       join public.worlds w on w.id = u.world_id and w.is_published
       join active_curriculum ac on ac.id = w.curriculum_version_id
       where l.is_published
     ),
     published_concepts as (
       select
         'character'::text as concept_type,
         c.id as concept_id,
         'character:' || c.id::text as content_ref,
         case
           when ps.script_preference = 'traditional'
             then coalesce(nullif(c.traditional_glyph, ''), c.simplified_glyph)
           else c.simplified_glyph
         end as display_label,
         nullif(array_to_string(c.pinyin_syllables, ' '), '') as secondary_label
       from public.characters c
       cross join profile_settings ps
       where c.is_published
         and exists (
           select 1
           from public.lesson_concepts lc
           join published_lessons pl on pl.id = lc.lesson_id
           where lc.concept_type = 'character' and lc.concept_id = c.id
         )
       union all
       select
         'word',
         w.id,
         'word:' || w.id::text,
         case
           when ps.script_preference = 'traditional'
             then coalesce(nullif(w.traditional_text, ''), w.simplified_text)
           else w.simplified_text
         end,
         nullif(w.pinyin, '')
       from public.words w
       cross join profile_settings ps
       where w.is_published
         and exists (
           select 1
           from public.lesson_concepts lc
           join published_lessons pl on pl.id = lc.lesson_id
           where lc.concept_type = 'word' and lc.concept_id = w.id
         )
       union all
       select
         'sentence',
         s.id,
         'sentence:' || s.id::text,
         case
           when ps.script_preference = 'traditional'
             then coalesce(nullif(s.traditional_text, ''), s.simplified_text)
           else s.simplified_text
         end,
         null::text
       from public.sentences s
       cross join profile_settings ps
       where s.is_published
         and exists (
           select 1
           from public.lesson_concepts lc
           join published_lessons pl on pl.id = lc.lesson_id
           where lc.concept_type = 'sentence' and lc.concept_id = s.id
         )
       union all
       select
         'story',
         s.id,
         'story:' || s.id::text,
         s.title_zh,
         nullif(s.title_en, '')
       from public.stories s
       join active_curriculum ac on ac.id = s.curriculum_version_id
       where s.is_published and s.approved_at is not null
         and exists (
           select 1
           from public.lesson_concepts lc
           join published_lessons pl on pl.id = lc.lesson_id
           where lc.concept_type = 'story' and lc.concept_id = s.id
         )
     ),
     latest_attempts as (
       select distinct on (concept_type, concept_id, skill)
         concept_type::text as concept_type,
         concept_id,
         skill::text as skill,
         correct
       from public.attempts
       where user_id = $1
       order by concept_type, concept_id, skill, device_event_at desc, received_at desc, id desc
     ),
     scheduled as (
       select
         'schedule'::text as source,
         'review:' || r.concept_type::text || ':' || r.concept_id::text || ':' ||
           r.skill::text as review_key,
         case
           when r.skill::text = 'glyph_to_sound' then 'pinyin'
           when pc.concept_type = 'character' then 'hanzi'
           when pc.concept_type = 'word' then 'word'
           else 'sentence'
         end as kind,
         pc.content_ref,
         pc.display_label,
         pc.secondary_label,
         r.due_at,
         case
           when r.skill::text = 'glyph_to_sound' then 'pinyin_dependency'
           when la.correct = false or r.due_reason = 'lapse_or_full_hint' then 'recent_error'
           when r.due_reason in ('retrieval_success', 'low_effective_mastery')
             or ss.stable_mastery_at is not null then 'stability_check'
           else 'scheduled_review'
         end as reason_code,
         case
           when r.skill::text = 'glyph_to_sound' then 50
           when pc.concept_type = 'character' then 60
           when pc.concept_type = 'word' then 75
           else 90
         end as estimated_seconds,
         r.skill::text as recommended_activity_type,
         (select pinyin_support_mode from profile_settings) as recommended_pinyin_policy,
         '{}'::text[] as related_content_refs
       from public.review_schedule r
       join published_concepts pc
         on pc.concept_type = r.concept_type::text and pc.concept_id = r.concept_id
       left join latest_attempts la
         on la.concept_type = r.concept_type::text
        and la.concept_id = r.concept_id
        and la.skill = r.skill::text
       left join public.skill_states ss
         on ss.user_id = r.user_id
        and ss.concept_type = r.concept_type
        and ss.concept_id = r.concept_id
        and ss.skill = r.skill
       where r.user_id = $1
     ),
     confusions as (
       select
         'confusion'::text as source,
         'confusion:' || cp.id::text as review_key,
         'confusion'::text as kind,
         'confusion:' || cp.id::text as content_ref,
         left_pc.display_label || ' / ' || right_pc.display_label as display_label,
         nullif(concat_ws(' / ', left_pc.secondary_label, right_pc.secondary_label), '')
           as secondary_label,
         cs.next_practice_at as due_at,
         'confusion_pair'::text as reason_code,
         80 as estimated_seconds,
         null::text as recommended_activity_type,
         (select pinyin_support_mode from profile_settings) as recommended_pinyin_policy,
         array[left_pc.content_ref, right_pc.content_ref]::text[] as related_content_refs
       from public.confusion_stats cs
       join public.confusable_pairs cp on cp.id = cs.pair_id and cp.is_published
       join published_concepts left_pc
         on left_pc.concept_type = 'character' and left_pc.concept_id = cp.left_character_id
       join published_concepts right_pc
         on right_pc.concept_type = 'character' and right_pc.concept_id = cp.right_character_id
       where cs.user_id = $1 and cs.next_practice_at is not null
     ),
     source_rows as (
       select * from scheduled
       union all
       select * from confusions
     )
     select
       source,
       review_key,
       kind,
       content_ref,
       display_label,
       secondary_label,
       due_at,
       reason_code,
       estimated_seconds,
       recommended_activity_type,
       recommended_pinyin_policy,
       related_content_refs
     from source_rows
     order by due_at, review_key
     limit $2`,
    [userId, MAX_REVIEW_SOURCE_ROWS + 1],
  );
  if (result.rows.length > MAX_REVIEW_SOURCE_ROWS) {
    throw new ReviewCenterCapacityError('The review-center source row limit was exceeded.');
  }
  return buildReviewCenterResponse(result.rows.map(sourceRow), pagination);
}
