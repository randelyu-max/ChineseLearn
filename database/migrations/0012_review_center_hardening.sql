create table public.active_curriculum_releases (
  spoken_track text not null,
  script_track public.script_track not null,
  curriculum_version_id uuid not null unique
    references public.curriculum_versions(id) on delete restrict,
  activated_at timestamptz not null default now(),
  primary key (spoken_track, script_track)
);

create function public.validate_active_curriculum_release()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  selected public.curriculum_versions%rowtype;
begin
  select * into selected
  from public.curriculum_versions
  where id = new.curriculum_version_id;

  if selected.status <> 'published'
     or selected.spoken_track <> new.spoken_track
     or selected.script_track <> new.script_track then
    raise exception 'active curriculum release must reference a matching published curriculum';
  end if;
  return new;
end;
$$;

create trigger active_curriculum_release_validate
before insert or update on public.active_curriculum_releases
for each row execute function public.validate_active_curriculum_release();

insert into public.active_curriculum_releases (
  spoken_track,
  script_track,
  curriculum_version_id,
  activated_at
)
select distinct on (spoken_track, script_track)
  spoken_track,
  script_track,
  id,
  coalesce(published_at, created_at)
from public.curriculum_versions
where status = 'published'
order by spoken_track, script_track, published_at desc nulls last, created_at desc, id;

create index review_schedule_due_keyset_idx
  on public.review_schedule (user_id, due_at, concept_type, concept_id, skill);

create index confusion_stats_due_keyset_idx
  on public.confusion_stats (user_id, next_practice_at, pair_id)
  where next_practice_at is not null;

grant select on public.active_curriculum_releases to hanziquest_app;
