-- Task 6.4W forward migration.
-- Rollback: undeploy the signature-practice routes, keep local exports, then use a reviewed
-- forward migration to revoke these grants and drop the additive event table only if its
-- metadata is no longer needed. Never rewrite an applied migration.

create table public.signature_practice_events (
  id uuid primary key,
  user_id uuid not null references public."user"(id) on delete cascade,
  signature_project_id uuid not null,
  idempotency_key text not null check (
    char_length(idempotency_key) between 16 and 128
    and idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  algorithm_version text not null check (algorithm_version = 'signature-consistency-v1'),
  structure_score numeric(5,4) check (structure_score is null or structure_score between 0 and 1),
  proportion_score numeric(5,4) check (proportion_score is null or proportion_score between 0 and 1),
  direction_score numeric(5,4) check (direction_score is null or direction_score between 0 and 1),
  rhythm_score numeric(5,4) check (rhythm_score is null or rhythm_score between 0 and 1),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (signature_project_id, user_id)
    references public.signature_projects(id, user_id) on delete cascade,
  unique (user_id, idempotency_key),
  check (
    (
      structure_score is null
      and proportion_score is null
      and direction_score is null
      and rhythm_score is null
    )
    or (
      structure_score is not null
      and proportion_score is not null
      and direction_score is not null
      and rhythm_score is not null
    )
  )
);

create index signature_practice_events_user_project_idx
  on public.signature_practice_events (user_id, signature_project_id, occurred_at, id);

grant select, insert on public.signature_practice_events to hanziquest_app;

alter table public.signature_practice_events enable row level security;
alter table public.signature_practice_events force row level security;
create policy signature_practice_events_own on public.signature_practice_events
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

alter policy signature_summaries_own on public.signature_practice_summaries
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

create function public.refresh_signature_practice_summary()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.signature_practice_summaries (
    user_id,
    signature_project_id,
    practice_count,
    structure_score,
    proportion_score,
    direction_score,
    rhythm_score,
    calculated_at
  )
  select
    new.user_id,
    new.signature_project_id,
    count(*)::integer,
    avg(structure_score),
    avg(proportion_score),
    avg(direction_score),
    avg(rhythm_score),
    now()
  from public.signature_practice_events
  where user_id = new.user_id
    and signature_project_id = new.signature_project_id
  on conflict (user_id, signature_project_id) do update set
    practice_count = excluded.practice_count,
    structure_score = excluded.structure_score,
    proportion_score = excluded.proportion_score,
    direction_score = excluded.direction_score,
    rhythm_score = excluded.rhythm_score,
    calculated_at = excluded.calculated_at;
  return new;
end
$$;

revoke all on function public.refresh_signature_practice_summary() from public;

create trigger signature_practice_event_aggregate
after insert on public.signature_practice_events
for each row execute function public.refresh_signature_practice_summary();
