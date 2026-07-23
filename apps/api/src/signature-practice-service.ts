import type {
  SignaturePracticeMetricEvent,
  SignaturePracticeSummary,
  SignatureProjectInput,
} from '@hanziquest/contracts';
import type { PoolClient } from 'pg';

type SummaryRow = {
  calculated_at: Date | null;
  chinese_name: string;
  direction_score: string | null;
  practice_count: number | string;
  project_id: string;
  proportion_score: string | null;
  rhythm_score: string | null;
  selected_style: SignaturePracticeSummary['selectedStyle'];
  structure_score: string | null;
};

type ExistingEventRow = {
  algorithm_version: string;
  direction_score: string | null;
  id: string;
  idempotency_key: string;
  occurred_at: Date;
  proportion_score: string | null;
  rhythm_score: string | null;
  signature_project_id: string;
  structure_score: string | null;
};

export type RecordPracticeResult =
  | Readonly<{ status: 'accepted' | 'duplicate'; summary: SignaturePracticeSummary }>
  | Readonly<{ status: 'conflict' | 'project_not_found'; summary: null }>;

function metric(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function inputMetric(value: number | undefined): number | null {
  return value === undefined ? null : Number(value.toFixed(4));
}

function mapSummary(row: SummaryRow): SignaturePracticeSummary {
  return {
    schemaVersion: 'signature-practice-summary-v1',
    calculatedAt: row.calculated_at?.toISOString() ?? null,
    practiceCount: Number(row.practice_count),
    projectId: row.project_id,
    scores: {
      direction: metric(row.direction_score),
      proportion: metric(row.proportion_score),
      rhythm: metric(row.rhythm_score),
      structure: metric(row.structure_score),
    },
    selectedStyle: row.selected_style,
  };
}

export async function loadSignaturePracticeSummary(
  client: PoolClient,
  userId: string,
  projectId: string,
): Promise<SignaturePracticeSummary | null> {
  const result = await client.query<SummaryRow>(
    `select
       p.id as project_id,
       p.chinese_name,
       p.selected_style,
       coalesce(s.practice_count, 0) as practice_count,
       s.structure_score::text,
       s.proportion_score::text,
       s.direction_score::text,
       s.rhythm_score::text,
       s.calculated_at
     from public.signature_projects p
     left join public.signature_practice_summaries s
       on s.user_id = p.user_id and s.signature_project_id = p.id
     where p.user_id = $1 and p.id = $2`,
    [userId, projectId],
  );
  return result.rows[0] ? mapSummary(result.rows[0]) : null;
}

export async function upsertSignatureProject(
  client: PoolClient,
  userId: string,
  input: SignatureProjectInput,
): Promise<SignaturePracticeSummary | null> {
  const inserted = await client.query<{ id: string }>(
    `insert into public.signature_projects (id, user_id, chinese_name, selected_style)
     select $2, $1, p.chinese_name, $4
     from public.profiles p
     where p.id = $1 and p.chinese_name = $3
     on conflict (id) do update set
       chinese_name = excluded.chinese_name,
       selected_style = excluded.selected_style
     where public.signature_projects.user_id = excluded.user_id
     returning id`,
    [userId, input.projectId, input.chineseName, input.selectedStyle],
  );
  if (!inserted.rows[0]) return null;
  return loadSignaturePracticeSummary(client, userId, input.projectId);
}

function eventMatches(row: ExistingEventRow, input: SignaturePracticeMetricEvent): boolean {
  const scores = input.metrics;
  return (
    row.id === input.eventId &&
    row.idempotency_key === input.idempotencyKey &&
    row.signature_project_id === input.projectId &&
    row.algorithm_version === input.algorithmVersion &&
    row.occurred_at.toISOString() === input.occurredAt &&
    metric(row.direction_score) === inputMetric(scores?.direction) &&
    metric(row.proportion_score) === inputMetric(scores?.proportion) &&
    metric(row.rhythm_score) === inputMetric(scores?.rhythm) &&
    metric(row.structure_score) === inputMetric(scores?.structure)
  );
}

export async function recordSignaturePractice(
  client: PoolClient,
  userId: string,
  input: SignaturePracticeMetricEvent,
): Promise<RecordPracticeResult> {
  const project = await client.query<{ id: string }>(
    `select id
     from public.signature_projects
     where user_id = $1 and id = $2
     for update`,
    [userId, input.projectId],
  );
  if (!project.rows[0]) return { status: 'project_not_found', summary: null };

  const scores = input.metrics;
  const inserted = await client.query<{ id: string }>(
    `insert into public.signature_practice_events (
       id, user_id, signature_project_id, idempotency_key, algorithm_version,
       structure_score, proportion_score, direction_score, rhythm_score, occurred_at
     ) values ($2, $1, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict do nothing
     returning id`,
    [
      userId,
      input.eventId,
      input.projectId,
      input.idempotencyKey,
      input.algorithmVersion,
      inputMetric(scores?.structure),
      inputMetric(scores?.proportion),
      inputMetric(scores?.direction),
      inputMetric(scores?.rhythm),
      input.occurredAt,
    ],
  );
  if (!inserted.rows[0]) {
    const existing = await client.query<ExistingEventRow>(
      `select
         id, idempotency_key, signature_project_id, algorithm_version,
         structure_score::text, proportion_score::text, direction_score::text,
         rhythm_score::text, occurred_at
       from public.signature_practice_events
       where user_id = $1 and (id = $2 or idempotency_key = $3)
       order by created_at, id`,
      [userId, input.eventId, input.idempotencyKey],
    );
    if (existing.rows.length !== 1 || !eventMatches(existing.rows[0]!, input)) {
      return { status: 'conflict', summary: null };
    }
    const summary = await loadSignaturePracticeSummary(client, userId, input.projectId);
    return summary
      ? { status: 'duplicate', summary }
      : { status: 'project_not_found', summary: null };
  }

  const summary = await loadSignaturePracticeSummary(client, userId, input.projectId);
  if (!summary) return { status: 'project_not_found', summary: null };
  return { status: 'accepted', summary };
}
