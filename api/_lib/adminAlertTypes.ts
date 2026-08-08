// Keep this server allowlist synchronized with the client-side alert allowlist.
export const ADMIN_ALERT_TYPES = [
  'SUPABASE_SAVE_FAILED',
  'GEMINI_REQUEST_FAILED',
  'EMAIL_DELIVERY_FAILED',
  'CRITICAL_API_FAILED',
] as const;

export type AdminAlertType = typeof ADMIN_ALERT_TYPES[number];

export interface AdminAlertDefinition {
  component: string;
  failure: string;
  subject: string;
}

export const ADMIN_ALERT_DEFINITIONS: Record<AdminAlertType, AdminAlertDefinition> = {
  SUPABASE_SAVE_FAILED: {
    component: 'DREAMSheet Save / Supabase',
    failure: 'Repeated DREAMSheet save failures',
    subject: '[DREAMSheet Alert] Supabase save failures',
  },
  GEMINI_REQUEST_FAILED: {
    component: 'AI Generation / Gemini',
    failure: 'Repeated Gemini generation failures after retry handling',
    subject: '[DREAMSheet Alert] Gemini request failures',
  },
  EMAIL_DELIVERY_FAILED: {
    component: 'Strategic Plan Email / Resend',
    failure: 'DREAMSheet email delivery failed',
    subject: '[DREAMSheet Alert] Email delivery failures',
  },
  CRITICAL_API_FAILED: {
    component: 'DREAMSheet Critical API',
    failure: 'A production-critical API operation repeatedly failed',
    subject: '[DREAMSheet Alert] Critical API failures',
  },
};

export function isAdminAlertType(value: unknown): value is AdminAlertType {
  return typeof value === 'string' && ADMIN_ALERT_TYPES.includes(value as AdminAlertType);
}
