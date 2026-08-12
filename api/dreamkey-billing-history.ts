import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import {
  authenticateDreamKeyRequest,
  DreamKeyServerConfigurationError,
  getSafeServerErrorDetails,
  getStripeClient,
  getSupabaseAdminClient,
} from './_lib/dreamKeyStripe.js';

interface PurchaseRecord {
  id: string;
  plan_id: string;
  status: 'paid' | 'refunded';
  currency: string;
  net_amount_minor: number;
  keys_granted: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
}

interface SubscriptionRecord {
  id: string;
  plan_id: string;
  currency: string | null;
  stripe_checkout_session_id: string | null;
}

interface SubscriptionGrantRecord {
  id: string;
  subscription_id: string;
  stripe_invoice_id: string;
  keys_granted: number;
  created_at: string;
}

interface PlanRecord {
  id: string;
  name: string;
  billing_type: 'one_time' | 'monthly' | 'yearly' | 'enterprise';
}

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function isSafeStripeUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'stripe.com' || url.hostname.endsWith('.stripe.com'));
  } catch {
    return false;
  }
}

async function getReceiptUrl(stripe: Stripe, paymentIntentId: string | null): Promise<string | null> {
  if (!paymentIntentId) return null;
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
    const latestCharge = paymentIntent.latest_charge;
    const charge = typeof latestCharge === 'string'
      ? await stripe.charges.retrieve(latestCharge)
      : latestCharge;
    return charge && isSafeStripeUrl(charge.receipt_url) ? charge.receipt_url : null;
  } catch {
    console.warn('DREAMKey receipt proof unavailable for one billing-history entry.');
    return null;
  }
}

async function getInvoiceProof(stripe: Stripe, invoiceId: string) {
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    return {
      amountMinor: invoice.amount_paid,
      currency: invoice.currency.toUpperCase(),
      paidAt: invoice.status_transitions.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
      reference: invoice.number || invoice.id,
      hostedInvoiceUrl: isSafeStripeUrl(invoice.hosted_invoice_url) ? invoice.hosted_invoice_url : null,
      invoicePdfUrl: isSafeStripeUrl(invoice.invoice_pdf) ? invoice.invoice_pdf : null,
    };
  } catch {
    console.warn('DREAMKey invoice proof unavailable for one billing-history entry.');
    return null;
  }
}

async function loadHistory(supabase: SupabaseClient, stripe: Stripe, userId: string) {
  const [purchaseResult, subscriptionResult] = await Promise.all([
    supabase
      .from('dreamkey_purchases')
      .select('id, plan_id, status, currency, net_amount_minor, keys_granted, stripe_checkout_session_id, stripe_payment_intent_id, paid_at, created_at')
      .eq('user_id', userId)
      .in('status', ['paid', 'refunded'])
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('dreamkey_subscriptions')
      .select('id, plan_id, currency, stripe_checkout_session_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (purchaseResult.error || subscriptionResult.error) {
    throw new Error('DREAMKey billing records could not be loaded.');
  }

  const purchases = (purchaseResult.data || []) as PurchaseRecord[];
  const subscriptions = (subscriptionResult.data || []) as SubscriptionRecord[];
  const subscriptionIds = subscriptions.map(subscription => subscription.id);
  const grantResult = subscriptionIds.length
    ? await supabase
      .from('dreamkey_subscription_grants')
      .select('id, subscription_id, stripe_invoice_id, keys_granted, created_at')
      .in('subscription_id', subscriptionIds)
      .order('created_at', { ascending: false })
      .limit(100)
    : { data: [] as SubscriptionGrantRecord[], error: null };
  if (grantResult.error) throw new Error('DREAMKey subscription billing records could not be loaded.');
  const grants = (grantResult.data || []) as SubscriptionGrantRecord[];

  const planIds = Array.from(new Set([
    ...purchases.map(purchase => purchase.plan_id),
    ...subscriptions.map(subscription => subscription.plan_id),
  ]));
  const planResult = planIds.length
    ? await supabase
      .from('dreamkey_plans')
      .select('id, name, billing_type')
      .in('id', planIds)
    : { data: [] as PlanRecord[], error: null };
  if (planResult.error) throw new Error('DREAMKey plan records could not be loaded.');

  const plans = new Map((planResult.data || []).map(plan => [plan.id, plan as PlanRecord]));
  const subscriptionsById = new Map(subscriptions.map(subscription => [subscription.id, subscription]));

  const purchaseEntries = await Promise.all(purchases.map(async purchase => {
    const plan = plans.get(purchase.plan_id);
    const receiptUrl = await getReceiptUrl(stripe, purchase.stripe_payment_intent_id);
    return {
      id: `purchase:${purchase.id}`,
      kind: 'one_time' as const,
      checkoutSessionId: purchase.stripe_checkout_session_id,
      planName: plan?.name || 'DREAMKey',
      billingType: plan?.billing_type || 'one_time',
      status: purchase.status,
      amountMinor: purchase.net_amount_minor,
      currency: purchase.currency,
      paidAt: purchase.paid_at || purchase.created_at,
      reference: purchase.stripe_payment_intent_id,
      keysGranted: purchase.keys_granted,
      receiptUrl,
      hostedInvoiceUrl: null,
      invoicePdfUrl: null,
    };
  }));

  const invoiceEntries = await Promise.all(grants.map(async grant => {
    const subscription = subscriptionsById.get(grant.subscription_id);
    if (!subscription) return null;
    const plan = plans.get(subscription.plan_id);
    const proof = await getInvoiceProof(stripe, grant.stripe_invoice_id);
    return {
      id: `invoice:${grant.id}`,
      kind: 'subscription' as const,
      checkoutSessionId: subscription.stripe_checkout_session_id,
      planName: plan?.name || 'DREAMKey subscription',
      billingType: plan?.billing_type || 'monthly',
      status: 'paid' as const,
      amountMinor: proof?.amountMinor ?? null,
      currency: proof?.currency || subscription.currency,
      paidAt: proof?.paidAt || grant.created_at,
      reference: proof?.reference || grant.stripe_invoice_id,
      keysGranted: grant.keys_granted,
      receiptUrl: null,
      hostedInvoiceUrl: proof?.hostedInvoiceUrl || null,
      invoicePdfUrl: proof?.invoicePdfUrl || null,
    };
  }));

  return [...purchaseEntries, ...invoiceEntries.filter(entry => entry !== null)]
    .sort((left, right) => Date.parse(right.paidAt) - Date.parse(left.paidAt));
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, {
      status: 405,
      headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const user = await authenticateDreamKeyRequest(request, supabase);
    if (!user) return json(401, { ok: false, error: 'AUTH_REQUIRED' });

    const history = await loadHistory(supabase, getStripeClient(), user.id);
    return json(200, { ok: true, history });
  } catch (error) {
    const configurationError = error instanceof DreamKeyServerConfigurationError;
    console.error(
      configurationError ? 'DREAMKey billing history configuration failed' : 'DREAMKey billing history failed',
      getSafeServerErrorDetails(error),
    );
    return json(configurationError ? 500 : 502, {
      ok: false,
      error: 'BILLING_HISTORY_UNAVAILABLE',
    });
  }
}

export default {
  fetch: handleRequest,
};
