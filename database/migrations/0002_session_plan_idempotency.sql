alter table public.learning_sessions
  add column client_session_id uuid,
  add column idempotency_key text;

update public.learning_sessions
set
  client_session_id = id,
  idempotency_key = 'legacy-session:' || id::text
where client_session_id is null or idempotency_key is null;

alter table public.learning_sessions
  alter column client_session_id set not null,
  alter column idempotency_key set not null,
  add constraint learning_sessions_idempotency_key_format_check
    check (
      char_length(idempotency_key) between 16 and 128
      and idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
    ),
  add constraint learning_sessions_user_client_session_unique
    unique (user_id, client_session_id),
  add constraint learning_sessions_user_idempotency_unique
    unique (user_id, idempotency_key);

create function public.prevent_learning_session_plan_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.client_session_id is distinct from old.client_session_id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.curriculum_version_id is distinct from old.curriculum_version_id
    or new.lesson_id is distinct from old.lesson_id
    or new.target_minutes is distinct from old.target_minutes
    or new.plan_version is distinct from old.plan_version
    or new.plan is distinct from old.plan
    or new.created_at is distinct from old.created_at
  then
    raise exception 'learning session plan snapshots are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger learning_sessions_plan_immutable
before update on public.learning_sessions
for each row execute function public.prevent_learning_session_plan_mutation();

grant insert (
  user_id,
  client_session_id,
  idempotency_key,
  curriculum_version_id,
  lesson_id,
  status,
  target_minutes,
  plan_version,
  plan
) on public.learning_sessions to hanziquest_app;

drop policy learning_sessions_own on public.learning_sessions;
create policy learning_sessions_own on public.learning_sessions
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());
