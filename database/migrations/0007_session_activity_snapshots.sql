-- Task 8.2C-A additive Session Activity V2 foundation.
-- V1 sessions remain readable and keep nullable V2 metadata. Runtime creation is intentionally
-- deferred to Task 8.2C-C. Rollback is application-level: stop creating V2 sessions and retain
-- these immutable rows. Never rewrite 0001-0006 or drop published data in place.

alter table public.learning_sessions
  add column intent text not null default 'learn',
  add column snapshot_schema_version text,
  add column content_manifest_sha256 text,
  add column humor_content_version text,
  add constraint learning_sessions_intent_check
    check (intent in ('learn', 'review')),
  add constraint learning_sessions_snapshot_schema_version_check
    check (
      snapshot_schema_version is null
      or snapshot_schema_version = 'session-plan-snapshot-v2'
    ),
  add constraint learning_sessions_content_manifest_sha256_check
    check (
      content_manifest_sha256 is null
      or content_manifest_sha256 ~ '^[a-f0-9]{64}$'
    ),
  add constraint learning_sessions_humor_content_version_check
    check (
      humor_content_version is null
      or char_length(btrim(humor_content_version)) between 1 and 64
    ),
  add constraint learning_sessions_v2_metadata_check
    check (
      (
        snapshot_schema_version is null
        and content_manifest_sha256 is null
        and humor_content_version is null
      )
      or (
        snapshot_schema_version = 'session-plan-snapshot-v2'
        and content_manifest_sha256 is not null
      )
    );

create table public.learning_session_activities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references public."user"(id) on delete cascade,
  position smallint not null check (position between 0 and 19),
  source_exercise_id text not null check (
    char_length(source_exercise_id) between 1 and 160
    and source_exercise_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  exercise_type text not null check (
    exercise_type in (
      'audio_to_glyph',
      'glyph_to_image',
      'word_build',
      'sentence_order',
      'audio_to_pinyin',
      'pinyin_to_audio',
      'pinyin_to_glyph',
      'glyph_to_pinyin',
      'tone_choice',
      'pinyin_syllable_build'
    )
  ),
  content_ref text not null check (
    char_length(content_ref) between 1 and 160
    and content_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  content_version text not null check (
    char_length(btrim(content_version)) between 1 and 64
  ),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  exercise_snapshot jsonb not null check (
    jsonb_typeof(exercise_snapshot) = 'object'
    and exercise_snapshot ->> 'schemaVersion' = 'learning-exercise-v2'
    and exercise_snapshot ->> 'activityId' = source_exercise_id
    and exercise_snapshot ->> 'type' = exercise_type
  ),
  evidence_targets jsonb not null check (
    jsonb_typeof(evidence_targets) = 'array'
    and jsonb_array_length(evidence_targets) between 1 and 20
  ),
  pinyin_support jsonb check (
    pinyin_support is null or jsonb_typeof(pinyin_support) = 'object'
  ),
  humor_content_ref text check (
    humor_content_ref is null
    or (
      char_length(humor_content_ref) between 1 and 160
      and humor_content_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
    )
  ),
  estimated_seconds smallint not null check (estimated_seconds between 10 and 300),
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id) on delete cascade,
  unique (session_id, position),
  unique (id, session_id, user_id)
);

create index learning_session_activities_user_session_idx
  on public.learning_session_activities (user_id, session_id, position);

create function public.prevent_learning_session_activity_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'learning session activity snapshots are immutable'
    using errcode = '23514';
end;
$$;

create trigger learning_session_activities_immutable
before update on public.learning_session_activities
for each row execute function public.prevent_learning_session_activity_mutation();

create or replace function public.prevent_learning_session_plan_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.client_session_id is distinct from old.client_session_id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.curriculum_version_id is distinct from old.curriculum_version_id
    or new.lesson_id is distinct from old.lesson_id
    or new.intent is distinct from old.intent
    or new.snapshot_schema_version is distinct from old.snapshot_schema_version
    or new.content_manifest_sha256 is distinct from old.content_manifest_sha256
    or new.humor_content_version is distinct from old.humor_content_version
    or new.target_minutes is distinct from old.target_minutes
    or new.plan_version is distinct from old.plan_version
    or new.plan is distinct from old.plan
    or new.created_at is distinct from old.created_at
  then
    raise exception 'learning session plan snapshots are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

grant select on public.learning_session_activities to hanziquest_app;
revoke insert, update, delete on public.learning_session_activities from hanziquest_app;

alter table public.learning_session_activities enable row level security;
alter table public.learning_session_activities force row level security;
create policy learning_session_activities_own
  on public.learning_session_activities
  for select
  using (user_id = public.current_app_user_id());
