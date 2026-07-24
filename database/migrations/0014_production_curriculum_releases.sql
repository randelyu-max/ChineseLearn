create table public.curriculum_release_imports (
  curriculum_version_id uuid primary key
    references public.curriculum_versions(id) on delete restrict,
  release_schema_version text not null
    check (release_schema_version ~ '^[a-z0-9][a-z0-9.-]{2,79}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  coverage_report jsonb not null check (jsonb_typeof(coverage_report) = 'object'),
  review_checklist_id text not null check (char_length(review_checklist_id) between 3 and 120),
  import_status text not null check (import_status in ('staging', 'published')),
  imported_at timestamptz not null default now(),
  published_at timestamptz,
  check (
    (import_status = 'published' and published_at is not null)
    or (import_status = 'staging' and published_at is null)
  )
);

create function public.prevent_published_curriculum_version_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'published curriculum versions are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger curriculum_versions_published_immutable
before update or delete on public.curriculum_versions
for each row execute function public.prevent_published_curriculum_version_mutation();

create function public.prevent_published_content_row_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.is_published then
    raise exception 'published curriculum content is immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger worlds_published_immutable
before update or delete on public.worlds
for each row execute function public.prevent_published_content_row_mutation();
create trigger units_published_immutable
before update or delete on public.units
for each row execute function public.prevent_published_content_row_mutation();
create trigger lessons_published_immutable
before update or delete on public.lessons
for each row execute function public.prevent_published_content_row_mutation();
create trigger characters_published_immutable
before update or delete on public.characters
for each row execute function public.prevent_published_content_row_mutation();
create trigger words_published_immutable
before update or delete on public.words
for each row execute function public.prevent_published_content_row_mutation();
create trigger sentences_published_immutable
before update or delete on public.sentences
for each row execute function public.prevent_published_content_row_mutation();
create trigger stories_published_immutable
before update or delete on public.stories
for each row execute function public.prevent_published_content_row_mutation();
create trigger media_assets_published_immutable
before update or delete on public.media_assets
for each row execute function public.prevent_published_content_row_mutation();
create trigger confusable_pairs_published_immutable
before update or delete on public.confusable_pairs
for each row execute function public.prevent_published_content_row_mutation();

create function public.prevent_published_lesson_concept_mutation()
returns trigger language plpgsql set search_path = ''
as $$
declare
  selected_lesson_id uuid := case when tg_op = 'DELETE' then old.lesson_id else new.lesson_id end;
begin
  if exists (
    select 1
    from public.lessons l
    join public.units u on u.id = l.unit_id
    join public.worlds w on w.id = u.world_id
    join public.curriculum_versions cv on cv.id = w.curriculum_version_id
    where l.id = selected_lesson_id and cv.status = 'published'
  ) then
    raise exception 'published lesson concept declarations are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger lesson_concepts_published_immutable
before update or delete on public.lesson_concepts
for each row execute function public.prevent_published_lesson_concept_mutation();

create function public.prevent_published_release_receipt_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.import_status = 'published' then
    raise exception 'published release receipts are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger curriculum_release_imports_published_immutable
before update or delete on public.curriculum_release_imports
for each row execute function public.prevent_published_release_receipt_mutation();

grant select on public.curriculum_release_imports to hanziquest_app;
