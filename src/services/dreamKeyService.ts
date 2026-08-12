import { DREAM_KEY_PLANS, type DreamKeyDisplayPlan, type DreamKeyPlanId } from '../config/dreamKeyPlans';
import { supabase } from '../lib/supabaseClient';
import type {
  DreamKeyBalance,
  DreamKeyBillingHistoryEntry,
  DreamKeyBillingType,
  DreamKeyCheckoutStatus,
  DreamKeyCodeResult,
  DreamKeyCodeType,
  DreamKeyCodeValidation,
  DreamKeyDiscountType,
  DreamKeyEntitlement,
  DreamKeyEntitlementStatus,
  DreamKeySourceType,
  DreamKeySubscription,
} from '../types/dreamKey';

export type DreamKeyPendingAction = 'checkout';

export class DreamKeyIntegrationPendingError extends Error {
  constructor(public readonly action: DreamKeyPendingAction) {
    super('DREAMKey checkout is not connected yet.');
    this.name = 'DreamKeyIntegrationPendingError';
  }
}

export type DreamKeyServiceErrorCode =
  | 'AUTH_REQUIRED'
  | 'CHECKOUT_FAILED'
  | 'CONFIGURATION'
  | 'INVALID_CODE'
  | 'QUERY_FAILED'
  | 'UNEXPECTED_RESPONSE';

export class DreamKeyServiceError extends Error {
  constructor(public readonly code: DreamKeyServiceErrorCode, message: string) {
    super(message);
    this.name = 'DreamKeyServiceError';
  }
}

const ENTITLEMENT_STATUSES: readonly DreamKeyEntitlementStatus[] = [
  'available',
  'reserved',
  'consumed',
  'revoked',
];

const SOURCE_TYPES: readonly DreamKeySourceType[] = [
  'purchase',
  'subscription',
  'free_voucher',
  'affiliate',
  'enterprise',
  'admin',
];

const CODE_TYPES: readonly DreamKeyCodeType[] = ['free', 'discount', 'affiliate'];
const DISCOUNT_TYPES: readonly DreamKeyDiscountType[] = ['percentage', 'fixed'];
const BILLING_TYPES: readonly DreamKeyBillingType[] = ['one_time', 'monthly', 'yearly', 'enterprise'];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getFirstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return asRecord(value[0]);
  return asRecord(value);
}

function getRequiredString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || !field) {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey service returned an unexpected response.');
  }
  return field;
}

function getNullableString(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  if (field === null || field === undefined) return null;
  if (typeof field !== 'string') {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey service returned an unexpected response.');
  }
  return field;
}

function getCount(value: unknown): number {
  const count = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey service returned an unexpected response.');
  }
  return count;
}

function normalizeBillingHistoryEntry(value: unknown): DreamKeyBillingHistoryEntry {
  const row = asRecord(value);
  if (!row) {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'Your DREAMKey billing history returned an unexpected response.');
  }
  const kind = row.kind;
  const billingType = row.billingType;
  const status = row.status;
  const amountMinor = row.amountMinor;
  const currency = row.currency;
  if (!['one_time', 'subscription'].includes(String(kind))
    || !BILLING_TYPES.includes(billingType as DreamKeyBillingType)
    || !['paid', 'refunded'].includes(String(status))
    || (amountMinor !== null && (!Number.isSafeInteger(amountMinor) || Number(amountMinor) < 0))
    || (currency !== null && typeof currency !== 'string')) {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'Your DREAMKey billing history returned an unexpected response.');
  }
  return {
    id: getRequiredString(row, 'id'),
    kind: kind as DreamKeyBillingHistoryEntry['kind'],
    checkoutSessionId: getNullableString(row, 'checkoutSessionId'),
    planName: getRequiredString(row, 'planName'),
    billingType: billingType as DreamKeyBillingType,
    status: status as DreamKeyBillingHistoryEntry['status'],
    amountMinor: amountMinor === null ? null : Number(amountMinor),
    currency: currency as string | null,
    paidAt: getRequiredString(row, 'paidAt'),
    reference: getNullableString(row, 'reference'),
    keysGranted: getCount(row.keysGranted),
    receiptUrl: getNullableString(row, 'receiptUrl'),
    hostedInvoiceUrl: getNullableString(row, 'hostedInvoiceUrl'),
    invoicePdfUrl: getNullableString(row, 'invoicePdfUrl'),
  };
}

