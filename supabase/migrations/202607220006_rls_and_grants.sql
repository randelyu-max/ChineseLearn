-- Ordered HanziQuest migration. Apply only through the Supabase CLI.

begin;

-- -----------------------------------------------------------------------------
-- Authorization helper functions
-- -----------------------------------------------------------------------------

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
  );
$$;

create or replace function public.can_manage_household(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
      and hm.role in ('owner', 'parent')
  );
$$;

create or replace function public.can_view_child(target_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.child_profiles cp
    join public.household_members hm on hm.household_id = cp.household_id
    where cp.id = target_child_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
  );
$$;

create or replace function public.can_manage_child(target_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.child_profiles cp
    join public.household_members hm on hm.household_id = cp.household_id
    where cp.id = target_child_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
      and hm.role in ('owner', 'parent')
  );
$$;

create or replace function public.create_household_with_owner(
  p_display_name text default 'My family',
  p_country_code text default null,
  p_parent_locale text default 'zh-CN',
  p_time_zone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.households (
    owner_user_id,
    display_name,
    country_code,
    preferred_parent_locale,
    time_zone
  )
  values (
    current_user_id,
    coalesce(nullif(trim(p_display_name), ''), 'My family'),
    p_country_code,
    p_parent_locale,
    p_time_zone
  )
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role, status)
  values (new_household_id, current_user_id, 'owner', 'active');

  return new_household_id;
end;
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.can_manage_household(uuid) from public;
revoke all on function public.can_view_child(uuid) from public;
revoke all on function public.can_manage_child(uuid) from public;
revoke all on function public.create_household_with_owner(text, text, text, text) from public;
revoke all on function public.set_updated_at() from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.can_manage_household(uuid) to authenticated;
grant execute on function public.can_view_child(uuid) to authenticated;
grant execute on function public.can_manage_child(uuid) to authenticated;
grant execute on function public.create_household_with_owner(text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.child_profiles enable row level security;
alter table public.consent_records enable row level security;
alter table public.data_requests enable row level security;
alter table public.curriculum_versions enable row level security;
alter table public.worlds enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.characters enable row level security;
alter table public.words enable row level security;
alter table public.sentences enable row level security;
alter table public.stories enable row level security;
alter table public.lesson_concepts enable row level security;
alter table public.confusable_pairs enable row level security;
alter table public.media_assets enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.child_skill_states enable row level security;
alter table public.child_confusion_stats enable row level security;
alter table public.reward_catalog enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.child_inventory enable row level security;
alter table public.child_world_state enable row level security;
alter table public.ai_generation_jobs enable row level security;

-- Households are created atomically with create_household_with_owner(). Direct
-- client INSERT is intentionally not granted, preventing orphan households.
create policy households_select_member
  on public.households for select to authenticated
  using (public.is_household_member(id));


create policy households_update_manager
  on public.households for update to authenticated
  using (public.can_manage_household(id))
  with check (public.can_manage_household(id));


create policy household_members_select_member
  on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

-- Membership creation, role changes, and revocation are server-only so invitation
-- validation cannot be bypassed by a modified client.

create policy child_profiles_select_member
  on public.child_profiles for select to authenticated
  using (public.is_household_member(household_id));

create policy child_profiles_insert_manager
  on public.child_profiles for insert to authenticated
  with check (public.can_manage_household(household_id));

create policy child_profiles_update_manager
  on public.child_profiles for update to authenticated
  using (public.can_manage_household(household_id))
  with check (public.can_manage_household(household_id));


create policy consent_records_select_member
  on public.consent_records for select to authenticated
  using (public.is_household_member(household_id));

create policy consent_records_insert_manager
  on public.consent_records for insert to authenticated
  with check (
    public.can_manage_household(household_id)
    and granted_by = (select auth.uid())
    and (
      child_id is null
      or (
        public.can_manage_child(child_id)
        and exists (
          select 1
          from public.child_profiles cp
          where cp.id = consent_records.child_id
            and cp.household_id = consent_records.household_id
        )
      )
    )
  );

-- Consent history is append-only. Revocation should create a new record through a
-- trusted endpoint, preserving the audit trail.

create policy data_requests_select_member
  on public.data_requests for select to authenticated
  using (public.is_household_member(household_id));

create policy data_requests_insert_manager
  on public.data_requests for insert to authenticated
  with check (
    public.can_manage_household(household_id)
    and requested_by = (select auth.uid())
    and (
      child_id is null
      or (
        public.can_manage_child(child_id)
        and exists (
          select 1
          from public.child_profiles cp
          where cp.id = data_requests.child_id
            and cp.household_id = data_requests.household_id
        )
      )
    )
  );

-- Published curriculum is readable by signed-in parents/children. Draft writes and
-- publication remain server/admin only.
create policy curriculum_versions_select_published
  on public.curriculum_versions for select to authenticated
  using (status = 'published');

create policy worlds_select_published
  on public.worlds for select to authenticated
  using (
    is_published
    and exists (
      select 1 from public.curriculum_versions cv
      where cv.id = curriculum_version_id and cv.status = 'published'
    )
  );

create policy units_select_published
  on public.units for select to authenticated
  using (
    is_published
    and exists (
      select 1
      from public.worlds w
      join public.curriculum_versions cv on cv.id = w.curriculum_version_id
      where w.id = world_id and w.is_published and cv.status = 'published'
    )
  );

create policy lessons_select_published
  on public.lessons for select to authenticated
  using (
    is_published
    and exists (
      select 1
      from public.units u
      join public.worlds w on w.id = u.world_id
      join public.curriculum_versions cv on cv.id = w.curriculum_version_id
      where u.id = unit_id
        and u.is_published and w.is_published and cv.status = 'published'
    )
  );

create policy characters_select_published
  on public.characters for select to authenticated using (is_published);

create policy words_select_published
  on public.words for select to authenticated using (is_published);

create policy sentences_select_published
  on public.sentences for select to authenticated using (is_published);

create policy stories_select_published
  on public.stories for select to authenticated
  using (
    is_published
    and exists (
      select 1 from public.curriculum_versions cv
      where cv.id = curriculum_version_id and cv.status = 'published'
    )
  );

create policy lesson_concepts_select_published
  on public.lesson_concepts for select to authenticated
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.is_published)
  );

