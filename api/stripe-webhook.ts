import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import {
  DreamKeyServerConfigurationError,
  getSafeServerErrorDetails,
  getStripeClient,
  getStripeWebhookSecret,
  getSupabaseAdminClient,
} from './_lib/dreamKeyStripe.js';

const HANDLED_EVENTS = new Set<Stripe.Event.Type>([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

interface VerifiedOneTimeCheckout {
  session: Stripe.Checkout.Session;
  purchaseId: string;
  paymentIntentId: string | null;
  stripePriceId: string;
  currency: string;
  grossAmountMinor: number;
  discountAmountMinor: number;
  netAmountMinor: number;
}

interface VerifiedStripeSubscription {
  localSubscriptionId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  currency: string;
  periodStart: number;
  periodEnd: number;
  subscription: Stripe.Subscription;
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function objectId(value: { id: string } | string | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function checkoutLinePriceId(lineItem: Stripe.LineItem): string | null {
  return objectId(lineItem.price);
}

function invoiceLinePriceId(lineItem: Stripe.InvoiceLineItem): string | null {
  return objectId(lineItem.pricing?.price_details?.price || null);
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return objectId(invoice.parent?.subscription_details?.subscription || null);
}

function expectedInterval(planCode: string): 'month' | 'year' | null {
  if (planCode === 'dreamkey_monthly') return 'month';
  if (planCode === 'dreamkey_yearly') return 'year';
  return null;
}

async function verifyOneTimeCheckoutSession(
  stripe: Stripe,
  supabase: SupabaseClient,
  sessionId: string,
): Promise<VerifiedOneTimeCheckout> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price'],
  });
  const metadata = session.metadata;
  const lineItems = session.line_items?.data;
  const lineItem = lineItems?.[0];
  const stripePriceId = lineItem ? checkoutLinePriceId(lineItem) : null;
  const currency = session.currency?.toUpperCase();
  const grossAmountMinor = session.amount_subtotal;
  const discountAmountMinor = session.total_details?.amount_discount;
  const taxAmountMinor = session.total_details?.amount_tax;
  const shippingAmountMinor = session.total_details?.amount_shipping;
  const netAmountMinor = session.amount_total;

  if (session.livemode
    || session.mode !== 'payment'
    || !metadata?.dreamkey_purchase_id
    || !metadata.supabase_user_id
    || !metadata.dreamkey_plan_id
    || !metadata.dreamkey_price_id
    || metadata.dreamkey_plan_code !== 'dreamkey_single'
    || !metadata.stripe_price_id
    || session.client_reference_id !== metadata.dreamkey_purchase_id
    || !lineItems
    || lineItems.length !== 1
    || lineItem?.quantity !== 1
    || !stripePriceId
    || stripePriceId !== metadata.stripe_price_id
    || !currency
    || !Number.isSafeInteger(grossAmountMinor)
    || !Number.isSafeInteger(discountAmountMinor)
    || !Number.isSafeInteger(netAmountMinor)
    || taxAmountMinor !== 0
    || shippingAmountMinor !== 0
    || grossAmountMinor! - discountAmountMinor! !== netAmountMinor) {
    throw new Error('Stripe one-time checkout verification failed.');
  }

  const { data: purchase, error } = await supabase
    .from('dreamkey_purchases')
    .select('id, user_id, plan_id, price_id, provider')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();
  if (error
    || !purchase
    || purchase.id !== metadata.dreamkey_purchase_id
    || purchase.user_id !== metadata.supabase_user_id
    || purchase.plan_id !== metadata.dreamkey_plan_id
    || purchase.price_id !== metadata.dreamkey_price_id
    || purchase.provider !== 'stripe') {
    throw new Error('DREAMKey one-time purchase verification failed.');
  }

  return {
    session,
    purchaseId: purchase.id,
    paymentIntentId: objectId(session.payment_intent),
    stripePriceId,
    currency,
    grossAmountMinor: grossAmountMinor!,
    discountAmountMinor: discountAmountMinor!,
    netAmountMinor: netAmountMinor!,
  };
}

async function fulfilPaidOneTimeCheckout(
  supabase: SupabaseClient,
  checkout: VerifiedOneTimeCheckout,
): Promise<void> {
  if (checkout.session.payment_status !== 'paid') throw new Error('Stripe checkout is not paid.');
  const { error } = await supabase.rpc('fulfil_dreamkey_one_time_purchase', {
    p_checkout_session_id: checkout.session.id,
    p_payment_intent_id: checkout.paymentIntentId,
    p_stripe_price_id: checkout.stripePriceId,
    p_currency: checkout.currency,
    p_gross_amount_minor: checkout.grossAmountMinor,
    p_discount_amount_minor: checkout.discountAmountMinor,
    p_net_amount_minor: checkout.netAmountMinor,
  });
  if (error) throw new Error('Atomic DREAMKey one-time fulfilment failed.');
}

async function markOneTimeCheckoutFailed(
  supabase: SupabaseClient,
  checkout: VerifiedOneTimeCheckout,
): Promise<void> {
  const { error } = await supabase
    .from('dreamkey_purchases')
    .update({ status: 'failed' })
    .eq('id', checkout.purchaseId)
    .eq('stripe_checkout_session_id', checkout.session.id)
    .eq('status', 'pending');
  if (error) throw new Error('DREAMKey purchase failure update failed.');
}

async function verifyStripeSubscription(
  stripe: Stripe,
  supabase: SupabaseClient,
  subscriptionId: string,
): Promise<VerifiedStripeSubscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });
  const metadata = subscription.metadata;
  const item = subscription.items.data[0];
  const customerId = objectId(subscription.customer);
  const interval = expectedInterval(metadata.dreamkey_plan_code);
  if (subscription.livemode
    || !metadata.dreamkey_subscription_id
    || !metadata.supabase_user_id
    || !metadata.dreamkey_plan_id
    || !metadata.dreamkey_price_id
    || !metadata.stripe_price_id
    || !interval
    || subscription.items.data.length !== 1
    || item?.quantity !== 1
    || item.price.id !== metadata.stripe_price_id
    || item.price.type !== 'recurring'
    || item.price.recurring?.interval !== interval
    || item.price.recurring.interval_count !== 1
    || item.price.recurring.usage_type !== 'licensed'
    || !customerId) {
    throw new Error('Stripe subscription verification failed.');
  }

  const { data: local, error } = await supabase
    .from('dreamkey_subscriptions')
    .select('id, user_id, plan_id, price_id, currency, stripe_customer_id, stripe_subscription_id')
    .eq('id', metadata.dreamkey_subscription_id)
    .maybeSingle();
  if (error
    || !local
    || local.user_id !== metadata.supabase_user_id
    || local.plan_id !== metadata.dreamkey_plan_id
    || local.price_id !== metadata.dreamkey_price_id
    || local.currency !== item.price.currency.toUpperCase()
    || (local.stripe_customer_id && local.stripe_customer_id !== customerId)
    || (local.stripe_subscription_id && local.stripe_subscription_id !== subscription.id)) {
    throw new Error('Local DREAMKey subscription verification failed.');
  }

  return {
    localSubscriptionId: local.id,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    stripePriceId: item.price.id,
    currency: item.price.currency.toUpperCase(),
    periodStart: item.current_period_start,
    periodEnd: item.current_period_end,
    subscription,
  };
}

