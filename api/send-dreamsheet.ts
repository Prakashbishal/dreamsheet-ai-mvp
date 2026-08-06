import { Buffer } from 'node:buffer';
import { Resend } from 'resend';
import { sendAdminAlert } from './_lib/adminAlert';

const MAX_PDF_BYTES = 3 * 1024 * 1024;
const FIXED_SENDER = 'DREAMsheet AI <no-reply@dreamsheet.ai>';
const FIXED_SUBJECT = 'Your DREAMsheet Strategic Plan';
const PRODUCTION_ORIGIN = 'https://dreamsheet-ai-mvp.vercel.app';
const ALLOWED_FIELDS = new Set(['recipientEmail', 'coacheeName', 'coachName', 'requestId', 'pdf']);
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: { ok: boolean; error?: string }): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function methodNotAllowed(): Response {
  return Response.json(
    { ok: false, error: 'METHOD_NOT_ALLOWED' },
    { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } },
  );
}

function getSafeErrorDetails(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { message: 'Unknown error' };
  }

  const value = error as Record<string, unknown>;

  return {
    name: typeof value.name === 'string' ? value.name : undefined,
    type: typeof value.type === 'string' ? value.type : undefined,
    message: typeof value.message === 'string' ? value.message : undefined,
    statusCode:
      typeof value.statusCode === 'number'
        ? value.statusCode
        : undefined,
  };
}

function trimField(entry: FormDataEntryValue | null, maxLength: number): string | null {
  if (typeof entry !== 'string') return null;
  const value = entry.trim();
  return value.length <= maxLength ? value : null;
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
    .forEach((value) => allowed.add(value));
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character);
}

function safeFilename(name: string): string {
  const safeName = name.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'Coachee';
  return `DREAMsheet-Strategic-Plan-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

async function handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') return methodNotAllowed();
    if (!isAllowedOrigin(request.headers.get('origin'))) return json(403, { ok: false, error: 'FORBIDDEN' });
    if (!process.env.RESEND_API_KEY) return json(500, { ok: false, error: 'SEND_FAILED' });

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return json(400, { ok: false, error: 'INVALID_REQUEST' });
    }

    for (const key of formData.keys()) {
      if (!ALLOWED_FIELDS.has(key)) return json(400, { ok: false, error: 'INVALID_REQUEST' });
    }
    if ([...ALLOWED_FIELDS].some((key) => formData.getAll(key).length !== 1)) {
      return json(400, { ok: false, error: 'INVALID_REQUEST' });
    }

    const recipientEmail = trimField(formData.get('recipientEmail'), 254);
    const coacheeName = trimField(formData.get('coacheeName'), 120);
    const coachName = trimField(formData.get('coachName'), 120);
    const requestId = trimField(formData.get('requestId'), 64);
    const pdf = formData.get('pdf');
    if (!recipientEmail || !EMAIL_PATTERN.test(recipientEmail) || coacheeName === null || coachName === null || !requestId || !UUID_PATTERN.test(requestId) || !(pdf instanceof File)) {
      return json(400, { ok: false, error: 'INVALID_REQUEST' });
    }
    if (!pdf.size) return json(400, { ok: false, error: 'INVALID_REQUEST' });
    if (pdf.size > MAX_PDF_BYTES) return json(413, { ok: false, error: 'PDF_TOO_LARGE' });
    if (pdf.type && pdf.type.toLowerCase() !== 'application/pdf') return json(400, { ok: false, error: 'INVALID_REQUEST' });

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = Buffer.from(await pdf.arrayBuffer());
    } catch {
      return json(400, { ok: false, error: 'INVALID_REQUEST' });
    }
    if (pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') return json(400, { ok: false, error: 'INVALID_REQUEST' });

    const greetingName = coacheeName || 'there';
    const text = `Hi ${greetingName},\n\nYour completed DREAMsheet Strategic Plan is attached as a PDF.\n\nKeep it accessible and review your goals, priorities and next actions regularly.\n\nBest wishes,\nDREAMsheet AI\n\nThis email was requested through DREAMsheet AI.`;
    const htmlName = escapeHtml(greetingName);
    const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;color:#292524;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-top:4px solid #059669;border-radius:8px;padding:28px"><p style="margin:0 0 20px;color:#059669;font-size:12px;font-weight:700;letter-spacing:.16em">DREAMsheet AI</p><p>Hi ${htmlName},</p><p>Your completed DREAMsheet Strategic Plan is attached as a PDF.</p><p>Keep it accessible and review your goals, priorities and next actions regularly.</p><p style="margin-top:24px">Best wishes,<br>DREAMsheet AI</p><hr style="margin:28px 0 16px;border:0;border-top:1px solid #e7e5e4"><p style="margin:0;color:#78716c;font-size:12px">This email was requested through DREAMsheet AI.</p></div></div></body></html>`;

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const result = await resend.emails.send({
        from: FIXED_SENDER,
        to: recipientEmail,
        subject: FIXED_SUBJECT,
        text,
        html,
        attachments: [{ content: pdfBuffer, filename: safeFilename(coacheeName), contentType: 'application/pdf' }],
      }, { idempotencyKey: `dreamsheet-${requestId}` });
      if (result.error || !result.data?.id) {
        console.error(
          'Resend send failed',
          getSafeErrorDetails(result.error),
        );
        await sendAdminAlert('EMAIL_DELIVERY_FAILED');

        return json(502, {
          ok: false,
          error: 'SEND_FAILED',
        });
      }
      return json(200, { ok: true });
    } catch (error) {
      console.error(
        'Resend send threw',
        getSafeErrorDetails(error),
      );
      await sendAdminAlert('EMAIL_DELIVERY_FAILED');

      return json(502, {
        ok: false,
        error: 'SEND_FAILED',
      });
    }
}

export default {
  fetch: handleRequest,
};
