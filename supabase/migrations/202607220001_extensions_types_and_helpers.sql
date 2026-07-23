-- Ordered HanziQuest migration. Apply only through the Supabase CLI.

begin;

-- Security model:
--   - Parents authenticate through Supabase Auth.
--   - Children are profiles, not auth users.
--   - Direct client writes are limited to explicitly safe household/profile/privacy tables.
--   - Mastery, attempts, rewards, AI jobs, and published curriculum are written only by
--     trusted Edge Functions, migrations, or the content-admin backend.


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
    'glyph_to_image',
    'word_build',
    'sentence_order',
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

commit;
