-- Task 8.2C-D Attempts V2 and normalized Evidence.
-- Existing Attempt columns remain readable. Legacy rows are backfilled without changing their
-- effective quality, so application replay can prove mastery/review equivalence before rollout.
-- Rollback is application-level: disable the V2 route and continue reading immutable V1 rows;
-- retain normalized Evidence for audit and do not rewrite applied migrations.

alter table public.attempts
  add column session_activity_id uuid,
  add column attempt_contract_version text not null default 'attempt-event-v1',
  add column offline_sequence bigint,
  add column replay_count smallint,
  add column retry_count smallint,
  add column pinyin_support text,
  add column request_sha256 text,
  add constraint attempts_contract_version_check
    check (attempt_contract_version in ('attempt-event-v1', 'attempt-event-v2')),
  add constraint attempts_offline_sequence_check
    check (offline_sequence is null or offline_sequence >= 0),
  add constraint attempts_replay_count_check
    check (replay_count is null or replay_count between 0 and 100),
  add constraint attempts_retry_count_check
    check (retry_count is null or retry_count between 0 and 100),
  add constraint attempts_pinyin_support_check
    check (
      pinyin_support is null
      or pinyin_support in ('none', 'pinyin_visible', 'pinyin_revealed', 'full_answer')
    ),
  add constraint attempts_request_sha256_check
    check (request_sha256 is null or request_sha256 ~ '^[a-f0-9]{64}$'),
  add constraint attempts_v2_required_fields_check
    check (
      attempt_contract_version <> 'attempt-event-v2'
      or (
        session_activity_id is not null
        and offline_sequence is not null
        and replay_count is not null
        and retry_count is not null
        and pinyin_support is not null
        and request_sha256 is not null
      )
    ),
  add constraint attempts_session_activity_owner_fkey
    foreign key (session_activity_id, session_id, user_id)
    references public.learning_session_activities(id, session_id, user_id) on delete cascade,
  add constraint attempts_id_user_unique unique (id, user_id);

create index attempts_v2_session_activity_idx
  on public.attempts (user_id, session_id, session_activity_id, device_event_at);

create table public.attempt_evidence (
  attempt_id uuid not null,
  user_id uuid not null references public."user"(id) on delete cascade,
  evidence_index smallint not null check (evidence_index between 0 and 19),
  concept_type text not null check (
    concept_type in ('character', 'word', 'sentence', 'story', 'pinyin')
  ),
  concept_id text not null check (
    char_length(concept_id) between 1 and 160
    and concept_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  skill text not null check (
    char_length(skill) between 1 and 160
    and skill ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  ability_axis text not null check (
    ability_axis in (
      'spoken_audio_comprehension',
      'pinyin_recognition',
      'tone_discrimination',
      'hanzi_recognition',
      'word_reading',
      'sentence_reading',
      'confusion_discrimination'
    )
  ),
  target_role text not null check (target_role in ('primary', 'secondary', 'transfer')),
  correct boolean not null,
  base_quality numeric(9,8) not null check (base_quality between 0 and 1),
  support_multiplier numeric(9,8) not null check (support_multiplier between 0 and 1),
  effective_quality numeric(9,8) not null check (effective_quality between 0 and 1),
  algorithm_version text not null check (
    char_length(btrim(algorithm_version)) between 1 and 100
  ),
  created_at timestamptz not null default now(),
  primary key (attempt_id, concept_type, concept_id, skill, ability_axis),
  unique (attempt_id, evidence_index),
  foreign key (attempt_id, user_id)
    references public.attempts(id, user_id) on delete cascade,
  check (
    abs(effective_quality - (base_quality * support_multiplier)) <= 0.000001
  )
);

create index attempt_evidence_replay_idx
  on public.attempt_evidence (
    user_id,
    concept_type,
    concept_id,
    skill,
    ability_axis,
    attempt_id
  );

create function public.prevent_attempt_evidence_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Attempt Evidence is immutable' using errcode = '23514';
end;
$$;

create trigger attempt_evidence_immutable
before update on public.attempt_evidence
for each row execute function public.prevent_attempt_evidence_mutation();

-- attempt-evidence-backfill:start
with legacy_targets as (
  select distinct
    a.id as attempt_id,
    a.user_id,
    target.concept_id,
    case when target.concept_id = a.concept_id::text then 'primary' else 'secondary' end
      as target_role
  from public.attempts a
  cross join lateral (
    select a.concept_id::text as concept_id
    union
    select value
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(a.metadata -> 'targetConceptIds') = 'array'
          then a.metadata -> 'targetConceptIds'
        else '[]'::jsonb
      end
    )
    where value ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ) target
),
ordered_targets as (
  select
    attempt_id,
    user_id,
    concept_id,
    target_role,
    row_number() over (
      partition by attempt_id
      order by (target_role = 'primary') desc, concept_id
    ) - 1 as evidence_index
  from legacy_targets
)
insert into public.attempt_evidence (
  attempt_id,
  user_id,
  evidence_index,
  concept_type,
  concept_id,
  skill,
  ability_axis,
  target_role,
  correct,
  base_quality,
  support_multiplier,
  effective_quality,
  algorithm_version,
  created_at
)
select
  a.id,
  a.user_id,
  target.evidence_index,
  a.concept_type::text,
  target.concept_id,
  a.skill::text,
  case
    when a.activity_type = 'word_build' then 'word_reading'
    when a.activity_type = 'sentence_order' then 'sentence_reading'
    else 'hanzi_recognition'
  end,
  target.target_role,
  a.correct,
  a.evidence_weight,
  1,
  a.evidence_weight,
  'legacy-attempt-backfill-v1',
  a.received_at
from public.attempts a
join ordered_targets target on target.attempt_id = a.id
on conflict do nothing;
-- attempt-evidence-backfill:end

do $$
begin
  if exists (
    select 1
    from public.attempts a
    where not exists (
      select 1 from public.attempt_evidence ae where ae.attempt_id = a.id
    )
  ) then
    raise exception 'Every historical Attempt must have normalized Evidence after backfill';
  end if;
end
$$;

create table public.attempt_batch_v2_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references public."user"(id) on delete cascade,
  idempotency_key text not null check (
    char_length(idempotency_key) between 16 and 128
    and idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  request_sha256 text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  result_snapshot jsonb not null check (
    jsonb_typeof(result_snapshot) = 'object'
    and result_snapshot ->> 'schemaVersion' = 'attempts-batch-response-v2'
    and result_snapshot ->> 'sessionId' = session_id::text
  ),
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id) on delete cascade,
  unique (user_id, idempotency_key)
);

create function public.prevent_attempt_batch_v2_event_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Attempts Batch V2 events are immutable' using errcode = '23514';
end;
$$;

create trigger attempt_batch_v2_events_immutable
before update on public.attempt_batch_v2_events
for each row execute function public.prevent_attempt_batch_v2_event_mutation();

grant select, insert on public.attempt_evidence, public.attempt_batch_v2_events to hanziquest_app;

alter table public.attempt_evidence enable row level security;
alter table public.attempt_evidence force row level security;
create policy attempt_evidence_own
  on public.attempt_evidence
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

alter table public.attempt_batch_v2_events enable row level security;
alter table public.attempt_batch_v2_events force row level security;
create policy attempt_batch_v2_events_own
  on public.attempt_batch_v2_events
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());
