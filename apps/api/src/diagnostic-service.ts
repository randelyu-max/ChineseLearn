import {
  DiagnosticRunSchema,
  type DiagnosticMutation,
  type DiagnosticRun,
} from '@hanziquest/contracts';
import type { PoolClient } from 'pg';

type DiagnosticRow = {
  algorithm_version: string;
  completed_at: Date | null;
  content_version: string;
  id: string;
  result_summary: unknown;
  skipped_at: Date | null;
  started_at: Date;
  status: 'completed' | 'in_progress' | 'skipped';
};

function mapRun(row: DiagnosticRow): DiagnosticRun {
  return DiagnosticRunSchema.parse({
    schemaVersion: 'diagnostic-run-v1',
    runId: row.id,
    status: row.status,
    algorithmVersion: row.algorithm_version,
    contentVersion: row.content_version,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    skippedAt: row.skipped_at?.toISOString() ?? null,
    result: row.result_summary,
  });
}

async function findRun(
  client: PoolClient,
  userId: string,
  runId?: string,
): Promise<DiagnosticRun | null> {
  const result = await client.query<DiagnosticRow>(
    `select
       id, status, algorithm_version, content_version, started_at,
       completed_at, skipped_at, result_summary
     from public.diagnostic_runs
     where user_id = $1
       and ($2::uuid is null or id = $2)
     order by
       case status when 'in_progress' then 0 when 'completed' then 1 else 2 end,
       coalesce(completed_at, skipped_at, started_at) desc,
       id desc
     limit 1`,
    [userId, runId ?? null],
  );
  return result.rows[0] ? mapRun(result.rows[0]) : null;
}

export function loadDiagnosticRun(
  client: PoolClient,
  userId: string,
): Promise<DiagnosticRun | null> {
  return findRun(client, userId);
}

export async function mutateDiagnosticRun(
  client: PoolClient,
  userId: string,
  mutation: DiagnosticMutation,
): Promise<DiagnosticRun | null> {
  await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [userId]);
  const existing = await findRun(client, userId, mutation.runId);
  if (existing && existing.status !== 'in_progress') return existing;

  if (mutation.action === 'start') {
    if (existing) return existing;
    const active = await client.query<DiagnosticRow>(
      `select
         id, status, algorithm_version, content_version, started_at,
         completed_at, skipped_at, result_summary
       from public.diagnostic_runs
       where user_id = $1 and status = 'in_progress'
       limit 1`,
      [userId],
    );
    if (active.rows[0]) return mapRun(active.rows[0]);
    await client.query(
      `insert into public.diagnostic_runs (
         id, user_id, status, algorithm_version, content_version,
         start_idempotency_key, started_at
       ) values ($2, $1, 'in_progress', $3, $4, $5, $6)`,
      [
        userId,
        mutation.runId,
        mutation.algorithmVersion,
        mutation.contentVersion,
        mutation.idempotencyKey,
        mutation.startedAt,
      ],
    );
    return findRun(client, userId, mutation.runId);
  }

  if (!existing) return null;
  if (mutation.action === 'skip') {
    await client.query(
      `update public.diagnostic_runs
       set status = 'skipped', skipped_at = transaction_timestamp(),
           terminal_idempotency_key = $3
       where user_id = $1 and id = $2 and status = 'in_progress'`,
      [userId, mutation.runId, mutation.idempotencyKey],
    );
  } else {
    await client.query(
      `update public.diagnostic_runs
       set status = 'completed', completed_at = transaction_timestamp(),
           terminal_idempotency_key = $3, result_summary = $4,
           recommended_starting_point = $5,
           recommended_pinyin_support_mode = $6
       where user_id = $1 and id = $2 and status = 'in_progress'`,
      [
        userId,
        mutation.runId,
        mutation.idempotencyKey,
        mutation.result,
        mutation.result.recommendedStartingPoint,
        mutation.result.recommendedPinyinSupportMode,
      ],
    );
  }
  return findRun(client, userId, mutation.runId);
}
