-- HanziQuest Supabase/PostgreSQL starter schema
-- Version: 1.0 (2026-07-22)
--
-- Intended use:
--   1. Copy this file to supabase/migrations/<timestamp>_initial_schema.sql.
--   2. Review it against the final product scope before production deployment.
--   3. Keep service-role credentials on the server only.
--
-- Security model:
--   - Parents authenticate through Supabase Auth.
--   - Children are profiles, not auth users.
--   - Direct client writes are limited to explicitly safe household/profile/privacy tables.
--   - Mastery, attempts, rewards, AI jobs, and published curriculum are written only by
--     trusted Edge Functions, migrations, or the content-admin backend.

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.household_role as enum ('owner', 'parent', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.member_status as enum ('invited', 'active', 'revoked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.script_track as enum ('simplified', 'traditional');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.curriculum_status as enum ('draft', 'review', 'published', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.skill_type as enum (
    'audio_to_glyph',
    'glyph_to_sound',
    'glyph_to_meaning',
    'word_recognition',
    'sentence_reading',
    'story_comprehension',
    'oral_reading'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.concept_type as enum ('character', 'word', 'sentence', 'story');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.session_status as enum ('planned', 'in_progress', 'completed', 'abandoned');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_request_type as enum ('export', 'delete', 'correct');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.data_request_status as enum ('requested', 'verified', 'processing', 'completed', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ai_job_type as enum ('story', 'parent_report', 'hint_rewrite', 'speech_transcription');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ai_job_status as enum ('queued', 'running', 'validated', 'rejected', 'failed', 'fallback');
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Identity, family, consent, and privacy
-- -----------------------------------------------------------------------------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  display_name text not null default 'My family' check (char_length(display_name) between 1 and 80),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  preferred_parent_locale text not null default 'zh-CN',
  time_zone text not null default 'UTC',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.household_role not null,
  status public.member_status not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (household_id, user_id)
);

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_key text not null default 'panda-01' check (char_length(avatar_key) between 1 and 80),
  age_band text not null check (age_band in ('6-7', '8-10', '11-13')),
  spoken_track text not null default 'mandarin',
  script_track public.script_track not null default 'simplified',
  interface_locale text not null default 'zh-CN',
  target_minutes smallint not null default 8 check (target_minutes in (5, 8, 10, 15)),
  target_days_per_week smallint not null default 4 check (target_days_per_week between 1 and 7),
  interests text[] not null default '{}'::text[] check (cardinality(interests) <= 3),
  ai_personalization_enabled boolean not null default false,
  cloud_speech_enabled boolean not null default false,
  assessment_completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid references public.child_profiles(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete restrict,
  consent_type text not null check (consent_type in ('required_processing', 'ai_personalization', 'cloud_speech', 'marketing')),
  document_version text not null check (char_length(document_version) between 1 and 40),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  granted boolean not null,
  granted_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (revoked_at is null or revoked_at >= granted_at)
);

create table if not exists public.data_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  child_id uuid references public.child_profiles(id) on delete cascade,
  request_type public.data_request_type not null,
  status public.data_request_status not null default 'requested',
  verification_token_hash text,
  result_storage_path text,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (completed_at is null or completed_at >= requested_at)
);

-- -----------------------------------------------------------------------------
-- Versioned curriculum content
-- -----------------------------------------------------------------------------

create table if not exists public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (char_length(version) between 1 and 50),
  spoken_track text not null default 'mandarin',
  script_track public.script_track not null,
  status public.curriculum_status not null default 'draft',
  min_app_version text,
  manifest_sha256 text,
  notes text,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table if not exists public.worlds (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete cascade,
  slug text not null,
  sort_order integer not null check (sort_order >= 0),
  title_zh text not null,
  title_en text not null,
  description_zh text,
  description_en text,
  cover_asset_key text,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (curriculum_version_id, slug),
  unique (curriculum_version_id, sort_order)
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  slug text not null,
  sort_order integer not null check (sort_order >= 0),
  title_zh text not null,
  title_en text not null,
  mastery_requirement numeric(5,4) not null default 0.75 check (mastery_requirement between 0 and 1),
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (world_id, slug),
  unique (world_id, sort_order)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  slug text not null,
  sort_order integer not null check (sort_order >= 0),
  title_zh text not null,
  estimated_minutes smallint not null default 8 check (estimated_minutes between 3 and 20),
  objective_codes text[] not null default '{}'::text[],
  content_spec jsonb not null default '{}'::jsonb,
  is_boss_challenge boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (unit_id, slug),
  unique (unit_id, sort_order)
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  concept_code text not null unique,
  simplified_glyph text not null check (char_length(simplified_glyph) between 1 and 4),
  traditional_glyph text check (traditional_glyph is null or char_length(traditional_glyph) between 1 and 4),
  pinyin_syllables text[] not null,
  frequency_rank integer check (frequency_rank is null or frequency_rank > 0),
  radical text,
  stroke_count smallint check (stroke_count is null or stroke_count > 0),
  meaning_zh text,
  meaning_en text,
  spoken_examples jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}'::text[],
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  concept_code text not null unique,
  simplified_text text not null check (char_length(simplified_text) between 1 and 24),
  traditional_text text,
  pinyin text not null,
  meaning_zh text,
  meaning_en text,
  character_ids uuid[] not null default '{}'::uuid[],
  tags text[] not null default '{}'::text[],
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sentences (
  id uuid primary key default gen_random_uuid(),
  concept_code text not null unique,
  simplified_text text not null check (char_length(simplified_text) between 1 and 120),
  traditional_text text,
  audio_asset_key text,
  word_ids uuid[] not null default '{}'::uuid[],
  target_character_ids uuid[] not null default '{}'::uuid[],
  difficulty numeric(5,4) not null default 0.25 check (difficulty between 0 and 1),
  tags text[] not null default '{}'::text[],
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete cascade,
  concept_code text not null,
  title_zh text not null check (char_length(title_zh) between 1 and 40),
  title_en text,
  script_track public.script_track not null,
  source text not null check (source in ('editorial', 'ai_generated', 'template')),
  sentences jsonb not null check (jsonb_typeof(sentences) = 'array'),
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  allowed_character_ids uuid[] not null default '{}'::uuid[],
  target_character_ids uuid[] not null default '{}'::uuid[],
  difficulty numeric(5,4) not null default 0.25 check (difficulty between 0 and 1),
  validation_report jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (curriculum_version_id, concept_code),
  check (not is_published or approved_at is not null)
);

create table if not exists public.lesson_concepts (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  concept_type public.concept_type not null,
  concept_id uuid not null,
  role text not null check (role in ('review', 'target', 'transfer', 'optional')),
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (lesson_id, concept_type, concept_id, role)
);

create table if not exists public.confusable_pairs (
  id uuid primary key default gen_random_uuid(),
  left_character_id uuid not null references public.characters(id) on delete cascade,
  right_character_id uuid not null references public.characters(id) on delete cascade,
  reason_code text not null,
  explanation_zh text,
  minimum_exposure_count smallint not null default 2 check (minimum_exposure_count >= 1),
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (left_character_id, right_character_id),
  check (left_character_id <> right_character_id)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text not null,
  width integer,
  height integer,
  duration_ms integer,
  locale text,
  alt_text_zh text,
  alt_text_en text,
  metadata jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (storage_bucket, storage_path)
);

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
  plan jsonb not null,
  started_at timestamptz,
  completed_at timestamptz,
  abandoned_reason text,
  score_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  offline_event_id uuid not null,
  session_id uuid not null references public.learning_sessions(id) on delete cascade,
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
  metadata jsonb not null default '{}'::jsonb,
  unique (child_id, offline_event_id)
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

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists idx_household_members_user_active
  on public.household_members (user_id, household_id)
  where status = 'active';

create index if not exists idx_child_profiles_household_active
  on public.child_profiles (household_id, created_at)
  where archived_at is null;

create index if not exists idx_consent_records_child_type_time
  on public.consent_records (child_id, consent_type, granted_at desc);

create index if not exists idx_worlds_version_order
  on public.worlds (curriculum_version_id, sort_order);

create index if not exists idx_units_world_order
  on public.units (world_id, sort_order);

create index if not exists idx_lessons_unit_order
  on public.lessons (unit_id, sort_order);

create index if not exists idx_sessions_child_created
  on public.learning_sessions (child_id, created_at desc);

create index if not exists idx_attempts_child_received
  on public.attempts (child_id, received_at desc);

create index if not exists idx_attempts_session
  on public.attempts (session_id, device_event_at);

create index if not exists idx_skill_states_due
  on public.child_skill_states (child_id, next_review_at)
  where next_review_at is not null;

create index if not exists idx_skill_states_stable
  on public.child_skill_states (child_id, stable_mastery_at)
  where stable_mastery_at is not null;

create index if not exists idx_confusion_due
  on public.child_confusion_stats (child_id, next_practice_at)
  where next_practice_at is not null;

create index if not exists idx_reward_transactions_child_time
  on public.reward_transactions (child_id, created_at desc);

create index if not exists idx_ai_jobs_status_created
  on public.ai_generation_jobs (status, created_at);

-- -----------------------------------------------------------------------------
-- Updated-at triggers
-- -----------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'households', 'household_members', 'child_profiles', 'curriculum_versions',
    'worlds', 'units', 'lessons', 'characters', 'words', 'sentences', 'stories',
    'media_assets', 'learning_sessions', 'child_skill_states',
    'child_confusion_stats', 'reward_catalog', 'child_inventory', 'child_world_state'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Authorization helper functions
-- -----------------------------------------------------------------------------

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
  );