function normalizeEntitlement(value: unknown): DreamKeyEntitlement {
  const row = getFirstRecord(value);
  if (!row) {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey service returned an unexpected response.');
  }

  const status = row.status;
  const sourceType = row.source_type;
  if (!ENTITLEMENT_STATUSES.includes(status as DreamKeyEntitlementStatus)
    || !SOURCE_TYPES.includes(sourceType as DreamKeySourceType)) {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey service returned an unexpected response.');
  }

  return {
    id: getRequiredString(row, 'id'),
    user_id: getRequiredString(row, 'user_id'),
    plan_id: getNullableString(row, 'plan_id'),
    source_type: sourceType as DreamKeySourceType,
    status: status as DreamKeyEntitlementStatus,
    purchase_id: getNullableString(row, 'purchase_id'),
    subscription_id: getNullableString(row, 'subscription_id'),
    voucher_redemption_id: getNullableString(row, 'voucher_redemption_id'),
    submission_id: getNullableString(row, 'submission_id'),
    granted_at: getRequiredString(row, 'granted_at'),
    reserved_at: getNullableString(row, 'reserved_at'),
    consumed_at: getNullableString(row, 'consumed_at'),
    revoked_at: getNullableString(row, 'revoked_at'),
    expires_at: getNullableString(row, 'expires_at'),
    created_at: getRequiredString(row, 'created_at'),
    updated_at: getRequiredString(row, 'updated_at'),
  };
}

function normalizeCodeValidation(value: unknown): DreamKeyCodeValidation {
  const result = getFirstRecord(value);
  if (!result || typeof result.valid !== 'boolean') {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey code service returned an unexpected response.');
  }
  if (!result.valid) return { valid: false };

  const type = result.type;
  const discountType = result.discountType;
  const discountValue = result.discountValue;
  if (!CODE_TYPES.includes(type as DreamKeyCodeType)
    || (discountType !== null && discountType !== undefined
      && !DISCOUNT_TYPES.includes(discountType as DreamKeyDiscountType))
    || (discountValue !== null && discountValue !== undefined && typeof discountValue !== 'number')) {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey code service returned an unexpected response.');
  }

  return {
    valid: true,
    type: type as DreamKeyCodeType,
    discountType: discountType == null ? null : discountType as DreamKeyDiscountType,
    discountValue: discountValue == null ? null : discountValue as number,
  };
}

function requireSupabase() {
  if (!supabase) {
    throw new DreamKeyServiceError('CONFIGURATION', 'DREAMKey services are not configured.');
  }
  return supabase;
}

async function getAuthenticatedClient() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError' && error.status !== 401 && error.status !== 403) {
    throw new DreamKeyServiceError('QUERY_FAILED', 'Your secure DREAMKey session could not be verified.');
  }
  if (!data.user) {
    throw new DreamKeyServiceError('AUTH_REQUIRED', 'Please sign in to manage DREAMKeys.');
  }
  return client;
}

export function getDreamKeyPlans(): readonly DreamKeyDisplayPlan[] {
  return DREAM_KEY_PLANS;
}

export async function getDreamKeyBalance(): Promise<DreamKeyBalance> {
  const client = await getAuthenticatedClient();
  const { data, error } = await client.rpc('get_my_dreamkey_balance');
  if (error) {
    throw new DreamKeyServiceError('QUERY_FAILED', 'Your DREAMKey balance could not be loaded.');
  }

  const result = getFirstRecord(data);
  if (!result) {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey service returned an unexpected response.');
  }
  return {
    available: getCount(result.available),
    reserved: getCount(result.reserved),
  };
}

