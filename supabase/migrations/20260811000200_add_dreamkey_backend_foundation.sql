begin;

-- DREAMKey commercial foundation. This migration intentionally creates no
-- checkout/webhook integration and does not require a key to complete a legacy
-- or currently ungated DREAMSheet journey.

create table public.dreamkey_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  billing_type text not null,
  key_allowance integer null,
  description text null,
  active boolean not null default true,
  featured boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dreamkey_plans_code_normalized_check
    check (code = lower(btrim(code)) and length(code) > 0),
  constraint dreamkey_plans_billing_type_check
    check (billing_type in ('one_time', 'monthly', 'yearly', 'enterprise')),
  constraint dreamkey_plans_key_allowance_check
    check (key_allowance is null or key_allowance > 0)
);

create table public.dreamkey_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.dreamkey_plans(id),
  currency text not null,
  amount_minor integer not null,
  stripe_price_id text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dreamkey_prices_id_plan_unique unique (id, plan_id),
  constraint dreamkey_prices_currency_check
    check (currency = upper(btrim(currency)) and currency ~ '^[A-Z]{3}$'),
  constraint dreamkey_prices_amount_check check (amount_minor >= 0)
);

create unique index dreamkey_prices_stripe_price_id_uidx
  on public.dreamkey_prices (stripe_price_id)
  where stripe_price_id is not null;

create index dreamkey_prices_plan_active_idx
  on public.dreamkey_prices (plan_id, active);

create table public.dreamkey_affiliates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  email text null,
  active boolean not null default true,
  commission_type text not null,
  commission_value integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dreamkey_affiliates_code_normalized_check
    check (code = upper(btrim(code)) and length(code) > 0),
  constraint dreamkey_affiliates_commission_type_check
    check (commission_type in ('percentage', 'fixed')),
  constraint dreamkey_affiliates_commission_value_check
    check (
      (commission_type = 'percentage' and commission_value > 0 and commission_value <= 100)
      or (commission_type = 'fixed' and commission_value > 0)
    )
);

create table public.dreamkey_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null,
  discount_type text null,
  discount_value integer null,
  key_grant_count integer not null default 0,
  affiliate_id uuid null references public.dreamkey_affiliates(id),
  active boolean not null default true,
  starts_at timestamptz null,
  expires_at timestamptz null,
  max_redemptions_total integer null,
  max_redemptions_per_user integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dreamkey_codes_code_normalized_check
    check (code = upper(btrim(code)) and length(code) > 0),
  constraint dreamkey_codes_type_check
    check (type in ('free', 'discount', 'affiliate')),
  constraint dreamkey_codes_discount_type_check
    check (discount_type is null or discount_type in ('percentage', 'fixed')),
  constraint dreamkey_codes_value_shape_check
    check (
      (
        type = 'free'
        and discount_type is null
        and discount_value is null
        and key_grant_count > 0
        and affiliate_id is null
      )
      or (
        type = 'discount'
        and key_grant_count = 0
        and discount_type is not null
        and discount_value is not null
        and affiliate_id is null
      )
      or (
        type = 'affiliate'
        and key_grant_count = 0
        and affiliate_id is not null
        and (
          (discount_type is null and discount_value is null)
          or (discount_type is not null and discount_value is not null)
        )
      )
    ),
  constraint dreamkey_codes_discount_value_check
    check (
      (discount_type is null and discount_value is null)
      or (discount_type = 'percentage' and discount_value > 0 and discount_value <= 100)
      or (discount_type = 'fixed' and discount_value > 0)
    ),
  constraint dreamkey_codes_redemption_limits_check
    check (
      (max_redemptions_total is null or max_redemptions_total > 0)
      and (max_redemptions_per_user is null or max_redemptions_per_user > 0)
    ),
  constraint dreamkey_codes_dates_check
    check (starts_at is null or expires_at is null or expires_at >= starts_at)
);

create index dreamkey_codes_active_window_idx
  on public.dreamkey_codes (active, starts_at, expires_at);

