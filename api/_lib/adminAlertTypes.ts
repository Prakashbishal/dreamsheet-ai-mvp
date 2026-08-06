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
    component: 'DREAMsheet Save / Supabase',
    failure: 'Repeated DREAMsheet save failures',
    subject: '[DREAMsheet Alert] Supabase save failures',
  },
  GEMINI_REQUEST_FAILED: {
    component: 'AI Generation / Gemini',
    failure: 'Repeated Gemini generation failures after retry handling',
    subject: '[DREAMsheet Alert] Gemini request failures',
  },
  EMAIL_DELIVERY_FAILED: {
    component: 'Strategic Plan Email / Resend',
    failure: 'DREAMsheet email delivery failed',
    subject: '[DREAMsheet Alert] Email delivery failures',
  },
  CRITICAL_API_FAILED: {
    component: 'DREAMsheet Critical API',
    failure: 'A production-critical API operation repeatedly failed',
    subject: '[DREAMsheet Alert] Critical API failures',
  },
};

export function isAdminAlertType(value: unknown): value is AdminAlertType {
  return typeof value === 'string' && ADMIN_ALERT_TYPES.includes(value as AdminAlertType);
}
