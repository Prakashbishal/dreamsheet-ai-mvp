import type { SupabaseClient, User } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import {
  authenticateDreamKeyRequest,
  DreamKeyServerConfigurationError,
  getDreamSheetAppOrigin,
  getSafeServerErrorDetails,
  getStripeClient,
  getStripeWebhookSecret,
  getSupabaseAdminClient,
} from './_lib/dreamKeyStripe.js';

const ENABLED_PLAN_CODES = new Set([
  'dreamkey_single',
  'dreamkey_monthly',
  'dreamkey_yearly',
]);

interface CheckoutPlan {
  id: string;
  code: string;
  billing_type: 'one_time' | 'monthly' | 'yearly';
  key_allowance: number;
}

interface CheckoutPrice {
  id: string;
  plan_id: string;
  currency: string;
  amount_minor: number;
  stripe_price_id: string;
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function isExactCheckoutRequest(value: unknown): value is { planId: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length === 1
    && entries[0][0] === 'planId'
    && typeof entries[0][1] === 'string';
}

function isCheckoutPlan(value: unknown): value is CheckoutPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const plan = value as Record<string, unknown>;
  return typeof plan.id === 'string'
    && typeof plan.code === 'string'
    && ['one_time', 'monthly', 'yearly'].includes(String(plan.billing_type))
    && Number.isSafeInteger(plan.key_allowance)
    && Number(plan.key_allowance) > 0;
}

function isCheckoutPrice(value: unknown): value is CheckoutPrice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const price = value as Record<string, unknown>;
  return typeof price.id === 'string'
    && typeof price.plan_id === 'string'
    && typeof price.currency === 'string'
    && Number.isSafeInteger(price.amount_minor)
    && typeof price.stripe_price_id === 'string'
    && Boolean(price.stripe_price_id);
}

async function loadCheckoutConfiguration(
  supabase: SupabaseClient,
  planCode: string,
): Promise<{ plan: CheckoutPlan; price: CheckoutPrice } | null> {
  const { data: plan, error: planError } = await supabase
    .from('dreamkey_plans')
    .select('id, code, billing_type, key_allowance')
    .eq('code', planCode)
    .eq('active', true)
    .maybeSingle();
  if (planError || !isCheckoutPlan(plan)) return null;
  if ((plan.code === 'dreamkey_single' && (plan.billing_type !== 'one_time' || plan.key_allowance !== 1))
    || (plan.code === 'dreamkey_monthly' && plan.billing_type !== 'monthly')
    || (plan.code === 'dreamkey_yearly' && plan.billing_type !== 'yearly')) return null;

  const { data: prices, error: pricesError } = await supabase
    .from('dreamkey_prices')
    .select('id, plan_id, currency, amount_minor, stripe_price_id')
    .eq('plan_id', plan.id)
    .eq('active', true)
    .not('stripe_price_id', 'is', null);
  if (pricesError || !prices || prices.length !== 1 || !isCheckoutPrice(prices[0])) return null;
  return { plan, price: prices[0] };
}

async function verifyRecurringStripePrice(
  stripe: Stripe,
  plan: CheckoutPlan,
  price: CheckoutPrice,
): Promise<boolean> {
  const stripePrice = await stripe.prices.retrieve(price.stripe_price_id);
  const expectedInterval = plan.billing_type === 'monthly' ? 'month' : 'year';
  return stripePrice.active
    && stripePrice.type === 'recurring'
    && stripePrice.recurring?.interval === expectedInterval
    && stripePrice.recurring.interval_count === 1
    && stripePrice.recurring.usage_type === 'licensed'
    && stripePrice.currency.toUpperCase() === price.currency
    && stripePrice.unit_amount === price.amount_minor;
}

