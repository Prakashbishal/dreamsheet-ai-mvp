import { DREAM_KEY_PLANS, type DreamKeyPlan, type DreamKeyPlanId } from '../config/dreamKeyPlans';

export type DreamKeyPendingAction = 'balance' | 'checkout' | 'code_redemption' | 'reservation';

export class DreamKeyIntegrationPendingError extends Error {
  constructor(public readonly action: DreamKeyPendingAction) {
    super('DREAMKey commerce integration is not connected yet.');
    this.name = 'DreamKeyIntegrationPendingError';
  }
}

export interface DreamKeyBalance {
  available: number;
}

export function getDreamKeyPlans(): readonly DreamKeyPlan[] {
  return DREAM_KEY_PLANS;
}

export async function getDreamKeyBalance(): Promise<DreamKeyBalance> {
  throw new DreamKeyIntegrationPendingError('balance');
}

export async function beginDreamKeyCheckout(_planId: DreamKeyPlanId): Promise<never> {
  throw new DreamKeyIntegrationPendingError('checkout');
}

export async function redeemDreamKeyCode(_code: string): Promise<never> {
  throw new DreamKeyIntegrationPendingError('code_redemption');
}

export async function reserveDreamKey(_submissionId: string): Promise<never> {
  throw new DreamKeyIntegrationPendingError('reservation');
}
