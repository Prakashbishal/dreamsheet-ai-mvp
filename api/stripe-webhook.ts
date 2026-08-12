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
]);

interface VerifiedCheckout {
  session: Stripe.Checkout.Session;
  purchaseId: string;
  paymentIntentId: string | null;
  stripePriceId: string;
  currency: string;
  grossAmountMinor: number;
  discountAmountMinor: number;
  netAmountMinor: number;
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function getExpandedPriceId(lineItem: Stripe.LineItem): string | null {
  const price = lineItem.price;
  if (!price) return null;
  return typeof price === 'string' ? price : price.id;
}

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  if (!session.payment_intent) return null;
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent.id;
}

async function verifyCheckoutSession(
  stripe: Stripe,
  supabase: SupabaseClient,
  sessionId: string,
): Promise<VerifiedCheckout> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price'],
  });
  const metadata = session.metadata;
  const lineItems = session.line_items?.data;
  const lineItem = lineItems?.[0];
  const stripePriceId = lineItem ? getExpandedPriceId(lineItem) : null;
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
    throw new Error('Stripe checkout verification failed.');
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
    throw new Error('DREAMKey purchase verification failed.');
  }

  return {
    session,
    purchaseId: purchase.id,
    paymentIntentId: getPaymentIntentId(session),
    stripePriceId,
    currency,
    grossAmountMinor: grossAmountMinor!,
    discountAmountMinor: discountAmountMinor!,
    netAmountMinor: netAmountMinor!,
  };
}

async function fulfilPaidCheckout(
  supabase: SupabaseClient,
  checkout: VerifiedCheckout,
): Promise<void> {
  if (checkout.session.payment_status !== 'paid') {
    throw new Error('Stripe checkout is not paid.');
  }

  const { error } = await supabase.rpc('fulfil_dreamkey_one_time_purchase', {
    p_checkout_session_id: checkout.session.id,
    p_payment_intent_id: checkout.paymentIntentId,
    p_stripe_price_id: checkout.stripePriceId,
    p_currency: checkout.currency,
    p_gross_amount_minor: checkout.grossAmountMinor,
    p_discount_amount_minor: checkout.discountAmountMinor,
    p_net_amount_minor: checkout.netAmountMinor,
  });
  if (error) throw new Error('Atomic DREAMKey fulfilment failed.');
}

async function markCheckoutFailed(
  supabase: SupabaseClient,
  checkout: VerifiedCheckout,
): Promise<void> {
  const { error } = await supabase
    .from('dreamkey_purchases')
    .update({ status: 'failed' })
    .eq('id', checkout.purchaseId)
    .eq('stripe_checkout_session_id', checkout.session.id)
    .eq('status', 'pending');
  if (error) throw new Error('DREAMKey failure status update failed.');
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

    const suppliedSession = event.data.object as Stripe.Checkout.Session;
    if (!suppliedSession.id) return json(400, { ok: false, error: 'INVALID_EVENT' });

    const supabase = getSupabaseAdminClient();
    const checkout = await verifyCheckoutSession(stripe, supabase, suppliedSession.id);

    if (event.type === 'checkout.session.async_payment_failed') {
      await markCheckoutFailed(supabase, checkout);
      return json(200, { ok: true });
    }

    if (checkout.session.payment_status !== 'paid') {
      return json(200, { ok: true, processing: true });
    }

    await fulfilPaidCheckout(supabase, checkout);
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
