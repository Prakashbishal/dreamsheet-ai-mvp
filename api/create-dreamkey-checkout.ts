import {
  authenticateDreamKeyRequest,
  DreamKeyServerConfigurationError,
  getDreamSheetAppOrigin,
  getSafeServerErrorDetails,
  getStripeClient,
  getStripeWebhookSecret,
  getSupabaseAdminClient,
} from './_lib/dreamKeyStripe.js';

const ENABLED_PLAN_CODE = 'dreamkey_single';

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

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, {
      status: 405,
      headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const appOrigin = getDreamSheetAppOrigin();
    if (request.headers.get('origin') !== appOrigin) {
      return json(403, { ok: false, error: 'FORBIDDEN' });
    }
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
    if (!isExactCheckoutRequest(body) || body.planId !== ENABLED_PLAN_CODE) {
      return json(400, { ok: false, error: 'INVALID_PLAN' });
    }

    const { data: plan, error: planError } = await supabase
      .from('dreamkey_plans')
      .select('id, code, billing_type, key_allowance')
      .eq('code', ENABLED_PLAN_CODE)
      .eq('active', true)
      .eq('billing_type', 'one_time')
      .eq('key_allowance', 1)
      .maybeSingle();
    if (planError || !plan) return json(503, { ok: false, error: 'CHECKOUT_NOT_CONFIGURED' });

    const { data: prices, error: pricesError } = await supabase
      .from('dreamkey_prices')
      .select('id, plan_id, currency, amount_minor, stripe_price_id')
      .eq('plan_id', plan.id)
      .eq('active', true)
      .not('stripe_price_id', 'is', null);
    if (pricesError || !prices || prices.length !== 1) {
      return json(503, { ok: false, error: 'CHECKOUT_NOT_CONFIGURED' });
    }

    const price = prices[0];
    if (typeof price.stripe_price_id !== 'string' || !price.stripe_price_id) {
      return json(503, { ok: false, error: 'CHECKOUT_NOT_CONFIGURED' });
    }

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
    if (purchaseError || !purchase) return json(503, { ok: false, error: 'CHECKOUT_UNAVAILABLE' });

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
      return json(502, { ok: false, error: 'CHECKOUT_UNAVAILABLE' });
    }

    const { data: updatedPurchase, error: sessionSaveError } = await supabase
      .from('dreamkey_purchases')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', purchase.id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (sessionSaveError || !updatedPurchase) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      return json(503, { ok: false, error: 'CHECKOUT_UNAVAILABLE' });
    }

    return json(200, { ok: true, url: session.url });
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