async function bindStripeSubscription(
  supabase: SupabaseClient,
  verified: VerifiedStripeSubscription,
): Promise<void> {
  const { error } = await supabase.rpc('bind_dreamkey_stripe_subscription', {
    p_local_subscription_id: verified.localSubscriptionId,
    p_stripe_subscription_id: verified.stripeSubscriptionId,
    p_stripe_customer_id: verified.stripeCustomerId,
  });
  if (error) throw new Error('DREAMKey subscription binding failed.');
}

async function verifySubscriptionCheckout(
  stripe: Stripe,
  supabase: SupabaseClient,
  sessionId: string,
): Promise<VerifiedStripeSubscription> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'line_items.data.price'],
  });
  const metadata = session.metadata;
  const lineItems = session.line_items?.data;
  const lineItem = lineItems?.[0];
  const subscriptionId = objectId(session.subscription);
  const customerId = objectId(session.customer);
  if (session.livemode
    || session.mode !== 'subscription'
    || !subscriptionId
    || !customerId
    || !metadata?.dreamkey_subscription_id
    || session.client_reference_id !== metadata.dreamkey_subscription_id
    || !lineItems
    || lineItems.length !== 1
    || lineItem?.quantity !== 1
    || checkoutLinePriceId(lineItem) !== metadata.stripe_price_id) {
    throw new Error('Stripe subscription Checkout verification failed.');
  }

  const verified = await verifyStripeSubscription(stripe, supabase, subscriptionId);
  if (verified.localSubscriptionId !== metadata.dreamkey_subscription_id
    || verified.stripeCustomerId !== customerId) {
    throw new Error('Stripe subscription Checkout metadata mismatch.');
  }
  return verified;
}

