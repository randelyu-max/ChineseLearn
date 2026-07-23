-- Ordered HanziQuest migration. Apply only through the Supabase CLI.

begin;

-- -----------------------------------------------------------------------------
-- Learning sessions, evidence, and adaptive state
-- -----------------------------------------------------------------------------

create table if not exists public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  lesson_id uuid references public.lessons(id) on delete set null,
  status public.session_status not null default 'planned',
  target_minutes smallint not null check (target_minutes between 3 and 20),
  plan_version text not null,
  plan jsonb not null check (jsonb_typeof(plan) = 'object'),
  started_at timestamptz,
  completed_at timestamptz,
  abandoned_reason text,
  score_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(score_summary) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (completed_at is null or started_at is null or completed_at >= started_at),
  unique (id, child_id)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  offline_event_id uuid not null,
  session_id uuid not null,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  concept_type public.concept_type not null,
  concept_id uuid not null,
  skill public.skill_type not null,
  activity_type text not null,
  correct boolean not null,
  response_ms integer check (response_ms is null or response_ms >= 0),
  hint_level smallint not null default 0 check (hint_level between 0 and 4),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  selected_value text,
  expected_value text,
  app_version text,
  device_event_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  evidence_weight numeric(5,4) not null check (evidence_weight between 0 and 1),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (child_id, offline_event_id),
  foreign key (session_id, child_id)
    references public.learning_sessions(id, child_id) on delete cascade
);

create table if not exists public.child_skill_states (
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  concept_type public.concept_type not null,
  concept_id uuid not null,
  skill public.skill_type not null,
  mastery_probability numeric(7,6) not null default 0.15 check (mastery_probability between 0 and 1),
  stability_days numeric(8,3) not null default 0.5 check (stability_days > 0),
  difficulty numeric(7,6) not null default 0.5 check (difficulty between 0 and 1),
  exposure_count integer not null default 0 check (exposure_count >= 0),
  independent_correct_count integer not null default 0 check (independent_correct_count >= 0),
  hinted_correct_count integer not null default 0 check (hinted_correct_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  last_attempt_at timestamptz,
  next_review_at timestamptz,
  last_evidence jsonb not null default '{}'::jsonb,
  stable_mastery_at timestamptz,
  model_version text not null default 'adaptive-v1',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (child_id, concept_type, concept_id, skill)
);

create table if not exists public.child_confusion_stats (
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  pair_id uuid not null references public.confusable_pairs(id) on delete cascade,
  left_shown_count integer not null default 0 check (left_shown_count >= 0),
  right_shown_count integer not null default 0 check (right_shown_count >= 0),
  left_as_right_count integer not null default 0 check (left_as_right_count >= 0),
  right_as_left_count integer not null default 0 check (right_as_left_count >= 0),
  risk numeric(7,6) not null default 0 check (risk between 0 and 1),
  last_confused_at timestamptz,
  next_practice_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (child_id, pair_id)
);

-- -----------------------------------------------------------------------------
-- Rewards and child-owned world state
-- -----------------------------------------------------------------------------

create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  reward_code text not null unique,
  reward_type text not null check (reward_type in ('currency', 'avatar', 'pet', 'outfit', 'furniture', 'decoration', 'badge', 'story_card')),
  title_zh text not null,
  title_en text,
  asset_key text,
  rarity text not null default 'common' check (rarity in ('common', 'uncommon', 'rare', 'legendary')),
  unlock_rule jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  reward_id uuid references public.reward_catalog(id) on delete restrict,
  amount integer not null,
  source_type text not null check (source_type in ('attempt', 'session', 'unit', 'world', 'streak', 'admin_adjustment')),
  source_id text not null,
  idempotency_key text not null,
  balance_after integer check (balance_after is null or balance_after >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (child_id, idempotency_key),
  unique (child_id, source_type, source_id, reward_id)
);

create table if not exists public.child_inventory (
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  reward_id uuid not null references public.reward_catalog(id) on delete restrict,
  quantity integer not null default 1 check (quantity >= 0),
  equipped boolean not null default false,
  acquired_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (child_id, reward_id)
);

create table if not exists public.child_world_state (
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  unlocked_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  stars integer not null default 0 check (stars >= 0),
  placed_items jsonb not null default '[]'::jsonb,
  state_version integer not null default 1 check (state_version > 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (child_id, world_id)
);

-- -----------------------------------------------------------------------------
-- AI generation audit trail (no child PII in provider payloads)
-- -----------------------------------------------------------------------------

create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references public.child_profiles(id) on delete set null,
  job_type public.ai_job_type not null,
  status public.ai_job_status not null default 'queued',
  request_hash text not null,
  model_alias text,
  prompt_version text not null,
  schema_version text not null,
  provider_request_id text,
  provider_payload_summary jsonb not null default '{}'::jsonb,
  output jsonb,
  moderation_summary jsonb not null default '{}'::jsonb,
  validation_report jsonb not null default '{}'::jsonb,
  fallback_content_id uuid references public.stories(id) on delete set null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  failure_code text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  check (completed_at is null or completed_at >= created_at)
);


commit;