export async function getDreamKeyBillingHistory(): Promise<DreamKeyBillingHistoryEntry[]> {
  const client = await getAuthenticatedClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new DreamKeyServiceError('AUTH_REQUIRED', 'Please sign in again to view DREAMKey billing history.');
  }

  let response: Response;
  try {
    response = await fetch('/api/dreamkey-billing-history', {
      method: 'GET',
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
  } catch {
    throw new DreamKeyServiceError('QUERY_FAILED', 'Your DREAMKey billing history could not be loaded.');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const result = asRecord(body);
  if (!response.ok || result?.ok !== true || !Array.isArray(result.history)) {
    if (response.status === 401) {
      throw new DreamKeyServiceError('AUTH_REQUIRED', 'Please sign in again to view DREAMKey billing history.');
    }
    throw new DreamKeyServiceError('QUERY_FAILED', 'Your DREAMKey billing history could not be loaded.');
  }
  return result.history.map(normalizeBillingHistoryEntry);
}

export async function beginDreamKeyCheckout(planId: DreamKeyPlanId): Promise<void> {
  const backendPlanIds: Partial<Record<DreamKeyPlanId, string>> = {
    'one-dreamkey': 'dreamkey_single',
    'dreamkey-monthly': 'dreamkey_monthly',
    'dreamkey-yearly': 'dreamkey_yearly',
  };
  const backendPlanId = backendPlanIds[planId];
  if (!backendPlanId) {
    throw new DreamKeyIntegrationPendingError('checkout');
  }

  const client = await getAuthenticatedClient();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new DreamKeyServiceError('AUTH_REQUIRED', 'Please sign in again before starting checkout.');
  }

  let response: Response;
  try {
    response = await fetch('/api/create-dreamkey-checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId: backendPlanId }),
    });
  } catch {
    throw new DreamKeyServiceError('CHECKOUT_FAILED', 'Secure checkout is temporarily unavailable. Please try again.');
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  const value = asRecord(result);
  const checkoutUrl = value?.url;
  if (!response.ok || typeof checkoutUrl !== 'string') {
    if (response.status === 401) {
      throw new DreamKeyServiceError('AUTH_REQUIRED', 'Please sign in again before starting checkout.');
    }
    throw new DreamKeyServiceError('CHECKOUT_FAILED', 'Secure checkout is temporarily unavailable. Please try again.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(checkoutUrl);
  } catch {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'Secure checkout returned an invalid destination.');
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'checkout.stripe.com') {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'Secure checkout returned an invalid destination.');
  }

  window.location.assign(parsedUrl.href);
}

export async function getDreamKeyCheckoutStatus(
  checkoutSessionId: string,
): Promise<DreamKeyCheckoutStatus | null> {
  if (!checkoutSessionId || checkoutSessionId.length > 255) return null;

  const client = await getAuthenticatedClient();
  const { data: purchase, error: purchaseError } = await client
    .from('dreamkey_purchases')
    .select('status, keys_granted')
    .eq('stripe_checkout_session_id', checkoutSessionId)
    .maybeSingle();
  if (purchaseError) {
    throw new DreamKeyServiceError('QUERY_FAILED', 'Your DREAMKey payment status could not be checked.');
  }
  if (purchase) {
    const allowedStatuses = ['pending', 'paid', 'failed', 'cancelled', 'refunded'] as const;
    if (!allowedStatuses.includes(purchase.status as typeof allowedStatuses[number])) {
      throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey payment service returned an unexpected response.');
    }
    return {
      kind: 'purchase',
      status: purchase.status as typeof allowedStatuses[number],
      keysGranted: getCount(purchase.keys_granted),
    };
  }

  const { data: subscription, error: subscriptionError } = await client
    .from('dreamkey_subscriptions')
    .select('status, keys_per_cycle, dreamkey_subscription_grants(keys_granted)')
    .eq('stripe_checkout_session_id', checkoutSessionId)
    .maybeSingle();
  if (subscriptionError) {
    throw new DreamKeyServiceError('QUERY_FAILED', 'Your DREAMKey subscription status could not be checked.');
  }
  if (!subscription) return null;

  const allowedStatuses = ['pending', 'active', 'past_due', 'cancelled', 'ended'] as const;
  if (!allowedStatuses.includes(subscription.status as typeof allowedStatuses[number])) {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey subscription service returned an unexpected response.');
  }
  const grants = Array.isArray(subscription.dreamkey_subscription_grants)
    ? subscription.dreamkey_subscription_grants
    : [];
  return {
    kind: 'subscription',
    status: subscription.status as typeof allowedStatuses[number],
    keysGranted: grants.reduce((total, grant) => {
      const record = asRecord(grant);
      return total + (record ? getCount(record.keys_granted) : 0);
    }, 0),
  };
}

