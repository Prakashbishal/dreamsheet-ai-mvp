begin;

-- Stripe is the payment authority, but only this service-role RPC may turn a
-- verified one-time payment into DREAMKey entitlements. The purchase row lock
-- makes duplicate/concurrent webhook delivery idempotent.
create index if not exists dreamkey_entitlements_purchase_idx
  on public.dreamkey_entitlements (purchase_id)
  where purchase_id is not null;

create or replace function public.fulfil_dreamkey_one_time_purchase(
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_stripe_price_id text,
  p_currency text,
  p_gross_amount_minor bigint,
  p_discount_amount_minor bigint,
  p_net_amount_minor bigint
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_purchase public.dreamkey_purchases%rowtype;
  v_plan public.dreamkey_plans%rowtype;
  v_price public.dreamkey_prices%rowtype;
  v_existing_entitlements bigint;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  if btrim(coalesce(p_checkout_session_id, '')) = ''
    or btrim(coalesce(p_stripe_price_id, '')) = ''
  then
    raise exception 'Verified Stripe identifiers are required'
      using errcode = '22023';
  end if;

  if v_currency !~ '^[A-Z]{3}$'
    or p_gross_amount_minor is null
    or p_discount_amount_minor is null
    or p_net_amount_minor is null
    or p_gross_amount_minor < 0
    or p_discount_amount_minor < 0
    or p_net_amount_minor < 0
    or p_gross_amount_minor > 2147483647
    or p_discount_amount_minor > 2147483647
    or p_net_amount_minor > 2147483647
    or p_discount_amount_minor > p_gross_amount_minor
    or p_gross_amount_minor - p_discount_amount_minor <> p_net_amount_minor
  then
    raise exception 'Verified Stripe amounts are invalid'
      using errcode = '22023';
  end if;

  select purchases.*
  into v_purchase
  from public.dreamkey_purchases as purchases
  where purchases.stripe_checkout_session_id = p_checkout_session_id
  for update;

  if not found then
    raise exception 'DREAMKey purchase not found' using errcode = 'P0002';
  end if;

  if v_purchase.provider <> 'stripe' or v_purchase.price_id is null then
    raise exception 'DREAMKey purchase provider or price is invalid'
      using errcode = '22023';
  end if;

  select plans.*
  into v_plan
  from public.dreamkey_plans as plans
  where plans.id = v_purchase.plan_id;

  if not found
    or v_plan.code <> 'dreamkey_single'
    or v_plan.billing_type <> 'one_time'
    or v_plan.key_allowance <> 1
  then
    raise exception 'DREAMKey purchase plan is not fulfilable'
      using errcode = '22023';
  end if;

  select prices.*
  into v_price
  from public.dreamkey_prices as prices
  where prices.id = v_purchase.price_id
    and prices.plan_id = v_purchase.plan_id;

  if not found
    or v_price.stripe_price_id is distinct from p_stripe_price_id
    or v_price.currency <> v_currency
    or v_price.amount_minor <> p_gross_amount_minor
    or v_purchase.currency <> v_currency
    or v_purchase.gross_amount_minor <> p_gross_amount_minor
    or v_purchase.discount_amount_minor <> p_discount_amount_minor
    or v_purchase.net_amount_minor <> p_net_amount_minor
  then
    raise exception 'Stripe price or amount does not match the purchase snapshot'
      using errcode = '22023';
  end if;

  select count(*)
  into v_existing_entitlements
  from public.dreamkey_entitlements as entitlements
  where entitlements.purchase_id = v_purchase.id;

  if v_purchase.status = 'paid' then
    if v_purchase.stripe_payment_intent_id is distinct from p_payment_intent_id
      or v_purchase.keys_granted <> v_plan.key_allowance
      or v_existing_entitlements <> v_plan.key_allowance
    then
      raise exception 'Paid DREAMKey purchase has inconsistent fulfilment state'
        using errcode = '23514';
    end if;

    return pg_catalog.jsonb_build_object(
      'purchaseId', v_purchase.id,
      'keysGranted', v_purchase.keys_granted,
      'alreadyFulfilled', true
    );
  end if;

  if v_purchase.status not in ('pending', 'failed') then
    raise exception 'DREAMKey purchase cannot be fulfilled from its current state'
      using errcode = '22023';
  end if;

  if v_existing_entitlements <> 0 then
    raise exception 'Unpaid DREAMKey purchase already has entitlements'
      using errcode = '23514';
  end if;

  update public.dreamkey_purchases
  set
    status = 'paid',
    stripe_payment_intent_id = p_payment_intent_id,
    gross_amount_minor = p_gross_amount_minor::integer,
    discount_amount_minor = p_discount_amount_minor::integer,
    net_amount_minor = p_net_amount_minor::integer,
    keys_granted = v_plan.key_allowance,
    paid_at = now()
  where id = v_purchase.id;

  insert into public.dreamkey_entitlements (
    user_id,
    plan_id,
    source_type,
    status,
    purchase_id
  )
  select
    v_purchase.user_id,
    v_purchase.plan_id,
    'purchase',
    'available',
    v_purchase.id
  from pg_catalog.generate_series(1, v_plan.key_allowance);

  return pg_catalog.jsonb_build_object(
    'purchaseId', v_purchase.id,
    'keysGranted', v_plan.key_allowance,
    'alreadyFulfilled', false
  );
end;
$function$;

revoke execute on function public.fulfil_dreamkey_one_time_purchase(
  text, text, text, text, bigint, bigint, bigint
) from public, anon, authenticated;

grant execute on function public.fulfil_dreamkey_one_time_purchase(
  text, text, text, text, bigint, bigint, bigint
) to service_role;

commit;
