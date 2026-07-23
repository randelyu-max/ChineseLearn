begin;

create extension if not exists pgtap with schema extensions;
select plan(34);

-- Synthetic server-owned rows used only inside this rolled-back test transaction.
insert into public.curriculum_versions (
  id,
  version,
  script_track,
  status
)
values (
  '91000000-0000-4000-8000-000000000001',
  'rls-fixture-v1',
  'simplified',
  'draft'
);

insert into public.learning_sessions (
  id,
  child_id,
  curriculum_version_id,
  status,
  target_minutes,
  plan_version,
  plan
)
values
  (
    '91000000-0000-4000-8000-000000000101',
    '90000000-0000-4000-8000-000000000201',
    '91000000-0000-4000-8000-000000000001',
    'planned',
    8,
    'test-v1',
    '{}'::jsonb
  ),
  (
    '91000000-0000-4000-8000-000000000102',
    '90000000-0000-4000-8000-000000000202',
    '91000000-0000-4000-8000-000000000001',
    'planned',
    8,
    'test-v1',
    '{}'::jsonb
  );

insert into public.attempts (
  id,
  offline_event_id,
  session_id,
  child_id,
  concept_type,
  concept_id,
  skill,
  activity_type,
  correct,
  device_event_at,
  evidence_weight
)
values
  (
    '91000000-0000-4000-8000-000000000201',
    '91000000-0000-4000-8000-000000000211',
    '91000000-0000-4000-8000-000000000101',
    '90000000-0000-4000-8000-000000000201',
    'character',
    '91000000-0000-4000-8000-000000000221',
    'audio_to_glyph',
    'audio_to_glyph',
    true,
    '2026-01-02T00:00:00Z',
    0.8
  ),
  (
    '91000000-0000-4000-8000-000000000202',
    '91000000-0000-4000-8000-000000000212',
    '91000000-0000-4000-8000-000000000102',
    '90000000-0000-4000-8000-000000000202',
    'character',
    '91000000-0000-4000-8000-000000000222',
    'audio_to_glyph',
    'audio_to_glyph',
    true,
    '2026-01-02T00:00:00Z',
    0.8
  );

insert into public.reward_transactions (
  id,
  child_id,
  amount,
  source_type,
  source_id,
  idempotency_key
)
values
  (
    '91000000-0000-4000-8000-000000000301',
    '90000000-0000-4000-8000-000000000201',
    1,
    'session',
    'rls-session-a',
    'rls-reward-a'
  ),
  (
    '91000000-0000-4000-8000-000000000302',
    '90000000-0000-4000-8000-000000000202',
    1,
    'session',
    'rls-session-b',
    'rls-reward-b'
  );

insert into public.parent_reports (
  id,
  child_id,
  period_start,
  period_end,
  facts
)
values
  (
    '91000000-0000-4000-8000-000000000401',
    '90000000-0000-4000-8000-000000000201',
    '2026-01-01',
    '2026-01-07',
    '{"fixture":"a"}'::jsonb
  ),
  (
    '91000000-0000-4000-8000-000000000402',
    '90000000-0000-4000-8000-000000000202',
    '2026-01-01',
    '2026-01-07',
    '{"fixture":"b"}'::jsonb
  );

