begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';

select has_column(
  'public',
  'child_profiles',
  'spoken_profile',
  'child profile stores an age-appropriate spoken-language enum'
);
select has_function(
  'public',
  'create_child_profile_with_consents',
  array[
    'uuid',
    'text',
    'text',
    'text',
    'text',
    'smallint',
    'smallint',
    'text[]',
    'boolean',
    'boolean',
    'text'
  ],
  'atomic child profile and consent RPC exists'
);
select has_function(
  'public',
  'record_consent_choice',
  array['uuid', 'uuid', 'text', 'text', 'boolean', 'text'],
  'append-only consent choice RPC exists'
);

select throws_ok(
  $$insert into public.child_profiles (
      household_id, display_name, age_band, spoken_profile, interests
    ) values (
      '90000000-0000-4000-8000-000000000101',
      'Invalid interest',
      '6-7',
      'beginner',
      array['targeted-advertising']
    )$$,
  '23514',
  null,
  'unapproved child interests are rejected'
);

-- Revoke a required household consent, proving that an active profile is archived
-- and that another active profile cannot be created until current consent returns.
select lives_ok(
  $$select public.record_consent_choice(
      '90000000-0000-4000-8000-000000000101',
      null,
      'required_processing',
      'child-data-2026-01',
      false,
      'US'
    )$$,
  'required consent can be withdrawn through an append-only record'
);
select results_eq(
  $$select archived_at is not null from public.child_profiles
    where id = '90000000-0000-4000-8000-000000000201'$$,
  $$values (true)$$,
  'required consent withdrawal immediately archives the child profile'
);
select throws_ok(
  $$insert into public.child_profiles (
      household_id, display_name, age_band, spoken_profile
    ) values (
      '90000000-0000-4000-8000-000000000101',
      'Blocked without consent',
      '6-7',
      'beginner'
    )$$,
  'P0001',
  'CURRENT_REQUIRED_CONSENT_MISSING',
  'an active child profile cannot be created without current required consent'
);

select lives_ok(
  $$select public.create_child_profile_with_consents(
      '90000000-0000-4000-8000-000000000101',
      'Consent test child',
      '8-10',
      'limited_speaking',
      'simplified',
      8,
      4,
      array['space', 'science'],
      true,
      true,
      'US'
    )$$,
  'current required consent and child-specific options are recorded atomically'
);
select results_eq(
  $$select count(*)::bigint
    from public.consent_records
    where household_id = '90000000-0000-4000-8000-000000000101'
      and child_id = (
        select id from public.child_profiles where display_name = 'Consent test child'
      )
      and consent_type in ('ai_personalization', 'cloud_speech')
      and granted$$,
  $$values (2::bigint)$$,
  'AI and cloud speech grants are separate records'
);

select results_eq(
  $$select ai_personalization_enabled, cloud_speech_enabled
    from public.child_profiles
    where display_name = 'Consent test child'$$,
  $$values (true, true)$$,
  'the atomic flow applies both independently granted options'
);

select lives_ok(
  $$select public.record_consent_choice(
      '90000000-0000-4000-8000-000000000101',
      (select id from public.child_profiles where display_name = 'Consent test child'),
      'ai_personalization',
      'ai-personalization-2026-01',
      false,
      'US'
    )$$,
  'AI consent can be withdrawn independently for one child'
);
select results_eq(
  $$select ai_personalization_enabled, cloud_speech_enabled
    from public.child_profiles
    where display_name = 'Consent test child'$$,
  $$values (false, true)$$,
  'AI withdrawal disables AI immediately without changing speech'
);

select lives_ok(
  $$select public.record_consent_choice(
      '90000000-0000-4000-8000-000000000101',
      (select id from public.child_profiles where display_name = 'Consent test child'),
      'cloud_speech',
      'cloud-speech-2026-01',
      false,
      'US'
    )$$,
  'cloud speech consent can be withdrawn independently for one child'
);
select results_eq(
  $$select ai_personalization_enabled, cloud_speech_enabled
    from public.child_profiles
    where display_name = 'Consent test child'$$,
  $$values (false, false)$$,
  'speech withdrawal disables speech immediately and leaves AI disabled'
);

select * from finish();
rollback;
