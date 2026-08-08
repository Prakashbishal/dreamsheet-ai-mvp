import { Resend } from 'resend';
import { ADMIN_ALERT_DEFINITIONS, type AdminAlertType } from './adminAlertTypes.js';

const ALERT_SENDER = 'DREAMSheet Alerts <no-reply@dreamsheet.ai>';
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1_000;

export type DeploymentEnvironment = 'Production' | 'Preview' | 'Development';
export type AdminAlertResult =
  | { status: 'sent' }
  | { status: 'disabled' }
  | { status: 'configuration_error' }
  | { status: 'send_failed' };

function getProviderErrorDetails(type: AdminAlertType, error: unknown) {
  if (!error || typeof error !== 'object') return { type };
  const value = error as Record<string, unknown>;
  return {
    type,
    providerType: typeof value.name === 'string'
      ? value.name
      : typeof value.type === 'string' ? value.type : undefined,
    statusCode: typeof value.statusCode === 'number' ? value.statusCode : undefined,
  };
}

export function getDeploymentEnvironment(): DeploymentEnvironment {
  if (process.env.VERCEL_ENV === 'production') return 'Production';
  if (process.env.VERCEL_ENV === 'preview') return 'Preview';
  return 'Development';
}

export function areAdminAlertsEnabled(environment = getDeploymentEnvironment()): boolean {
  if (environment === 'Development') return false;
  if (environment === 'Preview') return process.env.ADMIN_ALERTS_ENABLED?.toLowerCase() === 'true';
  return process.env.ADMIN_ALERTS_ENABLED?.toLowerCase() !== 'false';
}

export function parseAdminRecipients(value: string | undefined): string[] | null {
  if (!value) return null;
  const recipients = [...new Set(value.split(',').map(email => email.trim().toLowerCase()).filter(Boolean))].sort();
  if (recipients.length === 0 || recipients.length > 20 || recipients.some(email => !EMAIL_PATTERN.test(email) || email.length > 254)) return null;
  return recipients;
}

export function getAlertBucketStart(now = new Date()): Date {
  return new Date(Math.floor(now.getTime() / FIFTEEN_MINUTES_MS) * FIFTEEN_MINUTES_MS);
}

export function getAdminAlertIdempotencyKey(type: AdminAlertType, environment: DeploymentEnvironment, now = new Date()): string {
  const bucket = getAlertBucketStart(now).getTime();
  return `dreamsheet-alert-${environment.toLowerCase()}-${type.toLowerCase().replaceAll('_', '-')}-${bucket}`;
}

function formatUtc(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'UTC', timeZoneName: 'short',
  }).format(value);
}

export async function sendAdminAlert(type: AdminAlertType, now = new Date()): Promise<AdminAlertResult> {
  const environment = getDeploymentEnvironment();
  if (!areAdminAlertsEnabled(environment)) return { status: 'disabled' };

  const apiKey = process.env.RESEND_API_KEY;
  const recipients = parseAdminRecipients(process.env.ADMIN_ALERT_EMAILS);
  if (!apiKey || !recipients) {
    console.error('Admin alert configuration unavailable', { type });
    return { status: 'configuration_error' };
  }

  const definition = ADMIN_ALERT_DEFINITIONS[type];
  const windowStart = getAlertBucketStart(now);
  const windowEnd = new Date(windowStart.getTime() + FIFTEEN_MINUTES_MS);
  const alertWindow = `${formatUtc(windowStart)}–${formatUtc(windowEnd)}`;
  const text = `DREAMSheet Production Alert\n\nA critical DREAMSheet component has repeatedly failed.\n\nComponent:\n${definition.component}\n\nEnvironment:\n${environment}\n\nFailure:\n${definition.failure}\n\nAlert window:\n${alertWindow}\n\nNo user DREAMSheet content or personal information is included in this alert.\n\nPlease check the Vercel and relevant service logs.\n\nDREAMSheet AI Monitoring`;
  // TODO: Add the corrected production mark-only asset supplied by the brand owner.
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;color:#292524;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="overflow:hidden;background:#fff;border-top:4px solid #dc2626;border-radius:8px"><div style="background:#1c1917;padding:20px 28px"><p style="margin:0;color:#fff;font-size:22px;font-weight:400;letter-spacing:-.04em"><strong style="font-weight:700">DREAM</strong>Sheet <span style="color:#34d399;font-weight:400">AI</span></p></div><div style="padding:28px"><p style="color:#dc2626;font-size:12px;font-weight:700;letter-spacing:.14em">DREAMSheet Production Alert</p><p>A critical DREAMSheet component has repeatedly failed.</p><p><strong>Component:</strong><br>${definition.component}</p><p><strong>Environment:</strong><br>${environment}</p><p><strong>Failure:</strong><br>${definition.failure}</p><p><strong>Alert window:</strong><br>${alertWindow}</p><p>No user DREAMSheet content or personal information is included in this alert.</p><p>Please check the Vercel and relevant service logs.</p><p style="margin-top:24px;color:#78716c;font-size:12px">DREAMSheet AI Monitoring</p></div></div></div></body></html>`;

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: ALERT_SENDER,
      to: recipients,
      subject: definition.subject,
      text,
      html,
    }, { idempotencyKey: getAdminAlertIdempotencyKey(type, environment, now) });
    if (result.error || !result.data?.id) {
      console.error('Admin alert send failed', getProviderErrorDetails(type, result.error));
      return { status: 'send_failed' };
    }
    return { status: 'sent' };
  } catch (error) {
    console.error('Admin alert send threw', getProviderErrorDetails(type, error));
    return { status: 'send_failed' };
  }
}