async function fulfilPaidSubscriptionInvoice(
  stripe: Stripe,
  supabase: SupabaseClient,
  invoiceId: string,
  eventId: string,
): Promise<void> {
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const customerId = objectId(invoice.customer);
  if (invoice.livemode || invoice.status !== 'paid' || !subscriptionId || !customerId) {
    throw new Error('Stripe invoice is not a paid subscription invoice.');
  }

  const verified = await verifyStripeSubscription(stripe, supabase, subscriptionId);
  if (verified.stripeCustomerId !== customerId || invoice.currency.toUpperCase() !== verified.currency) {
    throw new Error('Stripe invoice customer or currency mismatch.');
  }

  const invoiceLines = await stripe.invoices.listLineItems(invoice.id, {
    limit: 100,
    expand: ['data.pricing.price_details.price'],
  });
  const matchingLines = invoiceLines.data.filter(line => (
    line.parent?.type === 'subscription_item_details'
    && line.parent.subscription_item_details?.subscription === subscriptionId
    && line.parent.subscription_item_details.proration === false
    && line.quantity === 1
    && invoiceLinePriceId(line) === verified.stripePriceId
  ));
  if (matchingLines.length !== 1) throw new Error('Stripe invoice price verification failed.');

  await bindStripeSubscription(supabase, verified);
  const period = matchingLines[0].period;
  const { error } = await supabase.rpc('fulfil_dreamkey_subscription_invoice', {
    p_stripe_subscription_id: verified.stripeSubscriptionId,
    p_stripe_customer_id: verified.stripeCustomerId,
    p_stripe_invoice_id: invoice.id,
    p_stripe_event_id: eventId,
    p_invoice_paid: invoice.status === 'paid',
    p_stripe_price_id: verified.stripePriceId,
    p_currency: verified.currency,
    p_billing_period_start: new Date(period.start * 1000).toISOString(),
    p_billing_period_end: new Date(period.end * 1000).toISOString(),
  });
  if (error) throw new Error('Atomic DREAMKey subscription fulfilment failed.');
}

async function updateSubscriptionStatus(
  supabase: SupabaseClient,
  verified: VerifiedStripeSubscription,
  status: 'pending' | 'active' | 'past_due' | 'cancelled' | 'ended',
): Promise<void> {
  const { data: updated, error } = await supabase
    .from('dreamkey_subscriptions')
    .update({
      status,
      stripe_customer_id: verified.stripeCustomerId,
      stripe_subscription_id: verified.stripeSubscriptionId,
      current_period_start: new Date(verified.periodStart * 1000).toISOString(),
      current_period_end: new Date(verified.periodEnd * 1000).toISOString(),
    })
    .eq('id', verified.localSubscriptionId)
    .eq('stripe_subscription_id', verified.stripeSubscriptionId)
    .select('id')
    .maybeSingle();
  if (error || !updated) throw new Error('DREAMKey subscription status update failed.');
}

function mapStripeSubscriptionStatus(
  subscription: Stripe.Subscription,
  currentLocalStatus: string,
): 'pending' | 'active' | 'past_due' | 'cancelled' | 'ended' {
  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') return 'ended';
  if (subscription.cancel_at_period_end) return 'cancelled';
  if (['past_due', 'unpaid', 'paused'].includes(subscription.status)) return 'past_due';
  if (['active', 'trialing'].includes(subscription.status)) {
    return currentLocalStatus === 'active' ? 'active' : 'pending';
  }
  return 'pending';
}

