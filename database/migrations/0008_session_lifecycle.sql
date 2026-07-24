-- Task 8.2C-B authoritative Session lifecycle and idempotency.
-- Existing terminal/session data is never rewritten. The NOT VALID lifecycle shape constraint
-- protects new writes while allowing an operator to audit historical rows before later validation.
-- Rollback is application-level: stop lifecycle routes and Session creation; retain events.

alter table public.learning_sessions
  add column abandoned_at timestamptz,
  add constraint learning_sessions_lifecycle_shape_check
    check (
      (
        status = 'planned'
        and started_at is null
        and completed_at is null
        and abandoned_at is null
        and abandoned_reason is null
      )
      or (
        status = 'in_progress'
        and started_at is not null
        and completed_at is null
        and abandoned_at is null
        and abandoned_reason is null
      )
      or (
        status = 'completed'
        and started_at is not null
        and completed_at is not null
        and abandoned_at is null
        and abandoned_reason is null
      )
      or (
        status = 'abandoned'
        and completed_at is null
        and abandoned_at is not null
      )
    ) not valid;

do $$
begin
  if exists (
    select 1
    from public.learning_sessions
    where status in ('planned', 'in_progress')
    group by user_id
    having count(*) > 1
  ) then
    raise exception
      'cannot enforce one active Session per user until duplicate historical active rows are resolved'
      using errcode = '23505';
  end if;
end
$$;

create unique index learning_sessions_one_active_per_user_idx
  on public.learning_sessions (user_id)
  where status in ('planned', 'in_progress');

create function public.enforce_learning_session_lifecycle()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = old.status then
    if new.started_at is distinct from old.started_at
      or new.completed_at is distinct from old.completed_at
      or new.abandoned_at is distinct from old.abandoned_at
      or new.abandoned_reason is distinct from old.abandoned_reason
    then
      raise exception 'Session lifecycle timestamps are server controlled'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status = 'planned' and new.status = 'in_progress' then
    new.started_at := now();
    new.completed_at := null;
    new.abandoned_at := null;
    new.abandoned_reason := null;
  elsif old.status = 'in_progress' and new.status = 'completed' then
    new.started_at := old.started_at;
    new.completed_at := now();
    new.abandoned_at := null;
    new.abandoned_reason := null;
  elsif old.status in ('planned', 'in_progress') and new.status = 'abandoned' then
    new.started_at := old.started_at;
    new.completed_at := null;
    new.abandoned_at := now();
  else
    raise exception 'invalid Session lifecycle transition: % to %', old.status, new.status
      using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger learning_sessions_lifecycle_guard
before update of status, started_at, completed_at, abandoned_at, abandoned_reason
on public.learning_sessions
for each row execute function public.enforce_learning_session_lifecycle();

create table public.learning_session_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references public."user"(id) on delete cascade,
  idempotency_key text not null check (
    char_length(idempotency_key) between 16 and 128
    and idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  action text not null check (action in ('start', 'complete', 'abandon')),
  from_status public.session_status not null,
  to_status public.session_status not null,
  result_snapshot jsonb not null check (
    jsonb_typeof(result_snapshot) = 'object'
    and result_snapshot ->> 'schemaVersion' = 'session-lifecycle-v1'
    and result_snapshot ->> 'sessionId' = session_id::text
  ),
  occurred_at timestamptz not null default now(),
  foreign key (session_id, user_id)
    references public.learning_sessions(id, user_id) on delete cascade,
  unique (user_id, idempotency_key),
  unique (id, session_id, user_id)
);

create index learning_session_lifecycle_events_user_session_idx
  on public.learning_session_lifecycle_events (user_id, session_id, occurred_at, id);

create function public.prevent_learning_session_lifecycle_event_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Session lifecycle events are immutable' using errcode = '23514';
end;
$$;

create trigger learning_session_lifecycle_events_immutable
before update on public.learning_session_lifecycle_events
for each row execute function public.prevent_learning_session_lifecycle_event_mutation();

grant update (
  status,
  started_at,
  completed_at,
  abandoned_at,
  abandoned_reason,
  updated_at
) on public.learning_sessions to hanziquest_app;
grant select, insert on public.learning_session_lifecycle_events to hanziquest_app;

alter table public.learning_session_lifecycle_events enable row level security;
alter table public.learning_session_lifecycle_events force row level security;
create policy learning_session_lifecycle_events_own
  on public.learning_session_lifecycle_events
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());