create table public.dreamkey_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.dreamkey_plans(id),
  price_id uuid null,
  provider text not null default 'stripe',
  status text not null,
  currency text not null,
  gross_amount_minor integer not null,
  discount_amount_minor integer not null default 0,
  net_amount_minor integer not null,
  keys_granted integer not null default 0,
  voucher_redemption_id uuid null,
  affiliate_id uuid null references public.dreamkey_affiliates(id),
  stripe_checkout_session_id text null,
  stripe_payment_intent_id text null,
  created_at timestamptz not null default now(),
  paid_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint dreamkey_purchases_price_plan_fkey
    foreign key (price_id, plan_id)
    references public.dreamkey_prices(id, plan_id),
  constraint dreamkey_purchases_provider_check
    check (length(btrim(provider)) > 0),
  constraint dreamkey_purchases_status_check
    check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  constraint dreamkey_purchases_currency_check
    check (currency = upper(btrim(currency)) and currency ~ '^[A-Z]{3}$'),
  constraint dreamkey_purchases_amounts_check
    check (
      gross_amount_minor >= 0
      and discount_amount_minor >= 0
      and net_amount_minor >= 0
      and discount_amount_minor <= gross_amount_minor
      and gross_amount_minor - discount_amount_minor = net_amount_minor
    ),
  constraint dreamkey_purchases_keys_granted_check check (keys_granted >= 0)
);

create unique index dreamkey_purchases_checkout_session_uidx
  on public.dreamkey_purchases (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index dreamkey_purchases_payment_intent_uidx
  on public.dreamkey_purchases (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index dreamkey_purchases_user_created_at_idx
  on public.dreamkey_purchases (user_id, created_at desc);

create table public.dreamkey_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.dreamkey_plans(id),
  status text not null,
  currency text null,
  keys_per_cycle integer null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dreamkey_subscriptions_status_check
    check (status in ('pending', 'active', 'past_due', 'cancelled', 'ended')),
  constraint dreamkey_subscriptions_currency_check
    check (currency is null or (currency = upper(btrim(currency)) and currency ~ '^[A-Z]{3}$')),
  constraint dreamkey_subscriptions_keys_per_cycle_check
    check (keys_per_cycle is null or keys_per_cycle >= 0),
  constraint dreamkey_subscriptions_period_check
    check (
      current_period_start is null
      or current_period_end is null
      or current_period_end >= current_period_start
    )
);

create unique index dreamkey_subscriptions_stripe_subscription_uidx
  on public.dreamkey_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index dreamkey_subscriptions_user_status_idx
  on public.dreamkey_subscriptions (user_id, status);

create table public.dreamkey_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.dreamkey_codes(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid null references public.dreamkey_purchases(id),
  redeemed_at timestamptz not null default now()
);

create index dreamkey_code_redemptions_code_idx
  on public.dreamkey_code_redemptions (code_id, redeemed_at);

create index dreamkey_code_redemptions_code_user_idx
  on public.dreamkey_code_redemptions (code_id, user_id, redeemed_at);

create index dreamkey_code_redemptions_user_idx
  on public.dreamkey_code_redemptions (user_id, redeemed_at desc);

create unique index dreamkey_code_redemptions_purchase_uidx
  on public.dreamkey_code_redemptions (purchase_id)
  where purchase_id is not null;

alter table public.dreamkey_purchases
  add constraint dreamkey_purchases_voucher_redemption_fkey
  foreign key (voucher_redemption_id)
  references public.dreamkey_code_redemptions(id);

create table public.dreamkey_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid null references public.dreamkey_plans(id),
  source_type text not null,
  status text not null default 'available',
  purchase_id uuid null references public.dreamkey_purchases(id),
  subscription_id uuid null references public.dreamkey_subscriptions(id),
  voucher_redemption_id uuid null references public.dreamkey_code_redemptions(id),
  submission_id uuid null references public.submissions(id) on delete set null,
  granted_at timestamptz not null default now(),
  reserved_at timestamptz null,
  consumed_at timestamptz null,
  revoked_at timestamptz null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dreamkey_entitlements_submission_unique unique (submission_id),
  constraint dreamkey_entitlements_source_type_check
    check (source_type in ('purchase', 'subscription', 'free_voucher', 'affiliate', 'enterprise', 'admin')),
  constraint dreamkey_entitlements_source_reference_check
    check (
      (source_type <> 'purchase' or purchase_id is not null)
      and (source_type <> 'subscription' or subscription_id is not null)
      and (source_type <> 'free_voucher' or voucher_redemption_id is not null)
      and (source_type <> 'affiliate' or purchase_id is not null)
    ),
  constraint dreamkey_entitlements_status_check
    check (status in ('available', 'reserved', 'consumed', 'revoked')),
  constraint dreamkey_entitlements_state_consistency_check
    check (
      (
        status = 'available'
        and submission_id is null
        and reserved_at is null
        and consumed_at is null
        and revoked_at is null
      )
      or (
        status = 'reserved'
        and submission_id is not null
        and reserved_at is not null
        and consumed_at is null
        and revoked_at is null
      )
      or (
        status = 'consumed'
        and reserved_at is not null
        and consumed_at is not null
        and revoked_at is null
      )
      or (status = 'revoked' and revoked_at is not null)
    )
);

