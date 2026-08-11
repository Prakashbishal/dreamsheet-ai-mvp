-- DREAMKey backend adversarial manual verification template.
-- DO NOT RUN AGAINST PRODUCTION.
-- Every INSERT/UPDATE/DELETE section is explicitly marked [DESTRUCTIVE].
-- Use isolated Preview/local test users with no pre-existing DREAMKeys. Replace
-- every marker and run each numbered block separately after migration review.

-- Marker map:
-- USER_A  00000000-0000-0000-0000-000000000000  test.a@example.com
-- USER_B  22222222-2222-2222-2222-222222222222  test.b@example.com
-- A_DELETE_DRAFT       11111111-1111-1111-1111-111111111111
-- A_COMPLETION_DRAFT   33333333-3333-3333-3333-333333333333
-- A_NO_KEY_DRAFT       44444444-4444-4444-4444-444444444444
-- B_OWNED_DRAFT        55555555-5555-5555-5555-555555555555
-- B_NO_KEY_COMPLETION  66666666-6666-6666-6666-666666666666
-- FREE CODE            DREAMKEY_TEST_REPLACE_ME
-- GLOBAL-LIMIT CODE    DREAMKEY_GLOBAL_ONE_REPLACE_ME

-- 0. ADMIN PRE-FLIGHT (read only).
select id, email, created_at
from auth.users
where lower(email) in (lower('test.a@example.com'), lower('test.b@example.com'))
order by email;

select id, user_id, status
from public.submissions
where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  '66666666-6666-6666-6666-666666666666'::uuid
)
order by id;

-- Both test users must be isolated. Stop if this returns any usable key.
select id, user_id, status, submission_id, expires_at
from public.dreamkey_entitlements
where user_id in (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
)
  and status in ('available', 'reserved')
  and (expires_at is null or expires_at > now());

-- Security metadata: PUBLIC/anon must have no EXECUTE row. Authenticated should
-- have only the five client RPCs listed here, never either trigger function.
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'reserve_dreamkey_for_submission',
    'get_my_dreamkey_for_submission',
    'get_my_dreamkey_balance',
    'redeem_free_dreamkey_code',
    'validate_dreamkey_code',
    'consume_reserved_dreamkey_on_submission_completion',
    'release_reserved_dreamkey_on_submission_delete'
  )
order by routine_name, grantee;

-- Verify SECURITY DEFINER flags, trusted owners and fixed search_path metadata.
select
  procedures.proname,
  roles.rolname as owner,
  procedures.prosecdef as security_definer,
  procedures.proconfig
from pg_proc as procedures
inner join pg_namespace as namespaces on namespaces.oid = procedures.pronamespace
inner join pg_roles as roles on roles.oid = procedures.proowner
where namespaces.nspname = 'public'
  and procedures.proname in (
    'reserve_dreamkey_for_submission',
    'redeem_free_dreamkey_code',
    'validate_dreamkey_code',
    'consume_reserved_dreamkey_on_submission_completion',
    'release_reserved_dreamkey_on_submission_delete'
  )
order by procedures.proname;

-- 1. EXPIRED KEY IS EXCLUDED FROM BALANCE [DESTRUCTIVE: INSERT].
insert into public.dreamkey_entitlements (
  user_id,
  source_type,
  status,
  expires_at
)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin',
  'available',
  now() - interval '1 minute'
)
returning id, status, expires_at;

begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
select * from public.get_my_dreamkey_balance();
-- Expected: available = 0, reserved = 0.
rollback;

-- 2. AVAILABLE BALANCE [DESTRUCTIVE: INSERT].
insert into public.dreamkey_entitlements (user_id, source_type, status)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin',
  'available'
)
returning id, user_id, status, submission_id, expires_at;

begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
select * from public.get_my_dreamkey_balance();
-- Expected: available = 1, reserved = 0. The expired key remains excluded.
rollback;

