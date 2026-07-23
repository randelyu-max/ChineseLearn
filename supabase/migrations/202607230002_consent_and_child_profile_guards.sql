-- Task 2.4: versioned consent and privacy-minimizing child profiles.

begin;

alter table public.child_profiles
  add column if not exists spoken_profile text not null default 'understands_more';

alter table public.child_profiles
  drop constraint if exists child_profiles_spoken_profile_check;
alter table public.child_profiles
  add constraint child_profiles_spoken_profile_check
  check (
    spoken_profile in (
      'home_primary',
      'understands_more',
      'limited_speaking',
      'beginner'
    )
  );

create or replace function public.approved_child_interests_valid(candidate text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    candidate is not null
    and cardinality(candidate) <= 3
    and candidate <@ array[
      'animals',
      'dinosaurs',
      'food',
      'music',
      'myths',
      'nature',
      'science',
      'space',
      'sports',
      'vehicles'
    ]::text[]
    and cardinality(candidate) = (
      select count(distinct interest)
      from unnest(candidate) as interest
    );
$$;

alter table public.child_profiles
  drop constraint if exists child_profiles_interests_approved_check;
alter table public.child_profiles
  add constraint child_profiles_interests_approved_check
  check (public.approved_child_interests_valid(interests));

alter table public.consent_records
  drop constraint if exists consent_records_consent_type_check;
alter table public.consent_records
  add constraint consent_records_consent_type_check
  check (
    consent_type in (
      'terms_of_service',
      'privacy_policy',
      'required_processing',
      'ai_personalization',
      'cloud_speech',
      'marketing'
    )
  );

alter table public.consent_records
  drop constraint if exists consent_records_grant_state_check;
alter table public.consent_records
  add constraint consent_records_grant_state_check
  check (
    (granted and revoked_at is null)
    or (not granted and revoked_at is not null)
  );

alter table public.consent_records
  add column if not exists event_sequence bigint generated always as identity;

create index if not exists idx_consent_records_effective_choice
  on public.consent_records (
    household_id,
    child_id,
    consent_type,
    document_version,
    event_sequence desc
  );

create or replace function public.has_current_consent(
  requested_household_id uuid,
  requested_child_id uuid,
  requested_type text,
  requested_version text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  active boolean;
begin
  if requested_child_id is not null then
    select cr.granted and cr.revoked_at is null
    into active
    from public.consent_records cr
    where cr.household_id = requested_household_id
      and cr.child_id = requested_child_id
      and cr.consent_type = requested_type
      and cr.document_version = requested_version
    order by cr.event_sequence desc
    limit 1;

    if found then
      return active;
    end if;
  end if;

  select cr.granted and cr.revoked_at is null
  into active
  from public.consent_records cr
  where cr.household_id = requested_household_id
    and cr.child_id is null
    and cr.consent_type = requested_type
    and cr.document_version = requested_version
  order by cr.event_sequence desc
  limit 1;

  return coalesce(active, false);
end;
$$;

create or replace function public.enforce_child_profile_consents()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.archived_at is not null then
    return new;
  end if;

  if not public.has_current_consent(
    new.household_id, new.id, 'terms_of_service', 'terms-2026-01'
  ) or not public.has_current_consent(
    new.household_id, new.id, 'privacy_policy', 'privacy-2026-01'
  ) or not public.has_current_consent(
    new.household_id, new.id, 'required_processing', 'child-data-2026-01'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CURRENT_REQUIRED_CONSENT_MISSING';
  end if;

  if new.ai_personalization_enabled and not public.has_current_consent(
    new.household_id, new.id, 'ai_personalization', 'ai-personalization-2026-01'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CURRENT_AI_CONSENT_MISSING';
  end if;

  if new.cloud_speech_enabled and not public.has_current_consent(
    new.household_id, new.id, 'cloud_speech', 'cloud-speech-2026-01'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CURRENT_SPEECH_CONSENT_MISSING';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_child_profile_consents on public.child_profiles;
create trigger enforce_child_profile_consents
before insert or update on public.child_profiles
for each row execute function public.enforce_child_profile_consents();

create or replace function public.apply_consent_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.granted and new.revoked_at is null then
    return new;
  end if;

  if new.consent_type = 'ai_personalization' then
    update public.child_profiles
    set ai_personalization_enabled = false
    where household_id = new.household_id
      and (new.child_id is null or id = new.child_id);
  elsif new.consent_type = 'cloud_speech' then
    update public.child_profiles
    set cloud_speech_enabled = false
    where household_id = new.household_id
      and (new.child_id is null or id = new.child_id);
  elsif new.consent_type in (
    'terms_of_service',
    'privacy_policy',
    'required_processing'
  ) then
    update public.child_profiles
    set
      ai_personalization_enabled = false,
      cloud_speech_enabled = false,
      archived_at = coalesce(archived_at, timezone('utc', now()))
    where household_id = new.household_id
      and (new.child_id is null or id = new.child_id);
  end if;

  return new;
end;
$$;

drop trigger if exists apply_consent_withdrawal on public.consent_records;
create trigger apply_consent_withdrawal
after insert on public.consent_records
for each row execute function public.apply_consent_withdrawal();

create or replace function public.record_consent_choice(
  p_household_id uuid,
  p_child_id uuid,
  p_consent_type text,
  p_document_version text,
  p_granted boolean,
  p_country_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  record_id uuid;
begin
  if auth.uid() is null or not public.can_manage_household(p_household_id) then
    raise exception using errcode = '42501', message = 'CONSENT_NOT_AUTHORIZED';
  end if;

  if p_consent_type not in (
    'terms_of_service',
    'privacy_policy',
    'required_processing',
    'ai_personalization',
    'cloud_speech'
  ) then
    raise exception using errcode = '22023', message = 'CONSENT_TYPE_NOT_SUPPORTED';
  end if;

  insert into public.consent_records (
    household_id,
    child_id,
    granted_by,
    consent_type,
    document_version,
    country_code,
    granted,
    revoked_at,
    metadata
  )
  values (
    p_household_id,
    p_child_id,
    auth.uid(),
    p_consent_type,
    p_document_version,
    p_country_code,
    p_granted,
    case when p_granted then null else timezone('utc', now()) end,
    jsonb_build_object('flow_version', 'mobile-task-2.4')
  )
  returning id into record_id;

  return record_id;
end;
$$;

create or replace function public.create_child_profile_with_consents(
  p_household_id uuid,
  p_display_name text,
  p_age_band text,
  p_spoken_profile text,
  p_script_track text,
  p_target_minutes smallint,
  p_target_days_per_week smallint,
  p_interests text[],
  p_ai_personalization_granted boolean,
  p_cloud_speech_granted boolean,
  p_country_code text default null
)
returns public.child_profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  created_profile public.child_profiles;
begin
  if auth.uid() is null or not public.can_manage_household(p_household_id) then
    raise exception using errcode = '42501', message = 'CHILD_PROFILE_NOT_AUTHORIZED';
  end if;

  perform public.record_consent_choice(
    p_household_id, null, 'terms_of_service', 'terms-2026-01', true, p_country_code
  );
  perform public.record_consent_choice(
    p_household_id, null, 'privacy_policy', 'privacy-2026-01', true, p_country_code
  );
  perform public.record_consent_choice(
    p_household_id, null, 'required_processing', 'child-data-2026-01', true, p_country_code
  );

  insert into public.child_profiles (
    household_id,
    display_name,
    age_band,
    spoken_profile,
    script_track,
    target_minutes,
    target_days_per_week,
    interests,
    ai_personalization_enabled,
    cloud_speech_enabled
  )
  values (
    p_household_id,
    p_display_name,
    p_age_band,
    p_spoken_profile,
    p_script_track::public.script_track,
    p_target_minutes,
    p_target_days_per_week,
    p_interests,
    false,
    false
  )
  returning * into created_profile;

  perform public.record_consent_choice(
    p_household_id,
    created_profile.id,
    'ai_personalization',
    'ai-personalization-2026-01',
    p_ai_personalization_granted,
    p_country_code
  );
  perform public.record_consent_choice(
    p_household_id,
    created_profile.id,
    'cloud_speech',
    'cloud-speech-2026-01',
    p_cloud_speech_granted,
    p_country_code
  );

  update public.child_profiles
  set
    ai_personalization_enabled = p_ai_personalization_granted,
    cloud_speech_enabled = p_cloud_speech_granted
  where id = created_profile.id
  returning * into created_profile;

  return created_profile;
end;
$$;

revoke all on function public.approved_child_interests_valid(text[]) from public;
revoke all on function public.has_current_consent(uuid, uuid, text, text) from public;
revoke all on function public.enforce_child_profile_consents() from public;
revoke all on function public.apply_consent_withdrawal() from public;
revoke all on function public.record_consent_choice(uuid, uuid, text, text, boolean, text) from public;
revoke all on function public.create_child_profile_with_consents(
  uuid, text, text, text, text, smallint, smallint, text[], boolean, boolean, text
) from public;

grant execute on function public.record_consent_choice(uuid, uuid, text, text, boolean, text)
  to authenticated, service_role;
grant execute on function public.create_child_profile_with_consents(
  uuid, text, text, text, text, smallint, smallint, text[], boolean, boolean, text
)
  to authenticated, service_role;
grant execute on function public.has_current_consent(uuid, uuid, text, text)
  to service_role;
grant execute on function public.approved_child_interests_valid(text[])
  to authenticated, service_role;
grant update (spoken_profile) on public.child_profiles to authenticated;

commit;