create index dreamkey_entitlements_user_status_created_idx
  on public.dreamkey_entitlements (user_id, status, created_at);

create index dreamkey_entitlements_user_expires_idx
  on public.dreamkey_entitlements (user_id, expires_at);

create table public.dreamkey_affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.dreamkey_affiliates(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null references public.dreamkey_purchases(id),
  code_id uuid null references public.dreamkey_codes(id),
  gross_amount_minor integer not null,
  discount_amount_minor integer not null default 0,
  net_amount_minor integer not null,
  commission_amount_minor integer not null,
  commission_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dreamkey_affiliate_attributions_purchase_unique unique (purchase_id),
  constraint dreamkey_affiliate_attributions_amounts_check
    check (
      gross_amount_minor >= 0
      and discount_amount_minor >= 0
      and net_amount_minor >= 0
      and commission_amount_minor >= 0
      and discount_amount_minor <= gross_amount_minor
      and gross_amount_minor - discount_amount_minor = net_amount_minor
    ),
  constraint dreamkey_affiliate_attributions_status_check
    check (commission_status in ('pending', 'approved', 'paid', 'void'))
);

create index dreamkey_affiliate_attributions_user_idx
  on public.dreamkey_affiliate_attributions (user_id, created_at desc);

-- Structural plan records only. Recurring allowances intentionally remain null
-- until the commercial values are approved.
insert into public.dreamkey_plans (
  code,
  name,
  billing_type,
  key_allowance,
  description,
  featured,
  display_order
)
values
  ('dreamkey_single', 'One DREAMKey', 'one_time', 1, 'One complete DREAMSheet journey.', false, 10),
  ('dreamkey_monthly', 'DREAMKey Monthly', 'monthly', null, 'Recurring monthly DREAMKey access.', false, 20),
  ('dreamkey_yearly', 'DREAMKey Yearly', 'yearly', null, 'Recurring yearly DREAMKey access.', true, 30),
  ('dreamkey_enterprise', 'Teams & Coaches', 'enterprise', null, 'Managed or volume DREAMKey access.', false, 40)
on conflict (code) do nothing;

-- One reusable timestamp trigger for all DREAMKey tables with updated_at.
create or replace function public.set_dreamkey_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke execute on function public.set_dreamkey_updated_at()
  from public, anon, authenticated;

drop trigger if exists dreamkey_plans_set_updated_at on public.dreamkey_plans;
create trigger dreamkey_plans_set_updated_at
  before update on public.dreamkey_plans
  for each row execute function public.set_dreamkey_updated_at();

drop trigger if exists dreamkey_prices_set_updated_at on public.dreamkey_prices;
create trigger dreamkey_prices_set_updated_at
  before update on public.dreamkey_prices
  for each row execute function public.set_dreamkey_updated_at();

drop trigger if exists dreamkey_affiliates_set_updated_at on public.dreamkey_affiliates;
create trigger dreamkey_affiliates_set_updated_at
  before update on public.dreamkey_affiliates
  for each row execute function public.set_dreamkey_updated_at();

drop trigger if exists dreamkey_codes_set_updated_at on public.dreamkey_codes;
create trigger dreamkey_codes_set_updated_at
  before update on public.dreamkey_codes
  for each row execute function public.set_dreamkey_updated_at();

drop trigger if exists dreamkey_purchases_set_updated_at on public.dreamkey_purchases;
create trigger dreamkey_purchases_set_updated_at
  before update on public.dreamkey_purchases
  for each row execute function public.set_dreamkey_updated_at();

drop trigger if exists dreamkey_subscriptions_set_updated_at on public.dreamkey_subscriptions;
create trigger dreamkey_subscriptions_set_updated_at
  before update on public.dreamkey_subscriptions
  for each row execute function public.set_dreamkey_updated_at();

