import type { AdminAlertType } from '../types/adminAlerts';

const FAILURE_THRESHOLD = 3;
const REPORT_TIMEOUT_MS = 5_000;

interface FailureSequence {
  count: number;
  reported: boolean;
}

const failureSequences = new Map<AdminAlertType, FailureSequence>();

export async function reportAdminAlert(type: AdminAlertType): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);

  try {
    await fetch('/api/admin-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
      credentials: 'same-origin',
      signal: controller.signal,
    });
  } catch {
    if (import.meta.env.DEV) console.warn('Admin alert report could not be delivered', { type });
  } finally {
    window.clearTimeout(timeout);
  }
}

export function recordCriticalFailure(type: AdminAlertType): void {
  const sequence = failureSequences.get(type) ?? { count: 0, reported: false };
  if (sequence.reported) return;

  sequence.count += 1;
  if (sequence.count >= FAILURE_THRESHOLD) {
    sequence.reported = true;
    void reportAdminAlert(type);
  }
  failureSequences.set(type, sequence);
}

export function recordCriticalSuccess(type: AdminAlertType): void {
  failureSequences.delete(type);
}