$$;

create or replace function public.can_manage_household(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
      and hm.role in ('owner', 'parent')
  );
$$;

create or replace function public.can_view_child(target_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.child_profiles cp
    join public.household_members hm on hm.household_id = cp.household_id
    where cp.id = target_child_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
  );
$$;

create or replace function public.can_manage_child(target_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.child_profiles cp
    join public.household_members hm on hm.household_id = cp.household_id
    where cp.id = target_child_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
      and hm.role in ('owner', 'parent')
  );
$$;

create or replace function public.create_household_with_owner(
  p_display_name text default 'My family',
  p_country_code text default null,
  p_parent_locale text default 'zh-CN',
  p_time_zone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.households (
    owner_user_id,
    display_name,
    country_code,
    preferred_parent_locale,
    time_zone
  )
  values (
    current_user_id,
    coalesce(nullif(trim(p_display_name), ''), 'My family'),
    p_country_code,
    p_parent_locale,
    p_time_zone
  )
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role, status)
  values (new_household_id, current_user_id, 'owner', 'active');

  return new_household_id;
end;
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.can_manage_household(uuid) from public;
revoke all on function public.can_view_child(uuid) from public;
revoke all on function public.can_manage_child(uuid) from public;
revoke all on function public.create_household_with_owner(text, text, text, text) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.can_manage_household(uuid) to authenticated;
grant execute on function public.can_view_child(uuid) to authenticated;
grant execute on function public.can_manage_child(uuid) to authenticated;
grant execute on function public.create_household_with_owner(text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.child_profiles enable row level security;
alter table public.consent_records enable row level security;
alter table public.data_requests enable row level security;
alter table public.curriculum_versions enable row level security;
alter table public.worlds enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.characters enable row level security;
alter table public.words enable row level security;
alter table public.sentences enable row level security;
alter table public.stories enable row level security;
alter table public.lesson_concepts enable row level security;
alter table public.confusable_pairs enable row level security;
alter table public.media_assets enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.child_skill_states enable row level security;
alter table public.child_confusion_stats enable row level security;
alter table public.reward_catalog enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.child_inventory enable row level security;
alter table public.child_world_state enable row level security;
alter table public.ai_generation_jobs enable row level security;

-- Households are created atomically with create_household_with_owner(). Direct
-- client INSERT is intentionally not granted, preventing orphan households.
create policy households_select_member
  on public.households for select to authenticated
  using (public.is_household_member(id));


create policy households_update_manager
  on public.households for update to authenticated
  using (public.can_manage_household(id))
  with check (public.can_manage_household(id));


create policy household_members_select_member
  on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

-- Membership creation, role changes, and revocation are server-only so invitation
-- validation cannot be bypassed by a modified client.

create policy child_profiles_select_member
  on public.child_profiles for select to authenticated
  using (public.is_household_member(household_id));

create policy child_profiles_insert_manager
  on public.child_profiles for insert to authenticated
  with check (public.can_manage_household(household_id));

create policy child_profiles_update_manager
  on public.child_profiles for update to authenticated
  using (public.can_manage_household(household_id))
  with check (public.can_manage_household(household_id));


create policy consent_records_select_member
  on public.consent_records for select to authenticated
  using (public.is_household_member(household_id));

create policy consent_records_insert_manager
  on public.consent_records for insert to authenticated
  with check (
    public.can_manage_household(household_id)
    and granted_by = (select auth.uid())
    and (
      child_id is null
      or (
        public.can_manage_child(child_id)
        and exists (
          select 1
          from public.child_profiles cp
          where cp.id = consent_records.child_id
            and cp.household_id = consent_records.household_id
        )
      )
    )
  );

-- Consent history is append-only. Revocation should create a new record through a
-- trusted endpoint, preserving the audit trail.

create policy data_requests_select_member
  on public.data_requests for select to authenticated
  using (public.is_household_member(household_id));

create policy data_requests_insert_manager
  on public.data_requests for insert to authenticated
  with check (
    public.can_manage_household(household_id)
    and requested_by = (select auth.uid())
    and (
      child_id is null
      or (
        public.can_manage_child(child_id)
        and exists (
          select 1
          from public.child_profiles cp
          where cp.id = data_requests.child_id
            and cp.household_id = data_requests.household_id
        )
      )
    )
  );

-- Published curriculum is readable by signed-in parents/children. Draft writes and
-- publication remain server/admin only.
create policy curriculum_versions_select_published
  on public.curriculum_versions for select to authenticated
  using (status = 'published');

create policy worlds_select_published
  on public.worlds for select to authenticated
  using (
    is_published
    and exists (
      select 1 from public.curriculum_versions cv
      where cv.id = curriculum_version_id and cv.status = 'published'
    )
  );

create policy units_select_published
  on public.units for select to authenticated
  using (
    is_published
    and exists (
      select 1
      from public.worlds w
      join public.curriculum_versions cv on cv.id = w.curriculum_version_id
      where w.id = world_id and w.is_published and cv.status = 'published'
    )
  );

create policy lessons_select_published
  on public.lessons for select to authenticated
  using (
    is_published
    and exists (
      select 1
      from public.units u
      join public.worlds w on w.id = u.world_id
      join public.curriculum_versions cv on cv.id = w.curriculum_version_id
      where u.id = unit_id
        and u.is_published and w.is_published and cv.status = 'published'
    )
  );

create policy characters_select_published
  on public.characters for select to authenticated using (is_published);

create policy words_select_published
  on public.words for select to authenticated using (is_published);

create policy sentences_select_published
  on public.sentences for select to authenticated using (is_published);

create policy stories_select_published
  on public.stories for select to authenticated
  using (
    is_published
    and exists (
      select 1 from public.curriculum_versions cv
      where cv.id = curriculum_version_id and cv.status = 'published'
    )
  );

create policy lesson_concepts_select_published
  on public.lesson_concepts for select to authenticated
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.is_published)
  );

