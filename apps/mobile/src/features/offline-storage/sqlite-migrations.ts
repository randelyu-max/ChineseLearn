export const SQLITE_SCHEMA_VERSION = 2;

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
]);