async function handleSubscriptionLifecycle(
  stripe: Stripe,
  supabase: SupabaseClient,
  supplied: Stripe.Subscription,
  deleted: boolean,
): Promise<void> {
  const verified = await verifyStripeSubscription(stripe, supabase, supplied.id);
  await bindStripeSubscription(supabase, verified);
  const { data, error } = await supabase
    .from('dreamkey_subscriptions')
    .select('status')
    .eq('id', verified.localSubscriptionId)
    .maybeSingle();
  if (error || !data) throw new Error('Local subscription status lookup failed.');
  await updateSubscriptionStatus(
    supabase,
    verified,
    deleted ? 'ended' : mapStripeSubscriptionStatus(verified.subscription, data.status),
  );
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, {
      status: 405,
      headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
    });
  }

  let payload: string;
  try {
    payload = await request.text();
  } catch {
    return json(400, { ok: false, error: 'INVALID_PAYLOAD' });
  }

  try {
    const signature = request.headers.get('stripe-signature');
    if (!signature) return json(400, { ok: false, error: 'INVALID_SIGNATURE' });
    const stripe = getStripeClient();
    const webhookSecret = getStripeWebhookSecret();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      return json(400, { ok: false, error: 'INVALID_SIGNATURE' });
    }
    if (!HANDLED_EVENTS.has(event.type)) return json(200, { ok: true });

    const supabase = getSupabaseAdminClient();
    if (event.type === 'checkout.session.completed'
      || event.type === 'checkout.session.async_payment_succeeded'
      || event.type === 'checkout.session.async_payment_failed') {
      const suppliedSession = event.data.object as Stripe.Checkout.Session;
      if (!suppliedSession.id) return json(400, { ok: false, error: 'INVALID_EVENT' });

      if (suppliedSession.mode === 'subscription') {
        if (event.type !== 'checkout.session.async_payment_failed') {
          const verified = await verifySubscriptionCheckout(stripe, supabase, suppliedSession.id);
          await bindStripeSubscription(supabase, verified);
        }
        return json(200, { ok: true });
      }

      const checkout = await verifyOneTimeCheckoutSession(stripe, supabase, suppliedSession.id);
      if (event.type === 'checkout.session.async_payment_failed') {
        await markOneTimeCheckoutFailed(supabase, checkout);
      } else if (checkout.session.payment_status === 'paid') {
        await fulfilPaidOneTimeCheckout(supabase, checkout);
      }
      return json(200, { ok: true });
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      if (!getInvoiceSubscriptionId(invoice)) return json(200, { ok: true });
      await fulfilPaidSubscriptionInvoice(stripe, supabase, invoice.id, event.id);
      return json(200, { ok: true });
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (!subscriptionId) return json(200, { ok: true });
      const verified = await verifyStripeSubscription(stripe, supabase, subscriptionId);
      await bindStripeSubscription(supabase, verified);
      const failedStatus = ['canceled', 'incomplete_expired'].includes(verified.subscription.status)
        ? 'ended'
        : verified.subscription.cancel_at_period_end ? 'cancelled' : 'past_due';
      await updateSubscriptionStatus(supabase, verified, failedStatus);
      return json(200, { ok: true });
    }

    const subscription = event.data.object as Stripe.Subscription;
    await handleSubscriptionLifecycle(
      stripe,
      supabase,
      subscription,
      event.type === 'customer.subscription.deleted',
    );
    return json(200, { ok: true });
  } catch (error) {
    const configurationError = error instanceof DreamKeyServerConfigurationError;
    console.error(
      configurationError ? 'Stripe webhook configuration failed' : 'Stripe webhook processing failed',
      getSafeServerErrorDetails(error),
    );
    return json(500, { ok: false, error: 'WEBHOOK_PROCESSING_FAILED' });
  }
}

export default {
  fetch: handleRequest,
};