create policy confusable_pairs_select_published
  on public.confusable_pairs for select to authenticated using (is_published);

create policy media_assets_select_published
  on public.media_assets for select to authenticated using (is_published);

-- Learning evidence and derived state are parent-readable but server-written.
create policy learning_sessions_select_family
  on public.learning_sessions for select to authenticated
  using (public.can_view_child(child_id));

create policy attempts_select_family
  on public.attempts for select to authenticated
  using (public.can_view_child(child_id));

create policy child_skill_states_select_family
  on public.child_skill_states for select to authenticated
  using (public.can_view_child(child_id));

create policy child_confusion_stats_select_family
  on public.child_confusion_stats for select to authenticated
  using (public.can_view_child(child_id));

create policy reward_catalog_select_active
  on public.reward_catalog for select to authenticated
  using (is_active);

create policy reward_transactions_select_family
  on public.reward_transactions for select to authenticated
  using (public.can_view_child(child_id));

create policy child_inventory_select_family
  on public.child_inventory for select to authenticated
  using (public.can_view_child(child_id));

create policy child_world_state_select_family
  on public.child_world_state for select to authenticated
  using (public.can_view_child(child_id));

-- AI audit rows may include internal safety metadata. Expose only through a curated
-- parent endpoint, not through direct PostgREST access; therefore no client policy.

-- -----------------------------------------------------------------------------
-- Explicit grants. RLS remains the final row-level gate.
-- -----------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update on public.child_profiles to authenticated;
grant select, insert on public.consent_records to authenticated;
grant select, insert on public.data_requests to authenticated;

grant select on public.curriculum_versions to authenticated;
grant select on public.worlds to authenticated;
grant select on public.units to authenticated;
grant select on public.lessons to authenticated;
grant select on public.characters to authenticated;
grant select on public.words to authenticated;
grant select on public.sentences to authenticated;
grant select on public.stories to authenticated;
grant select on public.lesson_concepts to authenticated;
grant select on public.confusable_pairs to authenticated;
grant select on public.media_assets to authenticated;

grant select on public.learning_sessions to authenticated;
grant select on public.attempts to authenticated;
grant select on public.child_skill_states to authenticated;
grant select on public.child_confusion_stats to authenticated;
grant select on public.reward_catalog to authenticated;
grant select on public.reward_transactions to authenticated;
grant select on public.child_inventory to authenticated;
grant select on public.child_world_state to authenticated;

-- Service-role and postgres privileges are managed by Supabase. Never grant client
-- roles access to ai_generation_jobs, direct mastery writes, attempts, or rewards.

commit;
