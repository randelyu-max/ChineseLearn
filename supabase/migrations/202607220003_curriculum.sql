-- Ordered HanziQuest migration. Apply only through the Supabase CLI.

begin;

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


commit;