export async function getMyDreamKeySubscriptions(): Promise<DreamKeySubscription[]> {
  const client = await getAuthenticatedClient();
  const { data, error } = await client
    .from('dreamkey_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    throw new DreamKeyServiceError('QUERY_FAILED', 'Your DREAMKey subscriptions could not be loaded.');
  }
  return (data || []) as DreamKeySubscription[];
}

export async function getDreamKeyForSubmission(submissionId: string): Promise<DreamKeyEntitlement | null> {
  const client = await getAuthenticatedClient();
  const { data, error } = await client.rpc('get_my_dreamkey_for_submission', {
    p_submission_id: submissionId,
  });
  if (error) {
    throw new DreamKeyServiceError('QUERY_FAILED', 'The DREAMKey for this DREAMSheet could not be loaded.');
  }
  if (!getFirstRecord(data)) return null;
  return normalizeEntitlement(data);
}

export async function reserveDreamKey(submissionId: string): Promise<DreamKeyEntitlement> {
  const client = await getAuthenticatedClient();
  const { data, error } = await client.rpc('reserve_dreamkey_for_submission', {
    p_submission_id: submissionId,
  });
  if (error) {
    throw new DreamKeyServiceError('QUERY_FAILED', 'A DREAMKey could not be reserved for this DREAMSheet.');
  }
  return normalizeEntitlement(data);
}

async function validateDreamKeyCode(client: NonNullable<typeof supabase>, code: string): Promise<DreamKeyCodeValidation> {
  const { data, error } = await client.rpc('validate_dreamkey_code', { p_code: code });
  if (error) {
    throw new DreamKeyServiceError('QUERY_FAILED', 'This DREAMKey code could not be checked.');
  }
  return normalizeCodeValidation(data);
}

export async function redeemDreamKeyCode(code: string): Promise<DreamKeyCodeResult> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    throw new DreamKeyServiceError('INVALID_CODE', 'Enter a DREAMKey code first.');
  }

  const client = await getAuthenticatedClient();
  const validation = await validateDreamKeyCode(client, normalizedCode);
  if (!validation.valid) {
    throw new DreamKeyServiceError('INVALID_CODE', 'This DREAMKey code is invalid or unavailable.');
  }

  if (validation.type !== 'free') {
    return { kind: 'checkout_code', validation };
  }

  const { data, error } = await client.rpc('redeem_free_dreamkey_code', {
    p_code: normalizedCode,
  });
  if (error) {
    throw new DreamKeyServiceError('QUERY_FAILED', 'This DREAMKey code could not be redeemed.');
  }

  const result = getFirstRecord(data);
  if (!result || result.success !== true) {
    throw new DreamKeyServiceError('UNEXPECTED_RESPONSE', 'The DREAMKey code service returned an unexpected response.');
  }
  return {
    kind: 'free',
    success: true,
    keysGranted: getCount(result.keysGranted),
  };
}

export type {
  DreamKeyBalance,
  DreamKeyBillingHistoryEntry,
  DreamKeyCheckoutStatus,
  DreamKeyCodeResult,
  DreamKeyCodeValidation,
  DreamKeyEntitlement,
  DreamKeySubscription,
} from '../types/dreamKey';
