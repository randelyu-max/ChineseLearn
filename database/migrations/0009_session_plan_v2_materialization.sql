-- Task 8.2C-C atomic Session Plan V2 materialization and persisted idempotency outcomes.
-- Empty/unsafe outcomes write only an immutable receipt, never an empty Session or Activity.
-- Rollback is application-level: stop V2 planning while retaining immutable snapshots/evidence.

create table public.learning_session_plan_v2_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  user_id uuid not null references public."user"(id) on delete cascade,
  client_session_id uuid not null,
  idempotency_key text not null check (
    char_length(idempotency_key) between 16 and 128
    and idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  intent text not null check (intent in ('learn', 'review')),
  result_kind text not null check (
    result_kind in (
      'planned',
      'active_session_exists',
      'nothing_due',
      'insufficient_safe_content'
    )
  ),
  result_snapshot jsonb not null check (
    jsonb_typeof(result_snapshot) = 'object'
    and result_snapshot ->> 'schemaVersion' = 'session-plan-result-v2'
    and result_snapshot ->> 'result' = result_kind
    and (
      (
        result_kind in ('planned', 'active_session_exists')
        and session_id is not null
        and result_snapshot #>> '{session,sessionId}' = session_id::text
      )
      or (
        result_kind in ('nothing_due', 'insufficient_safe_content')
        and session_id is null
        and result_snapshot -> 'session' = 'null'::jsonb
      )
    )
  ),
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id) on delete cascade,
  unique (user_id, idempotency_key),
  unique (user_id, client_session_id)
);

create index learning_session_plan_v2_events_user_session_idx
  on public.learning_session_plan_v2_events (user_id, session_id, created_at, id);

create function public.prevent_learning_session_plan_v2_event_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Session Plan V2 events are immutable' using errcode = '23514';
end;
$$;

create trigger learning_session_plan_v2_events_immutable
before update on public.learning_session_plan_v2_events
for each row execute function public.prevent_learning_session_plan_v2_event_mutation();

create function public.materialize_learning_session_v2(
  p_session_id uuid,
  p_client_session_id uuid,
  p_idempotency_key text,
  p_curriculum_version_id uuid,
  p_intent text,
  p_target_minutes smallint,
  p_plan_version text,
  p_content_manifest_sha256 text,
  p_humor_content_version text,
  p_created_at timestamptz,
  p_plan jsonb,
  p_activities jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  app_user_id uuid := public.current_app_user_id();
  activity jsonb;
begin
  if app_user_id is null then
    raise exception 'authenticated application user is required' using errcode = '42501';
  end if;
  if p_intent not in ('learn', 'review')
    or jsonb_typeof(p_plan) <> 'object'
    or p_plan ->> 'schemaVersion' <> 'session-plan-snapshot-v2'
    or p_plan ->> 'sessionId' <> p_session_id::text
    or p_plan ->> 'clientSessionId' <> p_client_session_id::text
    or p_plan ->> 'intent' <> p_intent
    or p_plan ->> 'curriculumVersionId' <> p_curriculum_version_id::text
    or p_plan ->> 'contentManifestSha256' <> p_content_manifest_sha256
    or (p_plan ->> 'targetMinutes')::smallint <> p_target_minutes
    or p_plan ->> 'planningAlgorithmVersion' <> p_plan_version
    or (p_plan ->> 'createdAt')::timestamptz <> p_created_at
    or coalesce(p_plan ->> 'humorContentVersion', '')
      <> coalesce(p_humor_content_version, '')
    or jsonb_typeof(p_activities) <> 'array'
    or jsonb_typeof(p_plan -> 'activities') <> 'array'
    or jsonb_array_length(p_activities) not between 1 and 20
    or p_plan -> 'activities' <> p_activities
  then
    raise exception 'invalid Session Plan V2 materialization payload' using errcode = '23514';
  end if;

  insert into public.learning_sessions (
    id,
    user_id,
    client_session_id,
    idempotency_key,
    curriculum_version_id,
    lesson_id,
    intent,
    status,
    target_minutes,
    plan_version,
    plan,
    snapshot_schema_version,
    content_manifest_sha256,
    humor_content_version,
    created_at,
    updated_at
  ) values (
    p_session_id,
    app_user_id,
    p_client_session_id,
    p_idempotency_key,
    p_curriculum_version_id,
    null,
    p_intent,
    'planned',
    p_target_minutes,
    p_plan_version,
    p_plan,
    'session-plan-snapshot-v2',
    p_content_manifest_sha256,
    p_humor_content_version,
    p_created_at,
    p_created_at
  );

  for activity in select value from jsonb_array_elements(p_activities)
  loop
    insert into public.learning_session_activities (
      id,
      session_id,
      user_id,
      position,
      source_exercise_id,
      exercise_type,
      content_ref,
      content_version,
      content_sha256,
      exercise_snapshot,
      evidence_targets,
      pinyin_support,
      humor_content_ref,
      estimated_seconds,
      created_at
    ) values (
      (activity ->> 'sessionActivityId')::uuid,
      p_session_id,
      app_user_id,
      (activity ->> 'position')::smallint,
      activity ->> 'sourceExerciseId',
      activity ->> 'exerciseType',
      activity ->> 'contentRef',
      activity ->> 'contentVersion',
      activity ->> 'contentSha256',
      activity -> 'exercise',
      activity -> 'evidenceTargets',
      nullif(activity -> 'pinyinSupport', 'null'::jsonb),
      activity ->> 'humorContentRef',
      (activity ->> 'estimatedSeconds')::smallint,
      p_created_at
    );
  end loop;

  return p_session_id;
end;
$$;

revoke all on function public.materialize_learning_session_v2(
  uuid, uuid, text, uuid, text, smallint, text, text, text, timestamptz, jsonb, jsonb
) from public;
grant execute on function public.materialize_learning_session_v2(
  uuid, uuid, text, uuid, text, smallint, text, text, text, timestamptz, jsonb, jsonb
) to hanziquest_app;

grant select, insert on public.learning_session_plan_v2_events to hanziquest_app;
alter table public.learning_session_plan_v2_events enable row level security;
alter table public.learning_session_plan_v2_events force row level security;
create policy learning_session_plan_v2_events_own
  on public.learning_session_plan_v2_events
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());
