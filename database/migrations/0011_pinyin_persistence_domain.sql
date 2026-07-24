-- Task 5.9P-A: formal Pinyin curriculum persistence.
-- This migration is additive. Roll back application usage and imports instead of rewriting an
-- applied migration; published curriculum rows remain immutable audit evidence.

alter type public.concept_type add value if not exists 'pinyin';
alter type public.skill_type add value if not exists 'audio_to_pinyin';
alter type public.skill_type add value if not exists 'pinyin_to_audio';
alter type public.skill_type add value if not exists 'pinyin_to_glyph';
alter type public.skill_type add value if not exists 'glyph_to_pinyin';
alter type public.skill_type add value if not exists 'tone_choice';
alter type public.skill_type add value if not exists 'pinyin_syllable_build';

create type public.pinyin_concept_kind as enum ('initial', 'final', 'syllable', 'tone');

alter table public.words
  add column canonical_pinyin text,
  add column surface_pinyin text,
  add column audio_asset_id uuid references public.media_assets(id);

update public.words set canonical_pinyin = pinyin where canonical_pinyin is null;

alter table public.words
  alter column canonical_pinyin set not null,
  add constraint words_canonical_pinyin_check
    check (char_length(btrim(canonical_pinyin)) between 1 and 160),
  add constraint words_surface_pinyin_check
    check (
      surface_pinyin is null
      or char_length(btrim(surface_pinyin)) between 1 and 160
    );

alter table public.sentences
  add column canonical_pinyin text,
  add column surface_pinyin text,
  add column audio_asset_id uuid references public.media_assets(id),
  add constraint sentences_canonical_pinyin_check
    check (
      canonical_pinyin is null
      or char_length(btrim(canonical_pinyin)) between 1 and 300
    ),
  add constraint sentences_surface_pinyin_check
    check (
      surface_pinyin is null
      or (
        canonical_pinyin is not null
        and char_length(btrim(surface_pinyin)) between 1 and 300
      )
    );

create table public.pinyin_concepts (
  id uuid primary key,
  curriculum_version_id uuid not null
    references public.curriculum_versions(id) on delete cascade,
  concept_code text not null,
  kind public.pinyin_concept_kind not null,
  canonical_value text not null,
  display_value text not null,
  numbered_value text,
  tone_number smallint,
  initial_concept_id uuid references public.pinyin_concepts(id),
  final_concept_id uuid references public.pinyin_concepts(id),
  audio_asset_id uuid references public.media_assets(id),
  content_status text not null default 'draft'
    check (content_status in ('draft', 'approved', 'published', 'archived')),
  is_published boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_version_id, concept_code),
  check (concept_code ~ '^pinyin\.(initial|final|tone|syllable)\.[a-z0-9-]+$'),
  check (char_length(btrim(canonical_value)) between 1 and 24),
  check (char_length(btrim(display_value)) between 1 and 24),
  check (numbered_value is null or char_length(btrim(numbered_value)) between 1 and 24),
  check (tone_number is null or tone_number between 1 and 5),
  check (
    (kind = 'initial'
      and numbered_value is null and tone_number is null
      and initial_concept_id is null and final_concept_id is null and audio_asset_id is null)
    or
    (kind = 'final'
      and numbered_value is null and tone_number is null
      and initial_concept_id is null and final_concept_id is null and audio_asset_id is null)
    or
    (kind = 'tone'
      and numbered_value is null and tone_number is not null
      and initial_concept_id is null and final_concept_id is null and audio_asset_id is null)
    or
    (kind = 'syllable'
      and numbered_value is not null and tone_number is not null
      and initial_concept_id is not null and final_concept_id is not null)
  ),
  check (is_published = (content_status = 'published'))
);

create unique index pinyin_concepts_value_unique
  on public.pinyin_concepts (
    curriculum_version_id,
    kind,
    canonical_value,
    coalesce(tone_number, 0)
  );
create index pinyin_concepts_published_idx
  on public.pinyin_concepts (curriculum_version_id, kind, concept_code)
  where is_published;

create function public.validate_pinyin_concept_components()
returns trigger language plpgsql set search_path = ''
as $$
declare
  initial_kind public.pinyin_concept_kind;
  final_kind public.pinyin_concept_kind;
  initial_version uuid;
  final_version uuid;
begin
  if new.kind <> 'syllable' then
    return new;
  end if;

  select kind, curriculum_version_id
    into initial_kind, initial_version
    from public.pinyin_concepts
    where id = new.initial_concept_id;
  select kind, curriculum_version_id
    into final_kind, final_version
    from public.pinyin_concepts
    where id = new.final_concept_id;

  if initial_kind is distinct from 'initial'
    or final_kind is distinct from 'final'
    or initial_version is distinct from new.curriculum_version_id
    or final_version is distinct from new.curriculum_version_id
  then
    raise exception 'Pinyin syllable components must be initial/final concepts in the same curriculum'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pinyin_concepts_validate_components
before insert or update on public.pinyin_concepts
for each row execute function public.validate_pinyin_concept_components();

create function public.prevent_published_pinyin_concept_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.is_published then
    raise exception 'Published Pinyin concepts are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pinyin_concepts_published_immutable
before update or delete on public.pinyin_concepts
for each row execute function public.prevent_published_pinyin_concept_mutation();

create trigger pinyin_concepts_set_updated_at
before update on public.pinyin_concepts
for each row execute function public.set_updated_at();

grant select on public.pinyin_concepts to hanziquest_app;

alter table public.pinyin_concepts enable row level security;
alter table public.pinyin_concepts force row level security;
create policy pinyin_concepts_published_read on public.pinyin_concepts
  for select
  using (current_user <> 'hanziquest_app' or is_published);
create policy pinyin_concepts_import_write on public.pinyin_concepts
  for all
  using (current_user <> 'hanziquest_app')
  with check (current_user <> 'hanziquest_app');