drop trigger if exists dreamkey_entitlements_set_updated_at on public.dreamkey_entitlements;
create trigger dreamkey_entitlements_set_updated_at
  before update on public.dreamkey_entitlements
  for each row execute function public.set_dreamkey_updated_at();

drop trigger if exists dreamkey_affiliate_attributions_set_updated_at
  on public.dreamkey_affiliate_attributions;
create trigger dreamkey_affiliate_attributions_set_updated_at
  before update on public.dreamkey_affiliate_attributions
  for each row execute function public.set_dreamkey_updated_at();

-- Every commercial table uses RLS. Table grants are read-only where an
-- authenticated user has a safe ownership/public-data policy; all writes go
-- through trusted backend processing or the narrowly scoped RPCs below.
alter table public.dreamkey_plans enable row level security;
alter table public.dreamkey_prices enable row level security;
alter table public.dreamkey_purchases enable row level security;
alter table public.dreamkey_subscriptions enable row level security;
alter table public.dreamkey_entitlements enable row level security;
alter table public.dreamkey_codes enable row level security;
alter table public.dreamkey_code_redemptions enable row level security;
alter table public.dreamkey_affiliates enable row level security;
alter table public.dreamkey_affiliate_attributions enable row level security;

revoke all on table public.dreamkey_plans from anon, authenticated;
revoke all on table public.dreamkey_prices from anon, authenticated;
revoke all on table public.dreamkey_purchases from anon, authenticated;
revoke all on table public.dreamkey_subscriptions from anon, authenticated;
revoke all on table public.dreamkey_entitlements from anon, authenticated;
revoke all on table public.dreamkey_codes from anon, authenticated;
revoke all on table public.dreamkey_code_redemptions from anon, authenticated;
revoke all on table public.dreamkey_affiliates from anon, authenticated;
revoke all on table public.dreamkey_affiliate_attributions from anon, authenticated;

grant select on table public.dreamkey_plans to authenticated;
grant select on table public.dreamkey_prices to authenticated;
grant select on table public.dreamkey_purchases to authenticated;
grant select on table public.dreamkey_subscriptions to authenticated;
grant select on table public.dreamkey_entitlements to authenticated;
grant select on table public.dreamkey_code_redemptions to authenticated;

drop policy if exists "Authenticated users can view active DREAMKey plans"
  on public.dreamkey_plans;
create policy "Authenticated users can view active DREAMKey plans"
  on public.dreamkey_plans
  for select
  to authenticated
  using (active);

drop policy if exists "Authenticated users can view active DREAMKey prices"
  on public.dreamkey_prices;
create policy "Authenticated users can view active DREAMKey prices"
  on public.dreamkey_prices
  for select
  to authenticated
  using (
    active
    and exists (
      select 1
      from public.dreamkey_plans
      where dreamkey_plans.id = dreamkey_prices.plan_id
        and dreamkey_plans.active
    )
  );

drop policy if exists "Authenticated users can view their DREAMKey purchases"
  on public.dreamkey_purchases;
create policy "Authenticated users can view their DREAMKey purchases"
  on public.dreamkey_purchases
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can view their DREAMKey subscriptions"
  on public.dreamkey_subscriptions;
create policy "Authenticated users can view their DREAMKey subscriptions"
  on public.dreamkey_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can view their DREAMKey entitlements"
  on public.dreamkey_entitlements;
create policy "Authenticated users can view their DREAMKey entitlements"
  on public.dreamkey_entitlements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can view their DREAMKey redemptions"
  on public.dreamkey_code_redemptions;
create policy "Authenticated users can view their DREAMKey redemptions"
  on public.dreamkey_code_redemptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No SELECT policy or table grant is created for dreamkey_codes or
-- dreamkey_affiliates. Affiliate attributions also remain private because they
-- contain partner commission data. Codes are checked only through RPCs.

