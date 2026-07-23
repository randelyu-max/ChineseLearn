-- Local-only deterministic fixtures for household isolation tests.
-- These placeholder Auth rows have no password and cannot sign in. Tests impersonate
-- them by setting JWT claims; manual login users should be created through Auth APIs.

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '90000000-0000-4000-8000-000000000001',
    'family-a@example.test',
    '{"fixture":"household-a"}'::jsonb
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    'family-b@example.test',
    '{"fixture":"household-b"}'::jsonb
  ),
  (
    '90000000-0000-4000-8000-000000000003',
    'family-a-parent@example.test',
    '{"fixture":"household-a-parent"}'::jsonb
  ),
  (
    '90000000-0000-4000-8000-000000000004',
    'family-a-viewer@example.test',
    '{"fixture":"household-a-viewer"}'::jsonb
  )
on conflict (id) do update
set email = excluded.email,
    raw_user_meta_data = excluded.raw_user_meta_data;

insert into public.households (
  id,
  owner_user_id,
  display_name,
  country_code,
  preferred_parent_locale,
  time_zone
)
values
  (
    '90000000-0000-4000-8000-000000000101',
    '90000000-0000-4000-8000-000000000001',
    'Isolation family A',
    'US',
    'zh-CN',
    'America/Los_Angeles'
  ),
  (
    '90000000-0000-4000-8000-000000000102',
    '90000000-0000-4000-8000-000000000002',
    'Isolation family B',
    'GB',
    'en-GB',
    'Europe/London'
  )
on conflict (id) do update
set display_name = excluded.display_name,
    country_code = excluded.country_code,
    preferred_parent_locale = excluded.preferred_parent_locale,
    time_zone = excluded.time_zone;

insert into public.household_members (household_id, user_id, role, status)
values
  (
    '90000000-0000-4000-8000-000000000101',
    '90000000-0000-4000-8000-000000000001',
    'owner',
    'active'
  ),
  (
    '90000000-0000-4000-8000-000000000102',
    '90000000-0000-4000-8000-000000000002',
    'owner',
    'active'
  ),
  (
    '90000000-0000-4000-8000-000000000101',
    '90000000-0000-4000-8000-000000000003',
    'parent',
    'active'
  ),
  (
    '90000000-0000-4000-8000-000000000101',
    '90000000-0000-4000-8000-000000000004',
    'viewer',
    'active'
  )
on conflict (household_id, user_id) do update
set role = excluded.role,
    status = excluded.status;

-- Current household-level versions come before child profiles because every active
-- profile requires all current mandatory consent.
insert into public.consent_records (
  id,
  household_id,
  child_id,
  granted_by,
  consent_type,
  document_version,
  country_code,
  granted,
  granted_at,
  metadata
)
values
  (
    '90000000-0000-4000-8000-000000000310',
    '90000000-0000-4000-8000-000000000101',
    null,
    '90000000-0000-4000-8000-000000000001',
    'terms_of_service',
    'terms-2026-01',
    'US',
    true,
    '2026-01-01T00:00:00Z',
    '{"fixture":true}'::jsonb
  ),
  (
    '90000000-0000-4000-8000-000000000311',
    '90000000-0000-4000-8000-000000000101',
    null,
    '90000000-0000-4000-8000-000000000001',
    'privacy_policy',
    'privacy-2026-01',
    'US',
    true,
    '2026-01-01T00:00:00Z',
    '{"fixture":true}'::jsonb
  ),
  (
    '90000000-0000-4000-8000-000000000312',
    '90000000-0000-4000-8000-000000000101',
    null,
    '90000000-0000-4000-8000-000000000001',
    'required_processing',
    'child-data-2026-01',
    'US',
    true,
    '2026-01-01T00:00:00Z',
    '{"fixture":true}'::jsonb
  ),
  (
    '90000000-0000-4000-8000-000000000313',
    '90000000-0000-4000-8000-000000000102',
    null,
    '90000000-0000-4000-8000-000000000002',
    'terms_of_service',
    'terms-2026-01',
    'GB',
    true,
    '2026-01-01T00:00:00Z',
    '{"fixture":true}'::jsonb
  ),
  (
    '90000000-0000-4000-8000-000000000314',
    '90000000-0000-4000-8000-000000000102',
    null,
    '90000000-0000-4000-8000-000000000002',
    'privacy_policy',
    'privacy-2026-01',
    'GB',
    true,
    '2026-01-01T00:00:00Z',
    '{"fixture":true}'::jsonb
  ),
  (
    '90000000-0000-4000-8000-000000000315',
    '90000000-0000-4000-8000-000000000102',
    null,
    '90000000-0000-4000-8000-000000000002',
    'required_processing',
    'child-data-2026-01',
    'GB',
    true,
    '2026-01-01T00:00:00Z',
    '{"fixture":true}'::jsonb
  )
on conflict (id) do nothing;

insert into public.child_profiles (
  id,
  household_id,
  display_name,
  age_band,
  script_track,
  target_minutes,
  target_days_per_week,
  interests
)
values
  (
    '90000000-0000-4000-8000-000000000201',
    '90000000-0000-4000-8000-000000000101',
    'Learner A',
    '6-7',
    'simplified',
    8,
    4,
    array['animals']::text[]
  ),
  (
    '90000000-0000-4000-8000-000000000202',
    '90000000-0000-4000-8000-000000000102',
    'Learner B',
    '8-10',
    'traditional',
    8,
    4,
    array['science']::text[]
  )
on conflict (id) do update
set display_name = excluded.display_name,
    age_band = excluded.age_band,
    script_track = excluded.script_track,
    target_minutes = excluded.target_minutes,
    target_days_per_week = excluded.target_days_per_week,
    interests = excluded.interests;

insert into public.consent_records (
  id,
  household_id,
  child_id,
  granted_by,
  consent_type,
  document_version,
  country_code,
  granted,
  granted_at,
  metadata
)
values
  (
    '90000000-0000-4000-8000-000000000301',
    '90000000-0000-4000-8000-000000000101',
    '90000000-0000-4000-8000-000000000201',
    '90000000-0000-4000-8000-000000000001',
    'required_processing',
    'local-fixture-v1',
    'US',
    true,
    '2026-01-01T00:00:00Z',
    '{"fixture":true}'::jsonb
  ),
  (
    '90000000-0000-4000-8000-000000000302',
    '90000000-0000-4000-8000-000000000102',
    '90000000-0000-4000-8000-000000000202',
    '90000000-0000-4000-8000-000000000002',
    'required_processing',
    'local-fixture-v1',
    'GB',
    true,
    '2026-01-01T00:00:00Z',
    '{"fixture":true}'::jsonb
  )
on conflict (id) do nothing;
