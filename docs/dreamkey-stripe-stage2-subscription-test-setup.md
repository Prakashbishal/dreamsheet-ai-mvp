# DREAMKey Stripe Stage 2 subscription sandbox test

Stage 2 adds monthly/yearly recurring Checkout and one DREAMKey grant batch per
paid invoice. It remains Stripe test-mode only. Do not apply this migration or
configuration to production during sandbox testing.

## 1. Create recurring Stripe test prices

In Stripe Dashboard with **Test mode** enabled:

1. Open or create the DREAMKey product.
2. Create one recurring GBP Price with interval **Monthly**.
3. Create one recurring GBP Price with interval **Yearly**.
4. Copy both `price_...` IDs.

Prices must be fixed, licensed, active, interval count one, and use amounts
matching the database rows. Do not enable promotion codes.

## 2. Configure the isolated Supabase test project

Apply migrations through:

```text
20260812000200_add_stripe_dreamkey_subscriptions.sql
```

Only in the test project, replace all four placeholders and run:

```sql
begin;

-- TEST-ONLY allowances. Replace with approved values before production.
update public.dreamkey_plans
set key_allowance = case code
  when 'dreamkey_monthly' then <TEST_MONTHLY_KEY_ALLOWANCE>
  when 'dreamkey_yearly' then <TEST_YEARLY_KEY_ALLOWANCE>
end
where code in ('dreamkey_monthly', 'dreamkey_yearly');

update public.dreamkey_prices
set active = false
where plan_id in (
  select id from public.dreamkey_plans
  where code in ('dreamkey_monthly', 'dreamkey_yearly')
);

insert into public.dreamkey_prices (
  plan_id,
  currency,
  amount_minor,
  stripe_price_id,
  active
)
select id, 'GBP', <MONTHLY_PRICE_PENCE>, '<MONTHLY_TEST_PRICE_ID>', true
from public.dreamkey_plans
where code = 'dreamkey_monthly'
union all
select id, 'GBP', <YEARLY_PRICE_PENCE>, '<YEARLY_TEST_PRICE_ID>', true
from public.dreamkey_plans
where code = 'dreamkey_yearly';

commit;
```

Confirm one usable price per plan:

```sql
select plans.code, plans.key_allowance, prices.currency,
  prices.amount_minor, prices.stripe_price_id
from public.dreamkey_plans as plans
inner join public.dreamkey_prices as prices on prices.plan_id = plans.id
where plans.code in ('dreamkey_monthly', 'dreamkey_yearly')
  and plans.active
  and prices.active
  and prices.stripe_price_id is not null
order by plans.code;
```

## 3. Run local Stripe/Vercel tooling

Use the same test-project server variables documented for Stage 1. Then run:

```bash
vercel dev
```

In another terminal, forward the complete Stage 2 event set:

```bash
stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,invoice.paid,invoice.payment_failed,customer.subscription.updated,customer.subscription.deleted \
  --forward-to http://localhost:3000/api/stripe-webhook
```

Set the temporary `whsec_...` value printed by `stripe listen` as the local
`STRIPE_WEBHOOK_SECRET`, then restart `vercel dev`.

## 4. Monthly subscription test

1. Sign in with a Supabase test user.
2. Choose **Monthly** and confirm hosted Checkout uses the monthly test price.
3. Pay with `4242 4242 4242 4242`, any future expiry and any CVC.
4. Wait for the return screen to confirm backend fulfilment.
5. Verify one subscription, one grant-ledger row and exactly the configured
   number of available entitlements.
6. In Stripe Dashboard or CLI, replay the same `invoice.paid` event. Counts must
   remain unchanged.

## 5. Yearly subscription test

Repeat the flow with **Yearly**. Confirm Checkout uses the yearly test Price and
the single paid annual invoice grants exactly the configured yearly allowance.
This is one grant batch per annual invoice; it is not a monthly drip.

## 6. Renewal without waiting

Use Stripe Billing simulations/Test Clocks with a dedicated test customer when
practical:

1. Create the subscription under a test clock.
2. Advance the clock beyond the next billing boundary.
3. Confirm the new invoice becomes paid.
4. Verify exactly one additional grant-ledger row and one additional batch of
   `keys_per_cycle` entitlements.
5. Replay that renewal's `invoice.paid`; no extra rows or keys may appear.

## 7. SQL verification

```sql
select id, user_id, plan_id, price_id, status, currency, keys_per_cycle,
  stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id,
  current_period_start, current_period_end
from public.dreamkey_subscriptions
where user_id = '<TEST_USER_UUID>'
order by created_at desc;

select id, subscription_id, stripe_invoice_id, stripe_event_id, keys_granted,
  billing_period_start, billing_period_end, created_at
from public.dreamkey_subscription_grants
where subscription_id = '<LOCAL_SUBSCRIPTION_UUID>'
order by created_at;

select status, count(*)
from public.dreamkey_entitlements
where subscription_id = '<LOCAL_SUBSCRIPTION_UUID>'
group by status;
```

Also test payment failure and cancellation. Failure must set `past_due` without
granting. Cancellation/deletion must stop future cycles while leaving previously
issued DREAMKeys intact.