create policy confusable_pairs_select_published
  on public.confusable_pairs for select to authenticated using (is_published);

create policy media_assets_select_published
  on public.media_assets for select to authenticated using (is_published);

-- Learning evidence and derived state are parent-readable but server-written.
create policy learning_sessions_select_family
  on public.learning_sessions for select to authenticated
  using (public.can_view_child(child_id));

create policy attempts_select_family
  on public.attempts for select to authenticated
  using (public.can_view_child(child_id));

create policy child_skill_states_select_family
  on public.child_skill_states for select to authenticated
  using (public.can_view_child(child_id));

create policy child_confusion_stats_select_family
  on public.child_confusion_stats for select to authenticated
  using (public.can_view_child(child_id));

create policy reward_catalog_select_active
  on public.reward_catalog for select to authenticated
  using (is_active);

create policy reward_transactions_select_family
  on public.reward_transactions for select to authenticated
  using (public.can_view_child(child_id));

create policy child_inventory_select_family
  on public.child_inventory for select to authenticated
  using (public.can_view_child(child_id));

create policy child_world_state_select_family
  on public.child_world_state for select to authenticated
  using (public.can_view_child(child_id));

-- AI audit rows may include internal safety metadata. Expose only through a curated
-- parent endpoint, not through direct PostgREST access; therefore no client policy.

-- -----------------------------------------------------------------------------
-- Explicit grants. RLS remains the final row-level gate.
-- -----------------------------------------------------------------------------

-- Be explicit even when running against an older project that auto-granted public
-- schema objects. The grants below form the complete authenticated-client surface.
revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to authenticated;

grant select on public.households to authenticated;
grant update (display_name, country_code, preferred_parent_locale, time_zone)
  on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert on public.child_profiles to authenticated;
grant update (
  display_name,
  avatar_key,
  age_band,
  spoken_track,
  script_track,
  interface_locale,
  target_minutes,
  target_days_per_week,
  interests,
  ai_personalization_enabled,
  cloud_speech_enabled,
  assessment_completed_at,
  archived_at
) on public.child_profiles to authenticated;
grant select, insert on public.consent_records to authenticated;
grant select, insert on public.data_requests to authenticated;

grant select on public.curriculum_versions to authenticated;
grant select on public.worlds to authenticated;
grant select on public.units to authenticated;
grant select on public.lessons to authenticated;
grant select on public.characters to authenticated;
grant select on public.words to authenticated;
grant select on public.sentences to authenticated;
grant select on public.stories to authenticated;
grant select on public.lesson_concepts to authenticated;
grant select on public.confusable_pairs to authenticated;
grant select on public.media_assets to authenticated;

grant select on public.learning_sessions to authenticated;
grant select on public.attempts to authenticated;
grant select on public.child_skill_states to authenticated;
grant select on public.child_confusion_stats to authenticated;
grant select on public.reward_catalog to authenticated;
grant select on public.reward_transactions to authenticated;
grant select on public.child_inventory to authenticated;
grant select on public.child_world_state to authenticated;

-- Service-role and postgres privileges are managed by Supabase. Never grant client
-- roles access to ai_generation_jobs, direct mastery writes, attempts, or rewards.


commit;
