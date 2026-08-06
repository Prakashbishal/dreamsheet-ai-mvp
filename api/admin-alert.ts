import { isAdminAlertType } from './_lib/adminAlertTypes';
import { sendAdminAlert } from './_lib/adminAlert';

const PRODUCTION_ORIGIN = 'https://dreamsheet.ai';

function json(status: number, body: { ok: boolean; error?: string }): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function deploymentOrigin(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = new Set<string>([PRODUCTION_ORIGIN]);
  [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL]
    .map(deploymentOrigin)
    .filter((value): value is string => Boolean(value))
    .forEach(value => allowed.add(value));
  if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
    try {
      const parsed = new URL(origin);
      if ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && ['http:', 'https:'].includes(parsed.protocol)) return true;
    } catch {
      return false;
    }
  }
  return allowed.has(origin);
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, {
      status: 405,
      headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
    });
  }
  if (!isAllowedOrigin(request.headers.get('origin'))) return json(403, { ok: false, error: 'FORBIDDEN' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'INVALID_REQUEST' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false, error: 'INVALID_REQUEST' });
  const entries = Object.entries(body);
  if (entries.length !== 1 || entries[0][0] !== 'type' || !isAdminAlertType(entries[0][1])) {
    return json(400, { ok: false, error: 'INVALID_REQUEST' });
  }

  const result = await sendAdminAlert(entries[0][1]);
  if (result.status === 'disabled') return json(202, { ok: true });
  if (result.status === 'configuration_error') return json(500, { ok: false, error: 'ALERT_UNAVAILABLE' });
  if (result.status === 'send_failed') return json(502, { ok: false, error: 'ALERT_FAILED' });
  return json(200, { ok: true });
}

export default {
  fetch: handleRequest,
};