create or replace function public.reserve_dreamkey_for_submission(p_submission_id uuid)
returns public.dreamkey_entitlements
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_submission_user_id uuid;
  v_submission_status text;
  v_entitlement public.dreamkey_entitlements%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_submission_id is null then
    raise exception 'A draft submission is required' using errcode = '22023';
  end if;

  -- Serialise reservation attempts for the same draft before checking
  -- idempotency. Entitlement row locks below protect different drafts racing
  -- for the same available key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_submission_id::text, 1145459021)
  );

  select submissions.user_id, submissions.status
  into v_submission_user_id, v_submission_status
  from public.submissions
  where submissions.id = p_submission_id;

  if not found or v_submission_user_id is distinct from v_user_id then
    raise exception 'DREAMSheet draft not found or unavailable'
      using errcode = 'P0002';
  end if;

  if v_submission_status <> 'draft' then
    raise exception 'Only draft DREAMSheets can reserve a DREAMKey'
      using errcode = '22023';
  end if;

  select entitlements.*
  into v_entitlement
  from public.dreamkey_entitlements as entitlements
  where entitlements.submission_id = p_submission_id
    and entitlements.user_id = v_user_id;

  if found then
    if v_entitlement.status = 'reserved' then
      return v_entitlement;
    end if;

    raise exception 'This DREAMSheet already has a non-reservable DREAMKey'
      using errcode = '23505';
  end if;

  select entitlements.*
  into v_entitlement
  from public.dreamkey_entitlements as entitlements
  where entitlements.user_id = v_user_id
    and entitlements.status = 'available'
    and (entitlements.expires_at is null or entitlements.expires_at > now())
  order by entitlements.expires_at asc nulls last,
    entitlements.granted_at asc,
    entitlements.id asc
  for update skip locked
  limit 1;

  if not found then
    raise exception 'No usable DREAMKey is available' using errcode = 'P0001';
  end if;

  update public.dreamkey_entitlements
  set
    status = 'reserved',
    submission_id = p_submission_id,
    reserved_at = now()
  where id = v_entitlement.id
    and user_id = v_user_id
    and status = 'available'
  returning * into v_entitlement;

  if not found then
    raise exception 'The DREAMKey could not be reserved' using errcode = '40001';
  end if;

  return v_entitlement;
end;
$function$;

create or replace function public.get_my_dreamkey_for_submission(p_submission_id uuid)
returns setof public.dreamkey_entitlements
language sql
stable
set search_path = ''
as $function$
  select entitlements.*
  from public.dreamkey_entitlements as entitlements
  inner join public.submissions as submissions
    on submissions.id = entitlements.submission_id
  where entitlements.submission_id = p_submission_id
    and entitlements.user_id = auth.uid()
    and submissions.user_id = auth.uid();
$function$;

create or replace function public.get_my_dreamkey_balance()
returns table (available bigint, reserved bigint)
language sql
stable
set search_path = ''
as $function$
  select
    count(*) filter (
      where entitlements.status = 'available'
        and (entitlements.expires_at is null or entitlements.expires_at > now())
    ) as available,
    count(*) filter (where entitlements.status = 'reserved') as reserved
  from public.dreamkey_entitlements as entitlements
  where entitlements.user_id = auth.uid();
$function$;

create or replace function public.redeem_free_dreamkey_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_normalized_code text := upper(btrim(coalesce(p_code, '')));
  v_code public.dreamkey_codes%rowtype;
  v_total_redemptions bigint;
  v_user_redemptions bigint;
  v_redemption_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_normalized_code = '' then
    raise exception 'A DREAMKey code is required' using errcode = '22023';
  end if;

  -- Locking the code row serialises limit checks and redemption creation.
  select codes.*
  into v_code
  from public.dreamkey_codes as codes
  where codes.code = v_normalized_code
  for update;

  if not found
    or not v_code.active
    or (v_code.starts_at is not null and v_code.starts_at > now())
    or (v_code.expires_at is not null and v_code.expires_at <= now())
    or v_code.type <> 'free'
  then
    raise exception 'This DREAMKey code is invalid or unavailable'
      using errcode = '22023';
  end if;

  select count(*)
  into v_total_redemptions
  from public.dreamkey_code_redemptions
  where code_id = v_code.id;

  if v_code.max_redemptions_total is not null
    and v_total_redemptions >= v_code.max_redemptions_total
  then
    raise exception 'This DREAMKey code is no longer available'
      using errcode = '22023';
  end if;

  select count(*)
  into v_user_redemptions
  from public.dreamkey_code_redemptions
  where code_id = v_code.id
    and user_id = v_user_id;

  if v_code.max_redemptions_per_user is not null
    and v_user_redemptions >= v_code.max_redemptions_per_user
  then
    raise exception 'This DREAMKey code has already been used the maximum number of times'
      using errcode = '22023';
  end if;

  insert into public.dreamkey_code_redemptions (code_id, user_id)
  values (v_code.id, v_user_id)
  returning id into v_redemption_id;

  insert into public.dreamkey_entitlements (
    user_id,
    source_type,
    status,
    voucher_redemption_id
  )
  -- plan_id remains null intentionally: a complimentary key is an entitlement
  -- source in its own right and is not a purchase of a priced plan.
  select
    v_user_id,
    'free_voucher',
    'available',
    v_redemption_id
  from pg_catalog.generate_series(1, v_code.key_grant_count);

  return pg_catalog.jsonb_build_object(
    'success', true,
    'keysGranted', v_code.key_grant_count
  );
