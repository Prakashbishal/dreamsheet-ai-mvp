begin;

alter table public.dreamkey_subscriptions
  add column if not exists price_id uuid null,
  add column if not exists stripe_checkout_session_id text null;

alter table public.dreamkey_subscriptions
  drop constraint if exists dreamkey_subscriptions_price_plan_fkey;

alter table public.dreamkey_subscriptions
  add constraint dreamkey_subscriptions_price_plan_fkey
  foreign key (price_id, plan_id)
  references public.dreamkey_prices(id, plan_id);

create unique index if not exists dreamkey_subscriptions_checkout_session_uidx
  on public.dreamkey_subscriptions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create table if not exists public.dreamkey_subscription_grants (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.dreamkey_subscriptions(id) on delete cascade,
  stripe_invoice_id text not null unique,
  stripe_event_id text null,
  keys_granted integer not null,
  billing_period_start timestamptz null,
  billing_period_end timestamptz null,
  created_at timestamptz not null default now(),
  constraint dreamkey_subscription_grants_invoice_check
    check (length(btrim(stripe_invoice_id)) > 0),
  constraint dreamkey_subscription_grants_event_check
    check (stripe_event_id is null or length(btrim(stripe_event_id)) > 0),
  constraint dreamkey_subscription_grants_keys_check
    check (keys_granted > 0),
  constraint dreamkey_subscription_grants_period_check
    check (
      billing_period_start is null
      or billing_period_end is null
      or billing_period_end >= billing_period_start
    )
);

create index if not exists dreamkey_subscription_grants_subscription_created_idx
  on public.dreamkey_subscription_grants (subscription_id, created_at desc);

alter table public.dreamkey_subscription_grants enable row level security;
revoke all on table public.dreamkey_subscription_grants from anon, authenticated;
grant select on table public.dreamkey_subscription_grants to authenticated;

drop policy if exists "Authenticated users can view their DREAMKey subscription grants"
  on public.dreamkey_subscription_grants;
create policy "Authenticated users can view their DREAMKey subscription grants"
  on public.dreamkey_subscription_grants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.dreamkey_subscriptions as subscriptions
      where subscriptions.id = dreamkey_subscription_grants.subscription_id
        and subscriptions.user_id = (select auth.uid())
    )
  );

