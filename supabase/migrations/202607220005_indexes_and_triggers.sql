-- Ordered HanziQuest migration. Apply only through the Supabase CLI.

begin;

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists idx_households_owner
  on public.households (owner_user_id);

create index if not exists idx_household_members_user_active
  on public.household_members (user_id, household_id)
  where status = 'active';

create index if not exists idx_household_members_invited_by
  on public.household_members (invited_by)
  where invited_by is not null;

create index if not exists idx_child_profiles_household_active
  on public.child_profiles (household_id, created_at)
  where archived_at is null;

create index if not exists idx_consent_records_child_type_time
  on public.consent_records (child_id, consent_type, granted_at desc);

create index if not exists idx_consent_records_household_time
  on public.consent_records (household_id, granted_at desc);

create index if not exists idx_consent_records_granted_by
  on public.consent_records (granted_by);

create index if not exists idx_data_requests_household_time
  on public.data_requests (household_id, requested_at desc);

create index if not exists idx_data_requests_requested_by
  on public.data_requests (requested_by);

create index if not exists idx_worlds_version_order
  on public.worlds (curriculum_version_id, sort_order);

create index if not exists idx_units_world_order
  on public.units (world_id, sort_order);

create index if not exists idx_lessons_unit_order
  on public.lessons (unit_id, sort_order);

create index if not exists idx_sessions_child_created
  on public.learning_sessions (child_id, created_at desc);

create index if not exists idx_attempts_child_received
  on public.attempts (child_id, received_at desc);

create index if not exists idx_attempts_session
  on public.attempts (session_id, device_event_at);

create index if not exists idx_skill_states_due
  on public.child_skill_states (child_id, next_review_at)
  where next_review_at is not null;

create index if not exists idx_skill_states_stable
  on public.child_skill_states (child_id, stable_mastery_at)
  where stable_mastery_at is not null;

create index if not exists idx_confusion_due
  on public.child_confusion_stats (child_id, next_practice_at)
  where next_practice_at is not null;

create index if not exists idx_reward_transactions_child_time
  on public.reward_transactions (child_id, created_at desc);

create index if not exists idx_ai_jobs_status_created
  on public.ai_generation_jobs (status, created_at);

create index if not exists idx_ai_jobs_child_created
  on public.ai_generation_jobs (child_id, created_at desc)
  where child_id is not null;

-- -----------------------------------------------------------------------------
-- Updated-at triggers
-- -----------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'households', 'household_members', 'child_profiles', 'curriculum_versions',
    'worlds', 'units', 'lessons', 'characters', 'words', 'sentences', 'stories',
    'media_assets', 'learning_sessions', 'child_skill_states',
    'child_confusion_stats', 'reward_catalog', 'child_inventory', 'child_world_state'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end $$;


commit;
