# DREAMKey Stripe Stage 1 test setup

This stage is test-mode only. It enables the `dreamkey_single` one-time plan and
does not enable the Discovery gate, recurring plans, promotion codes, or live
payments.

## A. Create the Stripe test product and price

1. In Stripe Dashboard, turn on **Test mode**.
2. Create a product for one DREAMKey.
3. Add one one-time GBP price using the test amount approved for Preview.
4. Copy its `price_...` identifier. Do not copy or commit a secret key.

Changing the amount later means creating a new Stripe Price, deactivating the
old database price for new checkouts, and activating the new one. No frontend
code change is required.

## B. Configure only the Supabase test project

Apply the existing DREAMKey foundation migration and the new Stripe fulfilment
migration to the isolated test project first. Do not run these statements in
production for Stage 1.

Replace the two placeholders below, then run this transaction in the Supabase
test project. It leaves historical rows intact while ensuring checkout sees
exactly one active Stripe-backed price for the one-time plan.

```sql
begin;

update public.dreamkey_prices
set active = false
where plan_id = (
  select id
  from public.dreamkey_plans
  where code = 'dreamkey_single'
);

insert into public.dreamkey_prices (
  plan_id,
  currency,
  amount_minor,
  stripe_price_id,
  active
)
select
  id,
  'GBP',
  <TEST_PRICE_IN_PENCE>,
  '<STRIPE_TEST_PRICE_ID>',
  true
from public.dreamkey_plans
where code = 'dreamkey_single'
  and billing_type = 'one_time'
  and key_allowance = 1;

commit;
```

Confirm exactly one row is returned:

```sql
select prices.id, prices.currency, prices.amount_minor, prices.stripe_price_id
from public.dreamkey_prices as prices
inner join public.dreamkey_plans as plans on plans.id = prices.plan_id
where plans.code = 'dreamkey_single'
  and plans.active
  and prices.active
  and prices.stripe_price_id is not null;
```

## C. Configure environment variables

Set these on the local/Preview server environment, never in browser code:

- `STRIPE_SECRET_KEY`: Stripe `sk_test_...` key.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the exact webhook endpoint.
- `SUPABASE_SERVICE_ROLE_KEY`: service-role key for the Supabase test project.
- `DREAMSHEET_APP_ORIGIN`: exact local or Preview origin, without a path or
  trailing slash.
- `SUPABASE_URL`: test-project URL. The API can safely reuse
  `VITE_SUPABASE_URL` when this alias is omitted because the URL is public.

Keep only the existing public Supabase URL and anon key under `VITE_*`. Never
create `VITE_STRIPE_SECRET_KEY`, `VITE_STRIPE_WEBHOOK_SECRET`, or
`VITE_SUPABASE_SERVICE_ROLE_KEY`.

## D. Register the webhook

For Preview, create a Stripe test-mode webhook endpoint at:

```text
https://<preview-origin>/api/stripe-webhook
```

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`. For local
testing, run the app through Vercel's local Functions runtime and use the Stripe
CLI to forward the same events to `/api/stripe-webhook`; use the CLI-provided
temporary signing secret locally.

## E. Run the test-card flow

1. Sign in to the application with a Supabase test user.
2. Open DREAMKeys and choose **Get 1 DREAMKey**.
3. Confirm the browser is redirected to Stripe-hosted Checkout.
4. Use Stripe's successful test card `4242 4242 4242 4242`, any future expiry,
   any CVC, and a valid test postcode.
5. Complete Checkout and wait for the app to confirm the database-backed
   balance. A success query parameter alone must never display a granted key.
6. In Stripe Dashboard, resend the completed event. The duplicate must report
   success without creating another entitlement.
7. Also test cancel, invalid webhook signature, disabled/missing price, and a
   webhook/price mismatch. None may grant a key.

## F. Verify the purchase and entitlement

Run against the Supabase test project after payment, replacing the email:

```sql
select
  purchases.id,
  purchases.status,
  purchases.provider,
  purchases.currency,
  purchases.gross_amount_minor,
  purchases.discount_amount_minor,
  purchases.net_amount_minor,
  purchases.keys_granted,
  purchases.stripe_checkout_session_id,
  purchases.stripe_payment_intent_id,
  purchases.paid_at
from public.dreamkey_purchases as purchases
inner join auth.users as users on users.id = purchases.user_id
where users.email = '<TEST_USER_EMAIL>'
order by purchases.created_at desc;

select
  entitlements.id,
  entitlements.user_id,
  entitlements.plan_id,
  entitlements.source_type,
  entitlements.status,
  entitlements.purchase_id,
  entitlements.granted_at
from public.dreamkey_entitlements as entitlements
where entitlements.purchase_id = '<PURCHASE_UUID>';

select count(*) as entitlement_count
from public.dreamkey_entitlements
where purchase_id = '<PURCHASE_UUID>';
```

The completed purchase must be `paid`, have `keys_granted = 1`, and have
exactly one matching `purchase` entitlement in `available` state. Resending the
event must leave both counts unchanged.
