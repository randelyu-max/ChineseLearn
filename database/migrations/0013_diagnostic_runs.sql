create type public.diagnostic_run_status as enum ('in_progress', 'completed', 'skipped');

create table public.diagnostic_runs (
  id uuid primary key,
  user_id uuid not null references public."user"(id) on delete cascade,
  status public.diagnostic_run_status not null,
  algorithm_version text not null check (algorithm_version = 'diagnostic-v1'),
  content_version text not null check (content_version = 'diagnostic-content-v1.0.0'),
  start_idempotency_key text not null,
  terminal_idempotency_key text,
  started_at timestamptz not null,
  completed_at timestamptz,
  skipped_at timestamptz,
  result_summary jsonb,
  recommended_starting_point text,
  recommended_pinyin_support_mode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, start_idempotency_key),
  unique (user_id, terminal_idempotency_key),
  unique (id, user_id),
  check (char_length(start_idempotency_key) between 8 and 160),
  check (terminal_idempotency_key is null or char_length(terminal_idempotency_key) between 8 and 160),
  check (
    (status = 'in_progress' and completed_at is null and skipped_at is null
      and result_summary is null and terminal_idempotency_key is null)
    or
    (status = 'completed' and completed_at is not null and skipped_at is null
      and result_summary is not null and terminal_idempotency_key is not null
      and recommended_starting_point is not null
      and recommended_pinyin_support_mode is not null)
    or
    (status = 'skipped' and completed_at is null and skipped_at is not null
      and result_summary is null and terminal_idempotency_key is not null)
  ),
  check (
    recommended_starting_point is null or recommended_starting_point in (
      'spoken_audio_foundations', 'pinyin_foundations', 'hanzi_recognition_foundations',
      'word_reading', 'sentence_reading', 'short_sentence_reading'
    )
  ),
  check (
    recommended_pinyin_support_mode is null or recommended_pinyin_support_mode in (
      'always', 'adaptive', 'tap_to_reveal', 'hidden'
    )
  ),
  check (result_summary is null or jsonb_typeof(result_summary) = 'object')
);

create unique index diagnostic_runs_one_active_user_idx
  on public.diagnostic_runs (user_id) where status = 'in_progress';
create index diagnostic_runs_user_completed_idx
  on public.diagnostic_runs (user_id, completed_at desc, id desc)
  where status = 'completed';

create function public.protect_terminal_diagnostic_run()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'in_progress' then
    raise exception 'terminal diagnostic runs are immutable';
  end if;
  if new.id <> old.id
     or new.user_id <> old.user_id
     or new.algorithm_version <> old.algorithm_version
     or new.content_version <> old.content_version
     or new.start_idempotency_key <> old.start_idempotency_key
     or new.started_at <> old.started_at then
    raise exception 'diagnostic run identity is immutable';
  end if;
  return new;
end;
$$;

create trigger diagnostic_runs_terminal_immutable
before update on public.diagnostic_runs
for each row execute function public.protect_terminal_diagnostic_run();

create trigger diagnostic_runs_updated_at
before update on public.diagnostic_runs
for each row execute function public.set_updated_at();

alter table public.diagnostic_runs enable row level security;
alter table public.diagnostic_runs force row level security;
create policy diagnostic_runs_own on public.diagnostic_runs
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

grant select, insert on public.diagnostic_runs to hanziquest_app;
grant update (
  status, terminal_idempotency_key, completed_at, skipped_at, result_summary,
  recommended_starting_point, recommended_pinyin_support_mode
) on public.diagnostic_runs to hanziquest_app;