-- Called only after the webhook has independently verified the Stripe
-- Checkout Session. This binds the remote subscription to its local pending
-- row so invoice events can be fulfilled even when webhooks arrive out of order.
create or replace function public.bind_dreamkey_stripe_subscription(
  p_local_subscription_id uuid,
  p_stripe_subscription_id text,
  p_stripe_customer_id text
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_subscription public.dreamkey_subscriptions%rowtype;
begin
  if p_local_subscription_id is null
    or btrim(coalesce(p_stripe_subscription_id, '')) = ''
    or btrim(coalesce(p_stripe_customer_id, '')) = ''
  then
    raise exception 'Verified Stripe subscription identifiers are required'
      using errcode = '22023';
  end if;

  select subscriptions.*
  into v_subscription
  from public.dreamkey_subscriptions as subscriptions
  where subscriptions.id = p_local_subscription_id
  for update;

  if not found
    or btrim(coalesce(v_subscription.stripe_checkout_session_id, '')) = ''
    or (
      v_subscription.stripe_customer_id is not null
      and v_subscription.stripe_customer_id is distinct from p_stripe_customer_id
    )
    or (
      v_subscription.stripe_subscription_id is not null
      and v_subscription.stripe_subscription_id is distinct from p_stripe_subscription_id
    )
  then
    raise exception 'Local subscription cannot be bound to this Stripe subscription'
      using errcode = '22023';
  end if;

  update public.dreamkey_subscriptions
  set
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id
  where id = v_subscription.id;

  return pg_catalog.jsonb_build_object(
    'subscriptionId', v_subscription.id,
    'bound', true
  );
end;
$function$;

create or replace function public.fulfil_dreamkey_subscription_invoice(
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_stripe_invoice_id text,
  p_stripe_event_id text,
  p_invoice_paid boolean,
  p_stripe_price_id text,
  p_currency text,
  p_billing_period_start timestamptz,
  p_billing_period_end timestamptz
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_subscription public.dreamkey_subscriptions%rowtype;
  v_plan public.dreamkey_plans%rowtype;
  v_price public.dreamkey_prices%rowtype;
  v_existing_grant public.dreamkey_subscription_grants%rowtype;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  if btrim(coalesce(p_stripe_subscription_id, '')) = ''
    or btrim(coalesce(p_stripe_customer_id, '')) = ''
    or btrim(coalesce(p_stripe_invoice_id, '')) = ''
    or btrim(coalesce(p_stripe_event_id, '')) = ''
    or p_invoice_paid is distinct from true
    or btrim(coalesce(p_stripe_price_id, '')) = ''
    or v_currency !~ '^[A-Z]{3}$'
    or p_billing_period_start is null
    or p_billing_period_end is null
    or p_billing_period_end < p_billing_period_start
  then
    raise exception 'Verified Stripe invoice details are invalid'
      using errcode = '22023';
  end if;

  select subscriptions.*
  into v_subscription
  from public.dreamkey_subscriptions as subscriptions
  where subscriptions.stripe_subscription_id = p_stripe_subscription_id
  for update;

  if not found
    or v_subscription.price_id is null
    or v_subscription.status = 'ended'
    or v_subscription.stripe_customer_id is distinct from p_stripe_customer_id
    or v_subscription.currency is distinct from v_currency
    or v_subscription.keys_per_cycle is null
    or v_subscription.keys_per_cycle <= 0
  then
    raise exception 'DREAMKey subscription is not fulfilable'
      using errcode = '22023';
  end if;

  select plans.*
  into v_plan
  from public.dreamkey_plans as plans
  where plans.id = v_subscription.plan_id;

  if not found
    or not v_plan.active
    or v_plan.billing_type not in ('monthly', 'yearly')
    or v_plan.code not in ('dreamkey_monthly', 'dreamkey_yearly')
    or v_plan.key_allowance is null
    or v_plan.key_allowance <= 0
    or v_plan.key_allowance <> v_subscription.keys_per_cycle
    or (v_plan.billing_type = 'monthly' and v_plan.code <> 'dreamkey_monthly')
    or (v_plan.billing_type = 'yearly' and v_plan.code <> 'dreamkey_yearly')
  then
    raise exception 'DREAMKey subscription plan is invalid'
      using errcode = '22023';
  end if;

  select prices.*
  into v_price
  from public.dreamkey_prices as prices
  where prices.id = v_subscription.price_id
    and prices.plan_id = v_subscription.plan_id;

  if not found
    or v_price.stripe_price_id is distinct from p_stripe_price_id
    or v_price.currency <> v_currency
  then
    raise exception 'Stripe invoice price does not match subscription configuration'
      using errcode = '22023';
  end if;

  select grants.*
  into v_existing_grant
  from public.dreamkey_subscription_grants as grants
  where grants.stripe_invoice_id = p_stripe_invoice_id;

  if found then
    if v_existing_grant.subscription_id <> v_subscription.id
      or v_existing_grant.keys_granted <> v_subscription.keys_per_cycle
    then
      raise exception 'Stripe invoice is linked to inconsistent fulfilment state'
        using errcode = '23514';
    end if;

    return pg_catalog.jsonb_build_object(
      'subscriptionId', v_subscription.id,
      'grantId', v_existing_grant.id,
      'keysGranted', v_existing_grant.keys_granted,
      'alreadyFulfilled', true
    );
  end if;

  insert into public.dreamkey_subscription_grants (
    subscription_id,
    stripe_invoice_id,
    stripe_event_id,
    keys_granted,
    billing_period_start,
    billing_period_end
  )
  values (
    v_subscription.id,
    p_stripe_invoice_id,
    p_stripe_event_id,
    v_subscription.keys_per_cycle,
    p_billing_period_start,
    p_billing_period_end
  )
  returning * into v_existing_grant;

  insert into public.dreamkey_entitlements (
    user_id,
    plan_id,
    source_type,
    status,
    subscription_id
  )
  select
    v_subscription.user_id,
    v_subscription.plan_id,
    'subscription',
    'available',
    v_subscription.id
  from pg_catalog.generate_series(1, v_subscription.keys_per_cycle);

  update public.dreamkey_subscriptions
  set
    status = case
      when status in ('cancelled', 'ended') then status
      else 'active'
    end,
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id,
    current_period_start = p_billing_period_start,
    current_period_end = p_billing_period_end
  where id = v_subscription.id;

  return pg_catalog.jsonb_build_object(
    'subscriptionId', v_subscription.id,
    'grantId', v_existing_grant.id,
    'keysGranted', v_subscription.keys_per_cycle,
    'alreadyFulfilled', false
  );
end;
$function$;

revoke execute on function public.bind_dreamkey_stripe_subscription(
  uuid, text, text
) from public, anon, authenticated;
revoke execute on function public.fulfil_dreamkey_subscription_invoice(
  text, text, text, text, boolean, text, text, timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.bind_dreamkey_stripe_subscription(
  uuid, text, text
) to service_role;
grant execute on function public.fulfil_dreamkey_subscription_invoice(
  text, text, text, text, boolean, text, text, timestamptz, timestamptz
) to service_role;

commit;
