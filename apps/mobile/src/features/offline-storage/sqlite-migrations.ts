export const SQLITE_SCHEMA_VERSION = 3;

export const SQLITE_MIGRATIONS = Object.freeze([
  {
    from: 0,
    to: 1,
    sql: `
      create table if not exists local_content_cache (
        content_version text primary key not null,
        schema_version text not null,
        payload_json text not null,
        cached_at text not null
      );
      create table if not exists local_session_snapshots (
        session_id text primary key not null,
        schema_version text not null,
        payload_json text not null,
        updated_at text not null
      );
      create table if not exists local_attempt_outbox (
        attempt_id text primary key not null,
        session_id text not null,
        offline_sequence integer not null,
        payload_json text not null,
        state text not null check (state in ('pending', 'in_flight', 'corrupt')),
        retry_count integer not null default 0 check (retry_count >= 0),
        created_at text not null,
        updated_at text not null
      );
      create table if not exists local_sync_cursors (
        scope text primary key not null,
        cursor text not null,
        updated_at text not null
      );
    `,
  },
  {
    from: 1,
    to: 2,
    sql: `
      alter table local_attempt_outbox add column last_error_code text;
      create index if not exists local_attempt_outbox_pending_idx
        on local_attempt_outbox (state, offline_sequence, created_at);
    `,
  },
  {
    from: 2,
    to: 3,
    sql: `
      create table if not exists local_formal_session_snapshots (
        user_id text not null,
        session_id text not null,
        snapshot_schema_version text not null,
        status text not null check (status in ('planned', 'in_progress', 'completed', 'abandoned')),
        payload_json text not null,
        updated_at text not null,
        primary key (user_id, session_id, snapshot_schema_version)
      );
      create index if not exists local_formal_session_active_user_idx
        on local_formal_session_snapshots (user_id, updated_at)
        where status in ('planned', 'in_progress');
      create table if not exists local_attempt_outbox_v2 (
        attempt_id text primary key not null,
        user_id text not null,
        session_id text not null,
        session_activity_id text not null,
        offline_sequence integer not null,
        occurred_at text not null,
        payload_json text not null,
        state text not null check (state in ('pending', 'in_flight', 'rejected', 'corrupt')),
        retry_count integer not null default 0 check (retry_count >= 0),
        last_error_code text,
        created_at text not null,
        updated_at text not null
      );
      create index if not exists local_attempt_outbox_v2_pending_idx
        on local_attempt_outbox_v2 (
          user_id, state, occurred_at, offline_sequence, attempt_id
        );
      create table if not exists local_formal_session_quarantine (
        cache_key text primary key not null,
        user_id text,
        session_id text,
        reason_code text not null,
        quarantined_at text not null
      );
    `,
  },
]);