async function getOrCreateStripeCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  user: User,
): Promise<string> {
  const { data, error } = await supabase
    .from('dreamkey_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('Stripe customer lookup failed.');

  if (typeof data?.stripe_customer_id === 'string') {
    try {
      const existing = await stripe.customers.retrieve(data.stripe_customer_id);
      if (!existing.deleted) return existing.id;
    } catch (error) {
      const code = error && typeof error === 'object'
        ? (error as Record<string, unknown>).code
        : undefined;
      if (code !== 'resource_missing') throw error;
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { supabase_user_id: user.id },
  });
  return customer.id;
}

async function createOneTimeCheckout(
  stripe: Stripe,
  supabase: SupabaseClient,
  user: User,
  plan: CheckoutPlan,
  price: CheckoutPrice,
  appOrigin: string,
): Promise<string | null> {
  const { data: purchase, error: purchaseError } = await supabase
    .from('dreamkey_purchases')
    .insert({
      user_id: user.id,
      plan_id: plan.id,
      price_id: price.id,
      provider: 'stripe',
      status: 'pending',
      currency: price.currency,
      gross_amount_minor: price.amount_minor,
      discount_amount_minor: 0,
      net_amount_minor: price.amount_minor,
      keys_granted: 0,
    })
    .select('id')
    .single();
  if (purchaseError || !purchase) return null;

  const trustedMetadata = {
    dreamkey_purchase_id: purchase.id,
    supabase_user_id: user.id,
    dreamkey_plan_id: plan.id,
    dreamkey_plan_code: plan.code,
    dreamkey_price_id: price.id,
    stripe_price_id: price.stripe_price_id,
  };
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email,
    client_reference_id: purchase.id,
    line_items: [{ price: price.stripe_price_id, quantity: 1 }],
    metadata: trustedMetadata,
    payment_intent_data: { metadata: trustedMetadata },
    success_url: `${appOrigin}/?dreamkey_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appOrigin}/?dreamkey_checkout=cancelled`,
  });
  if (!session.url) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    return null;
  }

  const { data: updated, error } = await supabase
    .from('dreamkey_purchases')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', purchase.id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error || !updated) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    return null;
  }
  return session.url;
}

async function createSubscriptionCheckout(
  stripe: Stripe,
  supabase: SupabaseClient,
  user: User,
  plan: CheckoutPlan,
  price: CheckoutPrice,
  appOrigin: string,
): Promise<string | null> {
  if (!await verifyRecurringStripePrice(stripe, plan, price)) return null;
  const stripeCustomerId = await getOrCreateStripeCustomer(stripe, supabase, user);
  const { data: subscription, error: subscriptionError } = await supabase
    .from('dreamkey_subscriptions')
    .insert({
      user_id: user.id,
      plan_id: plan.id,
      price_id: price.id,
      status: 'pending',
      currency: price.currency,
      keys_per_cycle: plan.key_allowance,
      stripe_customer_id: stripeCustomerId,
    })
    .select('id')
    .single();
  if (subscriptionError || !subscription) return null;

  const trustedMetadata = {
    dreamkey_subscription_id: subscription.id,
    supabase_user_id: user.id,
    dreamkey_plan_id: plan.id,
    dreamkey_plan_code: plan.code,
    dreamkey_price_id: price.id,
    stripe_price_id: price.stripe_price_id,
  };
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    client_reference_id: subscription.id,
    line_items: [{ price: price.stripe_price_id, quantity: 1 }],
    metadata: trustedMetadata,
    subscription_data: { metadata: trustedMetadata },
    success_url: `${appOrigin}/?dreamkey_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appOrigin}/?dreamkey_checkout=cancelled`,
  });
  if (!session.url) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    return null;
  }

  const { data: updated, error } = await supabase
    .from('dreamkey_subscriptions')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', subscription.id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error || !updated) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    return null;
  }
  return session.url;
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, {
      status: 405,
      headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const appOrigin = getDreamSheetAppOrigin();
    if (request.headers.get('origin') !== appOrigin) return json(403, { ok: false, error: 'FORBIDDEN' });
    const stripe = getStripeClient();
    getStripeWebhookSecret();
    const supabase = getSupabaseAdminClient();
    const user = await authenticateDreamKeyRequest(request, supabase);
    if (!user?.email) return json(401, { ok: false, error: 'AUTH_REQUIRED' });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { ok: false, error: 'INVALID_REQUEST' });
    }
    if (!isExactCheckoutRequest(body) || !ENABLED_PLAN_CODES.has(body.planId)) {
      return json(400, { ok: false, error: 'INVALID_PLAN' });
    }

    const configuration = await loadCheckoutConfiguration(supabase, body.planId);
    if (!configuration) return json(503, { ok: false, error: 'CHECKOUT_NOT_CONFIGURED' });
    const { plan, price } = configuration;
    const checkoutUrl = plan.billing_type === 'one_time'
      ? await createOneTimeCheckout(stripe, supabase, user, plan, price, appOrigin)
      : await createSubscriptionCheckout(stripe, supabase, user, plan, price, appOrigin);
    if (!checkoutUrl) return json(503, { ok: false, error: 'CHECKOUT_UNAVAILABLE' });
    return json(200, { ok: true, url: checkoutUrl });
  } catch (error) {
    const configurationError = error instanceof DreamKeyServerConfigurationError;
    console.error(
      configurationError ? 'DREAMKey checkout configuration failed' : 'DREAMKey checkout failed',
      getSafeServerErrorDetails(error),
    );
    return json(configurationError ? 500 : 502, {
      ok: false,
      error: configurationError ? 'CHECKOUT_NOT_CONFIGURED' : 'CHECKOUT_UNAVAILABLE',
    });
  }
}

export default {
  fetch: handleRequest,
};