select has_table('public', 'parent_reports', 'parent report table exists');
select ok(
  (select rolbypassrls from pg_roles where rolname = 'service_role'),
  'service_role is the server-only RLS bypass role'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';

select results_eq(
  $$select id from public.child_profiles order by id$$,
  $$values ('90000000-0000-4000-8000-000000000201'::uuid)$$,
  'owner A reads only family A child'
);
select results_eq(
  $$select id from public.learning_sessions order by id$$,
  $$values ('91000000-0000-4000-8000-000000000101'::uuid)$$,
  'owner A reads only family A session'
);
select results_eq(
  $$select id from public.attempts order by id$$,
  $$values ('91000000-0000-4000-8000-000000000201'::uuid)$$,
  'owner A reads only family A attempt'
);
select results_eq(
  $$select id from public.reward_transactions order by id$$,
  $$values ('91000000-0000-4000-8000-000000000301'::uuid)$$,
  'owner A reads only family A reward'
);
select results_eq(
  $$select id from public.parent_reports order by id$$,
  $$values ('91000000-0000-4000-8000-000000000401'::uuid)$$,
  'owner A reads only family A report'
);
select results_eq(
  $$select id from public.consent_records where child_id is not null order by id$$,
  $$values ('90000000-0000-4000-8000-000000000301'::uuid)$$,
  'owner A reads only family A consent'
);
select results_eq(
  $$with changed as (
      update public.child_profiles
      set display_name = 'blocked cross-family update'
      where id = '90000000-0000-4000-8000-000000000202'
      returning id
    ) select count(*)::bigint from changed$$,
  $$values (0::bigint)$$,
  'owner A cannot update family B child'
);
select throws_ok(
  $$insert into public.consent_records (
      household_id, child_id, granted_by, consent_type, document_version, granted
    ) values (
      '90000000-0000-4000-8000-000000000102',
      '90000000-0000-4000-8000-000000000202',
      '90000000-0000-4000-8000-000000000001',
      'required_processing', 'cross-family', true
    )$$,
  '42501',
  null,
  'owner A cannot insert family B consent'
);
select throws_ok(
  $$insert into public.learning_sessions (
      child_id, curriculum_version_id, status, target_minutes, plan_version, plan
    ) values (
      '90000000-0000-4000-8000-000000000202',
      '91000000-0000-4000-8000-000000000001',
      'planned', 8, 'client-write', '{}'::jsonb
    )$$,
  '42501', null, 'clients cannot insert sessions'
);
select throws_ok(
  $$insert into public.attempts (
      offline_event_id, session_id, child_id, concept_type, concept_id, skill,
      activity_type, correct, device_event_at, evidence_weight
    ) values (
      gen_random_uuid(),
      '91000000-0000-4000-8000-000000000102',
      '90000000-0000-4000-8000-000000000202',
      'character', gen_random_uuid(), 'audio_to_glyph', 'audio_to_glyph', true, now(), 0.8
    )$$,
  '42501', null, 'clients cannot insert attempts'
);
select throws_ok(
  $$insert into public.reward_transactions (
      child_id, amount, source_type, source_id, idempotency_key
    ) values (
      '90000000-0000-4000-8000-000000000202', 1, 'session', 'client', 'client'
    )$$,
  '42501', null, 'clients cannot insert rewards'
);
select throws_ok(
  $$insert into public.parent_reports (
      child_id, period_start, period_end, facts
    ) values (
      '90000000-0000-4000-8000-000000000202', '2026-02-01', '2026-02-07', '{}'::jsonb
    )$$,
  '42501', null, 'clients cannot insert reports'
);
select results_eq(
  $$with changed as (
      update public.child_profiles
      set display_name = 'Owner A updated'
      where id = '90000000-0000-4000-8000-000000000201'
      returning id
    ) select count(*)::bigint from changed$$,
  $$values (1::bigint)$$,
  'owner can update own child mutable fields'
);
select results_eq(
  $$with changed as (
      update public.households
      set display_name = 'Owner A household'
      where id = '90000000-0000-4000-8000-000000000101'
      returning id
    ) select count(*)::bigint from changed$$,
  $$values (1::bigint)$$,
  'owner can update own household settings'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000003';

select results_eq(
  $$select id from public.child_profiles order by id$$,
  $$values ('90000000-0000-4000-8000-000000000201'::uuid)$$,
  'parent reads family child'
);
select results_eq(
  $$select id from public.parent_reports order by id$$,
  $$values ('91000000-0000-4000-8000-000000000401'::uuid)$$,
  'parent reads family report'
);
select results_eq(
  $$with changed as (
      update public.child_profiles
      set target_minutes = 10
      where id = '90000000-0000-4000-8000-000000000201'
      returning id
    ) select count(*)::bigint from changed$$,
  $$values (1::bigint)$$,
  'parent can update family child mutable fields'
);
select results_eq(
  $$with changed as (
      update public.households
      set preferred_parent_locale = 'en-US'
      where id = '90000000-0000-4000-8000-000000000101'
      returning id
    ) select count(*)::bigint from changed$$,
  $$values (1::bigint)$$,
  'parent can update family settings'
);
select throws_ok(
  $$update public.household_members
    set role = 'owner'
    where household_id = '90000000-0000-4000-8000-000000000101'$$,
  '42501', null, 'parent cannot change membership roles directly'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000004';

select results_eq(
  $$select id from public.child_profiles order by id$$,
  $$values ('90000000-0000-4000-8000-000000000201'::uuid)$$,
  'viewer reads family child'
);
select results_eq(
  $$select id from public.learning_sessions order by id$$,
  $$values ('91000000-0000-4000-8000-000000000101'::uuid)$$,
  'viewer reads family session'
);
select results_eq(
  $$select id from public.parent_reports order by id$$,
  $$values ('91000000-0000-4000-8000-000000000401'::uuid)$$,
  'viewer reads family report'
);
select results_eq(
  $$with changed as (
      update public.child_profiles
      set display_name = 'viewer blocked'
      where id = '90000000-0000-4000-8000-000000000201'
      returning id
    ) select count(*)::bigint from changed$$,
  $$values (0::bigint)$$,
  'viewer cannot update child'
);
select results_eq(
  $$with changed as (
      update public.households
      set display_name = 'viewer blocked'
      where id = '90000000-0000-4000-8000-000000000101'
      returning id
    ) select count(*)::bigint from changed$$,
  $$values (0::bigint)$$,
  'viewer cannot update household'
);
select throws_ok(
  $$insert into public.child_profiles (
      household_id, display_name, age_band
    ) values (
      '90000000-0000-4000-8000-000000000101', 'viewer insert', '6-7'
    )$$,
  '42501', null, 'viewer cannot create child profiles'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';

select results_eq(
  $$select id from public.child_profiles order by id$$,
  $$values ('90000000-0000-4000-8000-000000000202'::uuid)$$,
  'owner B reads only family B child'
);
select results_eq(
  $$select id from public.parent_reports order by id$$,
  $$values ('91000000-0000-4000-8000-000000000402'::uuid)$$,
  'owner B reads only family B report'
);

set local role anon;
select throws_ok(
  $$select id from public.child_profiles$$,
  '42501', null, 'anonymous role is denied private child data'
);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select id from public.ai_generation_jobs$$,
  '42501', null, 'authenticated clients are denied AI audit rows by default'
);

set local role service_role;
select results_eq(
  $$select count(*)::bigint from public.child_profiles$$,
  $$values (2::bigint)$$,
  'server-only service role can process both family children'
);
select results_eq(
  $$select count(*)::bigint from public.parent_reports$$,
  $$values (2::bigint)$$,
  'server-only service role can process both family reports'
);
select lives_ok(
  $$insert into public.parent_reports (
      child_id, period_start, period_end, facts
    ) values (
      '90000000-0000-4000-8000-000000000201', '2026-02-01', '2026-02-07', '{}'::jsonb
    )$$,
  'server-only service role can write generated reports'
);

select * from finish();
rollback;