end;
$function$;

create or replace function public.validate_dreamkey_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_normalized_code text := upper(btrim(coalesce(p_code, '')));
  v_code public.dreamkey_codes%rowtype;
  v_total_redemptions bigint;
  v_user_redemptions bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_normalized_code = '' then
    return pg_catalog.jsonb_build_object('valid', false);
  end if;

  select codes.*
  into v_code
  from public.dreamkey_codes as codes
  where codes.code = v_normalized_code
    and codes.active
    and (codes.starts_at is null or codes.starts_at <= now())
    and (codes.expires_at is null or codes.expires_at > now());

  if not found then
    return pg_catalog.jsonb_build_object('valid', false);
  end if;

  if v_code.max_redemptions_total is not null then
    select count(*)
    into v_total_redemptions
    from public.dreamkey_code_redemptions
    where code_id = v_code.id;

    if v_total_redemptions >= v_code.max_redemptions_total then
      return pg_catalog.jsonb_build_object('valid', false);
    end if;
  end if;

  if v_code.max_redemptions_per_user is not null then
    select count(*)
    into v_user_redemptions
    from public.dreamkey_code_redemptions
    where code_id = v_code.id
      and user_id = v_user_id;

    if v_user_redemptions >= v_code.max_redemptions_per_user then
      return pg_catalog.jsonb_build_object('valid', false);
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'valid', true,
    'type', v_code.type,
    'discountType', v_code.discount_type,
    'discountValue', v_code.discount_value
  );
end;
$function$;

-- Completion remains valid without a key. If an exact reserved key exists,
-- database-level consumption prevents the browser from skipping the transition.
create or replace function public.consume_reserved_dreamkey_on_submission_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.dreamkey_entitlements
    set
      status = 'consumed',
      consumed_at = now()
    where submission_id = new.id
      and user_id = new.user_id
      and status = 'reserved';
  end if;

  return new;
end;
$function$;

-- Deleting an unfinished draft must not strand its reserved key. Completed
-- entitlements remain consumed; their submission_id is cleared by the FK.
create or replace function public.release_reserved_dreamkey_on_submission_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.dreamkey_entitlements
  set
    status = 'available',
    submission_id = null,
    reserved_at = null
  where submission_id = old.id
    and user_id = old.user_id
    and status = 'reserved';

  return old;
end;
$function$;

drop trigger if exists submissions_consume_reserved_dreamkey on public.submissions;
create trigger submissions_consume_reserved_dreamkey
  after update of status on public.submissions
  for each row
  when (old.status is distinct from new.status)
  execute function public.consume_reserved_dreamkey_on_submission_completion();

drop trigger if exists submissions_release_reserved_dreamkey on public.submissions;
create trigger submissions_release_reserved_dreamkey
  before delete on public.submissions
  for each row
  execute function public.release_reserved_dreamkey_on_submission_delete();

revoke execute on function public.reserve_dreamkey_for_submission(uuid) from public, anon;
revoke execute on function public.get_my_dreamkey_for_submission(uuid) from public, anon;
revoke execute on function public.get_my_dreamkey_balance() from public, anon;
revoke execute on function public.redeem_free_dreamkey_code(text) from public, anon;
revoke execute on function public.validate_dreamkey_code(text) from public, anon;
revoke execute on function public.consume_reserved_dreamkey_on_submission_completion()
  from public, anon, authenticated;
revoke execute on function public.release_reserved_dreamkey_on_submission_delete()
  from public, anon, authenticated;

grant execute on function public.reserve_dreamkey_for_submission(uuid) to authenticated;
grant execute on function public.get_my_dreamkey_for_submission(uuid) to authenticated;
grant execute on function public.get_my_dreamkey_balance() to authenticated;
grant execute on function public.redeem_free_dreamkey_code(text) to authenticated;
grant execute on function public.validate_dreamkey_code(text) to authenticated;

commit;