-- 3. FIRST + IDEMPOTENT SECOND RESERVATION [DESTRUCTIVE: UPDATE].
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
select (public.reserve_dreamkey_for_submission(
  '11111111-1111-1111-1111-111111111111'::uuid
)).id as first_reservation_id;
select (public.reserve_dreamkey_for_submission(
  '11111111-1111-1111-1111-111111111111'::uuid
)).id as second_reservation_id;
select * from public.get_my_dreamkey_balance();
-- Expected: identical IDs; available = 0, reserved = 1.
commit;

-- 4. NO-KEY RESERVATION FAILURE [EXPECTED ERROR; run separately].
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
select public.reserve_dreamkey_for_submission(
  '44444444-4444-4444-4444-444444444444'::uuid
);
-- Expected: "No usable DREAMKey is available". Run ROLLBACK separately after
-- the expected error leaves this transaction aborted.

-- 5. CROSS-USER SUBMISSION REJECTION [EXPECTED ERROR; run separately].
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
select public.reserve_dreamkey_for_submission(
  '55555555-5555-5555-5555-555555555555'::uuid
);
-- Expected: generic "not found or unavailable". Run ROLLBACK separately.

-- 6. DRAFT DELETE RELEASES THE RESERVED KEY [DESTRUCTIVE: DELETE].
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
delete from public.submissions
where id = '11111111-1111-1111-1111-111111111111'::uuid
  and user_id = auth.uid()
  and status = 'draft';
select * from public.get_my_dreamkey_balance();
-- Expected: available = 1, reserved = 0.
commit;

-- Admin verification of the release trigger. The non-expired admin entitlement
-- must be available with no attachment/timestamp; it must never be reserved/null.
select id, status, submission_id, reserved_at, consumed_at, revoked_at
from public.dreamkey_entitlements
where user_id = '00000000-0000-0000-0000-000000000000'::uuid
  and expires_at is null;

-- 7. COMPLETION CONSUMES THE EXACT RESERVED KEY [DESTRUCTIVE: UPDATE].
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
select (public.reserve_dreamkey_for_submission(
  '33333333-3333-3333-3333-333333333333'::uuid
)).id as completion_entitlement_id;
update public.submissions
set status = 'completed'
where id = '33333333-3333-3333-3333-333333333333'::uuid
  and user_id = auth.uid()
  and status = 'draft';
select id, status, submission_id, reserved_at, consumed_at
from public.dreamkey_entitlements
where submission_id = '33333333-3333-3333-3333-333333333333'::uuid;
select * from public.get_my_dreamkey_balance();
-- Expected: status = consumed; available = 0, reserved = 0.
commit;

-- 8. CONSUMED KEY IS NEVER AVAILABLE AGAIN [EXPECTED ERROR; run separately].
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
select public.reserve_dreamkey_for_submission(
  '44444444-4444-4444-4444-444444444444'::uuid
);
-- Expected: no usable key. Run ROLLBACK separately.

-- 9. UNGATED COMPLETION STILL WORKS WITHOUT A KEY [DESTRUCTIVE: UPDATE].
begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
update public.submissions
set status = 'completed'
where id = '66666666-6666-6666-6666-666666666666'::uuid
  and user_id = auth.uid()
  and status = 'draft'
returning id, status;
-- Expected: one completed row; no entitlement is created or required.
commit;

-- 10. CREATE TEMPORARY FREE CODE [DESTRUCTIVE: INSERT].
insert into public.dreamkey_codes (
  code,
  type,
  key_grant_count,
  active,
  max_redemptions_total,
  max_redemptions_per_user
)
values ('DREAMKEY_TEST_REPLACE_ME', 'free', 1, true, 10, 1)
returning id, code, type, key_grant_count, max_redemptions_per_user;

-- 11. FIRST FREE-CODE REDEMPTION + NORMALISATION [DESTRUCTIVE: INSERTS].
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
select public.validate_dreamkey_code('  dreamkey_test_replace_me  ');
select public.redeem_free_dreamkey_code(' dreamkey_test_replace_me ');
select * from public.get_my_dreamkey_balance();
-- Expected: success/keysGranted = 1; available = 1.
commit;

