-- Ordered HanziQuest migration. Apply only through the Supabase CLI.

begin;

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
  updated_at timestamptz not null default timezone('utc', now()),
  check (char_length(preferred_parent_locale) between 2 and 20),
  check (char_length(time_zone) between 1 and 80)
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.household_role not null,
  status public.member_status not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (household_id, user_id),
  check (invited_by is null or invited_by <> user_id)
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
  updated_at timestamptz not null default timezone('utc', now()),
  unique (household_id, id),
  check (char_length(spoken_track) between 1 and 30),
  check (char_length(interface_locale) between 2 and 20)
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  child_id uuid,
  granted_by uuid not null references auth.users(id) on delete restrict,
  consent_type text not null check (consent_type in ('required_processing', 'ai_personalization', 'cloud_speech', 'marketing')),
  document_version text not null check (char_length(document_version) between 1 and 40),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  granted boolean not null,
  granted_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  check (revoked_at is null or revoked_at >= granted_at),
  foreign key (household_id, child_id)
    references public.child_profiles(household_id, id) on delete cascade
);

create table if not exists public.data_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  child_id uuid,
  request_type public.data_request_type not null,
  status public.data_request_status not null default 'requested',
  verification_token_hash text,
  result_storage_path text,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  check (completed_at is null or completed_at >= requested_at),
  foreign key (household_id, child_id)
    references public.child_profiles(household_id, id) on delete cascade
);


commit;
