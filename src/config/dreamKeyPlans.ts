import type { DreamKeyBillingType } from '../types/dreamKey';

export type DreamKeyPlanId = 'one-dreamkey' | 'dreamkey-monthly' | 'dreamkey-yearly' | 'teams-coaches';

export interface DreamKeyDisplayPlan {
  id: DreamKeyPlanId;
  name: string;
  billingType: DreamKeyBillingType;
  headline?: string;
  priceLabel: string;
  billingLabel?: string;
  keyAllowanceLabel: string;
  description: string;
  features: string[];
  featured?: boolean;
  ctaLabel: string;
}

// TODO: Replace placeholder pricing and membership allowances with approved
// commercial values before secure checkout is enabled.
export const DREAM_KEY_PLANS: readonly DreamKeyDisplayPlan[] = [
  {
    id: 'one-dreamkey',
    name: 'One DREAMKey',
    billingType: 'one_time',
    priceLabel: 'Price coming soon',
    billingLabel: 'Single purchase',
    keyAllowanceLabel: '1 DREAMKey',
    description: 'Perfect for a single focused DREAMSheet journey.',
    features: [
      'One complete DREAMSheet journey',
      'No recurring commitment',
      'A finished strategic plan',
    ],
    ctaLabel: 'Get 1 DREAMKey',
  },
  {
    id: 'dreamkey-monthly',
    name: 'DREAMKey Monthly',
    billingType: 'monthly',
    headline: 'Flexible',
    priceLabel: 'Pricing coming soon',
    billingLabel: 'Recurring monthly',
    keyAllowanceLabel: 'Monthly allowance to be confirmed',
    description: 'For people actively working across multiple areas of life, work or business.',
    features: [
      'DREAMKeys granted each month',
      'Configurable monthly allowance',
      'Cancel or manage once billing launches',
    ],
    ctaLabel: 'Monthly — Coming Soon',
  },
  {
    id: 'dreamkey-yearly',
    name: 'DREAMKey Yearly',
    billingType: 'yearly',
    headline: 'Best Value',
    priceLabel: 'Pricing coming soon',
    billingLabel: 'Recurring yearly',
    keyAllowanceLabel: 'Yearly allowance to be confirmed',
    description: 'For continuous reflection, planning and progress throughout the year.',
    features: [
      'Annual DREAMKey allowance',
      'Long-term value positioning',
      'Allowance configurable before launch',
    ],
    featured: true,
    ctaLabel: 'Yearly — Coming Soon',
  },
  {
    id: 'teams-coaches',
    name: 'Teams & Coaches',
    billingType: 'enterprise',
    priceLabel: 'Tailored access',
    billingLabel: 'Commercial conversation',
    keyAllowanceLabel: 'Managed or volume access',
    description: 'Designed for organisations requiring managed or volume access.',
    features: [
      'Planned managed DREAMKey allocations',
      'Designed for multiple users or clients',
      'Planned organisation billing and support',
    ],
    ctaLabel: 'Contact Us',
  },
] as const;