-- Exact redemption -> entitlement audit link (admin read only).
select
  codes.code,
  redemptions.id as redemption_id,
  entitlements.id as entitlement_id,
  entitlements.voucher_redemption_id,
  entitlements.source_type,
  entitlements.plan_id
from public.dreamkey_codes as codes
inner join public.dreamkey_code_redemptions as redemptions
  on redemptions.code_id = codes.id
inner join public.dreamkey_entitlements as entitlements
  on entitlements.voucher_redemption_id = redemptions.id
where codes.code = 'DREAMKEY_TEST_REPLACE_ME'
  and redemptions.user_id = '00000000-0000-0000-0000-000000000000'::uuid;
-- Expected: voucher_redemption_id = redemption_id, source = free_voucher,
-- plan_id = NULL intentionally because voucher keys are plan-independent.

-- 12. REPEATED FREE-CODE REDEMPTION FAILS [EXPECTED ERROR; run separately].
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
select public.redeem_free_dreamkey_code('DREAMKEY_TEST_REPLACE_ME');
-- Expected: per-user limit error. Run ROLLBACK separately.

-- Admin verification after rollback: both counts must remain exactly 1.
select count(*) as redemptions
from public.dreamkey_code_redemptions as redemptions
inner join public.dreamkey_codes as codes on codes.id = redemptions.code_id
where codes.code = 'DREAMKEY_TEST_REPLACE_ME'
  and redemptions.user_id = '00000000-0000-0000-0000-000000000000'::uuid;

select count(*) as entitlements
from public.dreamkey_entitlements as entitlements
inner join public.dreamkey_code_redemptions as redemptions
  on redemptions.id = entitlements.voucher_redemption_id
inner join public.dreamkey_codes as codes on codes.id = redemptions.code_id
where codes.code = 'DREAMKEY_TEST_REPLACE_ME'
  and entitlements.user_id = '00000000-0000-0000-0000-000000000000'::uuid;

-- 13. GLOBAL-LIMIT CONCURRENCY TEST [DESTRUCTIVE: INSERT + TWO RPCs].
insert into public.dreamkey_codes (
  code,
  type,
  key_grant_count,
  active,
  max_redemptions_total,
  max_redemptions_per_user
)
values ('DREAMKEY_GLOBAL_ONE_REPLACE_ME', 'free', 1, true, 1, 1)
returning id, code;

-- Open two SQL editor sessions and execute the following transactions at the
-- same time. The code-row FOR UPDATE lock serialises them. Exactly one commits;
-- the waiter recounts after the first commit and fails the total limit.
-- Running both sessions as USER_A instead similarly proves the per-user limit:
-- one succeeds and the waiting request fails after recounting that user's rows.

-- SESSION A (USER_A):
begin;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
set local role authenticated;
select public.redeem_free_dreamkey_code('DREAMKEY_GLOBAL_ONE_REPLACE_ME');
commit;

-- SESSION B (USER_B, run concurrently in another editor):
begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.redeem_free_dreamkey_code('DREAMKEY_GLOBAL_ONE_REPLACE_ME');
commit;
-- Expected: one session succeeds; the other raises the global-limit error and
-- must be rolled back separately. Sequential execution produces the same final
-- count but does not exercise lock waiting.

select count(*) as global_limit_redemptions
from public.dreamkey_code_redemptions as redemptions
inner join public.dreamkey_codes as codes on codes.id = redemptions.code_id
where codes.code = 'DREAMKEY_GLOBAL_ONE_REPLACE_ME';
-- Expected: exactly 1.

-- Reservation concurrency reasoning/test setup:
-- - Same draft in two sessions: the submission advisory lock makes one wait;
--   the waiter returns the first session's entitlement after commit.
-- - Different drafts with one key: FOR UPDATE SKIP LOCKED lets only one session
--   lock/update the key; the other receives the no-key error.
-- Repeat block 3 from two sessions to exercise the first case with a fresh
-- draft/key. Use two fresh drafts and one fresh key for the second case.
