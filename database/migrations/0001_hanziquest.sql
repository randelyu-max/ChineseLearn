create extension if not exists pgcrypto;

create type public.script_track as enum ('simplified', 'traditional');
create type public.curriculum_status as enum ('draft', 'review', 'published', 'archived');
create type public.skill_type as enum (
  'audio_to_glyph', 'glyph_to_image', 'word_build', 'sentence_order',
  'glyph_to_sound', 'glyph_to_meaning', 'word_recognition',
  'sentence_reading', 'story_comprehension', 'oral_reading'
);
create type public.concept_type as enum ('character', 'word', 'sentence', 'story');
create type public.session_status as enum ('planned', 'in_progress', 'completed', 'abandoned');

create function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Better Auth core schema. Quoted camel-case columns match its PostgreSQL adapter.
create table public."user" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table public."session" (
  id uuid primary key default gen_random_uuid(),
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid not null references public."user"(id) on delete cascade
);
create index session_user_id_idx on public."session" ("userId");

create table public.account (
  id uuid primary key default gen_random_uuid(),
  "accountId" text not null,
  "providerId" text not null,
  "userId" uuid not null references public."user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index account_user_id_idx on public.account ("userId");

create table public.verification (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index verification_identifier_idx on public.verification (identifier);

create table public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (char_length(version) between 1 and 50),
  spoken_track text not null default 'mandarin',
  script_track public.script_track not null,
  status public.curriculum_status not null default 'draft',
  min_app_version text,
  manifest_sha256 text,
  notes text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table public.worlds (
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_version_id, slug),
  unique (curriculum_version_id, sort_order)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  slug text not null,
  sort_order integer not null check (sort_order >= 0),
  title_zh text not null,
  title_en text not null,
  mastery_requirement numeric(5,4) not null default 0.75 check (mastery_requirement between 0 and 1),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (world_id, slug),
  unique (world_id, sort_order)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  slug text not null,
  sort_order integer not null check (sort_order >= 0),
  title_zh text not null,
  estimated_minutes smallint not null default 8 check (estimated_minutes between 3 and 20),
  objective_codes text[] not null default '{}',
  content_spec jsonb not null default '{}',
  is_boss_challenge boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, slug),
  unique (unit_id, sort_order)
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  concept_code text not null unique,
  simplified_glyph text not null,
  traditional_glyph text,
  pinyin_syllables text[] not null,
  frequency_rank integer check (frequency_rank is null or frequency_rank > 0),
  radical text,
  stroke_count smallint check (stroke_count is null or stroke_count > 0),
  meaning_zh text,
  meaning_en text,
  spoken_examples jsonb not null default '[]',
  tags text[] not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.words (
  id uuid primary key default gen_random_uuid(),
  concept_code text not null unique,
  simplified_text text not null,
  traditional_text text,
  pinyin text not null,
  meaning_zh text,
  meaning_en text,
  character_ids uuid[] not null default '{}',
  tags text[] not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sentences (
  id uuid primary key default gen_random_uuid(),
  concept_code text not null unique,
  simplified_text text not null,
  traditional_text text,
  audio_asset_key text,
  word_ids uuid[] not null default '{}',
  target_character_ids uuid[] not null default '{}',
  difficulty numeric(5,4) not null default 0.25 check (difficulty between 0 and 1),
  tags text[] not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete cascade,
  concept_code text not null,
  title_zh text not null,
  title_en text,
  script_track public.script_track not null,
  source text not null check (source in ('editorial', 'template')),
  sentences jsonb not null check (jsonb_typeof(sentences) = 'array'),
  questions jsonb not null default '[]' check (jsonb_typeof(questions) = 'array'),
  allowed_character_ids uuid[] not null default '{}',
  target_character_ids uuid[] not null default '{}',
  difficulty numeric(5,4) not null default 0.25 check (difficulty between 0 and 1),
  validation_report jsonb not null default '{}',
  approved_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_version_id, concept_code),
  check (not is_published or approved_at is not null)
);

create table public.lesson_concepts (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  concept_type public.concept_type not null,
  concept_id uuid not null,
  role text not null check (role in ('review', 'target', 'transfer', 'optional')),
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (lesson_id, concept_type, concept_id, role)
);

create table public.confusable_pairs (
  id uuid primary key default gen_random_uuid(),
  left_character_id uuid not null references public.characters(id) on delete cascade,
  right_character_id uuid not null references public.characters(id) on delete cascade,
  reason_code text not null,
  explanation_zh text,
  minimum_exposure_count smallint not null default 2 check (minimum_exposure_count >= 1),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (left_character_id, right_character_id),
  check (left_character_id <> right_character_id)
);

create table public.media_assets (
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
  metadata jsonb not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table public.profiles (
  id uuid primary key references public."user"(id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  chinese_name text check (chinese_name is null or char_length(btrim(chinese_name)) between 1 and 24),
  interface_locale text not null default 'zh-CN' check (interface_locale in ('zh-CN', 'zh-TW', 'en-US')),
  script_preference text not null default 'simplified' check (script_preference in ('simplified', 'traditional')),
  pinyin_support_mode text not null default 'adaptive' check (pinyin_support_mode in ('always', 'adaptive', 'tap_to_reveal', 'hidden')),
  humor_preference text not null default 'light' check (humor_preference in ('off', 'light', 'playful')),
  daily_goal_minutes integer not null default 8 check (daily_goal_minutes between 3 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."user"(id) on delete cascade,
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  lesson_id uuid references public.lessons(id) on delete set null,
  status public.session_status not null default 'planned',
  target_minutes smallint not null check (target_minutes between 3 and 60),
  plan_version text not null,
  plan jsonb not null check (jsonb_typeof(plan) = 'object'),
  started_at timestamptz,
  completed_at timestamptz,
  abandoned_reason text,
  score_summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  offline_event_id uuid not null,
  session_id uuid not null,
  user_id uuid not null references public."user"(id) on delete cascade,
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
  received_at timestamptz not null default now(),
  evidence_weight numeric(5,4) not null check (evidence_weight between 0 and 1),
  metadata jsonb not null default '{}',
  unique (user_id, offline_event_id),
  foreign key (session_id, user_id) references public.learning_sessions(id, user_id) on delete cascade
);

create table public.skill_states (
  user_id uuid not null references public."user"(id) on delete cascade,
  concept_type public.concept_type not null,
  concept_id uuid not null,
  skill public.skill_type not null,
  mastery_probability numeric(7,6) not null default 0.15 check (mastery_probability between 0.02 and 0.98),
  stability_days numeric(8,3) not null default 0.5 check (stability_days > 0),
  difficulty numeric(7,6) not null default 0.5 check (difficulty between 0 and 1),
  exposure_count integer not null default 0 check (exposure_count >= 0),
  independent_correct_count integer not null default 0 check (independent_correct_count >= 0),
  hinted_correct_count integer not null default 0 check (hinted_correct_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  last_attempt_at timestamptz,
  next_review_at timestamptz,
  last_evidence jsonb not null default '{}',
  stable_mastery_at timestamptz,
  model_version text not null default 'adaptive-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_type, concept_id, skill)
);

create table public.review_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."user"(id) on delete cascade,
  concept_type public.concept_type not null,
  concept_id uuid not null,
  skill public.skill_type not null,
  due_at timestamptz not null,
  due_reason text not null,
  interval_days numeric(8,3) not null check (interval_days > 0),
  planner_version text not null,
  state_version integer not null default 1 check (state_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, concept_type, concept_id, skill)
);

create table public.confusion_stats (
  user_id uuid not null references public."user"(id) on delete cascade,
  pair_id uuid not null references public.confusable_pairs(id) on delete cascade,
  left_shown_count integer not null default 0,
  right_shown_count integer not null default 0,
  left_as_right_count integer not null default 0,
  right_as_left_count integer not null default 0,
  risk numeric(7,6) not null default 0 check (risk between 0 and 1),
  last_confused_at timestamptz,
  next_practice_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, pair_id)
);

create table public.signature_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."user"(id) on delete cascade,
  chinese_name text not null,
  selected_style text not null default 'clear' check (selected_style in ('clear', 'compact', 'forward_leaning', 'flowing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.signature_practice_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."user"(id) on delete cascade,
  signature_project_id uuid not null,
  practice_count integer not null default 0 check (practice_count >= 0),
  structure_score numeric(5,4) check (structure_score is null or structure_score between 0 and 1),
  proportion_score numeric(5,4) check (proportion_score is null or proportion_score between 0 and 1),
  direction_score numeric(5,4) check (direction_score is null or direction_score between 0 and 1),
  rhythm_score numeric(5,4) check (rhythm_score is null or rhythm_score between 0 and 1),
  calculated_at timestamptz not null default now(),
  foreign key (signature_project_id, user_id) references public.signature_projects(id, user_id) on delete cascade,
  unique (user_id, signature_project_id)
);

create table public.reward_balances (
  user_id uuid primary key references public."user"(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create index learning_sessions_user_created_idx on public.learning_sessions (user_id, created_at desc);
create index attempts_user_received_idx on public.attempts (user_id, received_at desc);
create index skill_states_user_review_idx on public.skill_states (user_id, next_review_at);
create index review_schedule_user_due_idx on public.review_schedule (user_id, due_at);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'hanziquest_app') then
    create role hanziquest_app nologin;
  end if;
  execute format('grant hanziquest_app to %I', current_user);
end
$$;

create function public.current_app_user_id()
returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('app.current_user_id', true), '')::uuid $$;

grant usage on schema public to hanziquest_app;
grant select on public.curriculum_versions, public.worlds, public.units, public.lessons,
  public.characters, public.words, public.sentences, public.stories, public.lesson_concepts,
  public.confusable_pairs, public.media_assets to hanziquest_app;
grant select, insert on public.profiles to hanziquest_app;
grant update (display_name, chinese_name, interface_locale, script_preference,
  pinyin_support_mode, humor_preference, daily_goal_minutes) on public.profiles to hanziquest_app;
grant select on public.learning_sessions, public.skill_states, public.review_schedule,
  public.confusion_stats, public.signature_practice_summaries, public.reward_balances to hanziquest_app;
grant select, insert on public.attempts to hanziquest_app;
grant select, insert, delete on public.signature_projects to hanziquest_app;
grant update (chinese_name, selected_style) on public.signature_projects to hanziquest_app;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
create policy profiles_own on public.profiles
  using (id = public.current_app_user_id()) with check (id = public.current_app_user_id());

alter table public.learning_sessions enable row level security;
alter table public.learning_sessions force row level security;
create policy learning_sessions_own on public.learning_sessions using (user_id = public.current_app_user_id());

alter table public.attempts enable row level security;
alter table public.attempts force row level security;
create policy attempts_own on public.attempts
  using (user_id = public.current_app_user_id()) with check (user_id = public.current_app_user_id());

alter table public.skill_states enable row level security;
alter table public.skill_states force row level security;
create policy skill_states_own on public.skill_states using (user_id = public.current_app_user_id());

alter table public.review_schedule enable row level security;
alter table public.review_schedule force row level security;
create policy review_schedule_own on public.review_schedule using (user_id = public.current_app_user_id());

alter table public.confusion_stats enable row level security;
alter table public.confusion_stats force row level security;
create policy confusion_stats_own on public.confusion_stats using (user_id = public.current_app_user_id());

alter table public.signature_projects enable row level security;
alter table public.signature_projects force row level security;
create policy signature_projects_own on public.signature_projects
  using (user_id = public.current_app_user_id()) with check (user_id = public.current_app_user_id());

alter table public.signature_practice_summaries enable row level security;
alter table public.signature_practice_summaries force row level security;
create policy signature_summaries_own on public.signature_practice_summaries using (user_id = public.current_app_user_id());

alter table public.reward_balances enable row level security;
alter table public.reward_balances force row level security;
create policy reward_balances_own on public.reward_balances using (user_id = public.current_app_user_id());

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
