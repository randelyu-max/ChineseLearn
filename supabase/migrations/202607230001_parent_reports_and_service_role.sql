-- Add the family-scoped report surface required by the parent dashboard and make
-- the server-only role privileges explicit for projects using the new revoked-by-default API model.

begin;

create table public.parent_reports (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  facts jsonb not null default '{}'::jsonb check (jsonb_typeof(facts) = 'object'),
  narrative_zh text,
  narrative_en text,
  generated_by text not null default 'deterministic'
    check (generated_by in ('deterministic', 'ai_assisted')),
  status text not null default 'ready' check (status in ('draft', 'ready', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (child_id, period_start, period_end),
  check (period_end >= period_start),
  check (narrative_zh is null or char_length(narrative_zh) <= 4000),
  check (narrative_en is null or char_length(narrative_en) <= 4000)
);

create index idx_parent_reports_child_period
  on public.parent_reports (child_id, period_end desc);

create trigger set_updated_at
  before update on public.parent_reports
  for each row execute function public.set_updated_at();

alter table public.parent_reports enable row level security;

create policy parent_reports_select_family
  on public.parent_reports for select to authenticated
  using (public.can_view_child(child_id));

revoke all on table public.parent_reports from anon, authenticated;
grant select on public.parent_reports to authenticated;

-- The secret/service role bypasses RLS by design and is restricted to Edge Functions,
-- controlled backend jobs, and local/CI database tests. No service-role key is stored here.
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

commit;
