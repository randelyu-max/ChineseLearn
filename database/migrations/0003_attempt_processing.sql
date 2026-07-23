create function public.prevent_attempt_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'attempt events are immutable' using errcode = '23514';
end;
$$;

create trigger attempts_immutable
before update or delete on public.attempts
for each row execute function public.prevent_attempt_mutation();

grant insert (
  user_id,
  concept_type,
  concept_id,
  skill,
  mastery_probability,
  stability_days,
  difficulty,
  exposure_count,
  independent_correct_count,
  hinted_correct_count,
  incorrect_count,
  last_attempt_at,
  next_review_at,
  last_evidence,
  stable_mastery_at,
  model_version
) on public.skill_states to hanziquest_app;
grant update (
  mastery_probability,
  stability_days,
  difficulty,
  exposure_count,
  independent_correct_count,
  hinted_correct_count,
  incorrect_count,
  last_attempt_at,
  next_review_at,
  last_evidence,
  stable_mastery_at,
  model_version,
  updated_at
) on public.skill_states to hanziquest_app;

grant insert (
  user_id,
  concept_type,
  concept_id,
  skill,
  due_at,
  due_reason,
  interval_days,
  planner_version,
  state_version
) on public.review_schedule to hanziquest_app;
grant update (
  due_at,
  due_reason,
  interval_days,
  planner_version,
  state_version,
  updated_at
) on public.review_schedule to hanziquest_app;

drop policy skill_states_own on public.skill_states;
create policy skill_states_own on public.skill_states
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

drop policy review_schedule_own on public.review_schedule;
create policy review_schedule_own on public.review_schedule
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());
