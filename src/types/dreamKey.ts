export type DreamKeyBillingType = 'one_time' | 'monthly' | 'yearly' | 'enterprise';
export type DreamKeyPurchaseStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type DreamKeySubscriptionStatus = 'pending' | 'active' | 'past_due' | 'cancelled' | 'ended';
export type DreamKeySourceType = 'purchase' | 'subscription' | 'free_voucher' | 'affiliate' | 'enterprise' | 'admin';
export type DreamKeyEntitlementStatus = 'available' | 'reserved' | 'consumed' | 'revoked';
export type DreamKeyCodeType = 'free' | 'discount' | 'affiliate';
export type DreamKeyDiscountType = 'percentage' | 'fixed';
export type DreamKeyCommissionType = 'percentage' | 'fixed';
export type DreamKeyCommissionStatus = 'pending' | 'approved' | 'paid' | 'void';

export interface DreamKeyPlan {
  id: string;
  code: string;
  name: string;
  billing_type: DreamKeyBillingType;
  key_allowance: number | null;
  description: string | null;
  active: boolean;
  featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DreamKeyPrice {
  id: string;
  plan_id: string;
  currency: string;
  amount_minor: number;
  stripe_price_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DreamKeyPurchase {
  id: string;
  user_id: string;
  plan_id: string;
  price_id: string | null;
  provider: string;
  status: DreamKeyPurchaseStatus;
  currency: string;
  gross_amount_minor: number;
  discount_amount_minor: number;
  net_amount_minor: number;
  keys_granted: number;
  voucher_redemption_id: string | null;
  affiliate_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
}

export interface DreamKeySubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: DreamKeySubscriptionStatus;
  currency: string | null;
  keys_per_cycle: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface DreamKeyEntitlement {
  id: string;
  user_id: string;
  plan_id: string | null;
  source_type: DreamKeySourceType;
  status: DreamKeyEntitlementStatus;
  purchase_id: string | null;
  subscription_id: string | null;
  voucher_redemption_id: string | null;
  submission_id: string | null;
  granted_at: string;
  reserved_at: string | null;
  consumed_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DreamKeyCode {
  id: string;
  code: string;
  type: DreamKeyCodeType;
  discount_type: DreamKeyDiscountType | null;
  discount_value: number | null;
  key_grant_count: number;
  affiliate_id: string | null;
  active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  max_redemptions_total: number | null;
  max_redemptions_per_user: number | null;
  created_at: string;
  updated_at: string;
}

export interface DreamKeyCodeRedemption {
  id: string;
  code_id: string;
  user_id: string;
  purchase_id: string | null;
  redeemed_at: string;
}

export interface DreamKeyAffiliate {
  id: string;
  code: string;
  name: string;
  email: string | null;
  active: boolean;
  commission_type: DreamKeyCommissionType;
  commission_value: number;
  created_at: string;
  updated_at: string;
}

export interface DreamKeyAffiliateAttribution {
  id: string;
  affiliate_id: string;
  user_id: string;
  purchase_id: string;
  code_id: string | null;
  gross_amount_minor: number;
  discount_amount_minor: number;
  net_amount_minor: number;
  commission_amount_minor: number;
  commission_status: DreamKeyCommissionStatus;
  created_at: string;
  updated_at: string;
}

export interface DreamKeyBalance {
  available: number;
  reserved: number;
}

export interface DreamKeyCheckoutStatus {
  status: DreamKeyPurchaseStatus;
  keysGranted: number;
}

export type DreamKeyCodeValidation =
  | { valid: false }
  | {
      valid: true;
      type: DreamKeyCodeType;
      discountType: DreamKeyDiscountType | null;
      discountValue: number | null;
    };

export type DreamKeyCodeResult =
  | { kind: 'free'; success: true; keysGranted: number }
  | {
      kind: 'checkout_code';
      validation: Extract<DreamKeyCodeValidation, { valid: true }>;
    };
