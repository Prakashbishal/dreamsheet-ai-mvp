export interface SendDreamSheetEmailRequest {
  recipientEmail: string;
  coacheeName: string;
  coachName: string;
  requestId: string;
  pdf: Blob;
  filename: string;
}

interface SendDreamSheetEmailResponse {
  ok: boolean;
  error?: string;
}

export class DreamSheetEmailError extends Error {
  constructor(public readonly code = 'SEND_FAILED') {
    super(code);
    this.name = 'DreamSheetEmailError';
  }
}

export async function sendDreamSheetEmail(request: SendDreamSheetEmailRequest): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45_000);
  const formData = new FormData();
  formData.append('recipientEmail', request.recipientEmail);
  formData.append('coacheeName', request.coacheeName);
  formData.append('coachName', request.coachName);
  formData.append('requestId', request.requestId);
  formData.append('pdf', request.pdf, request.filename);

  try {
    const response = await fetch('/api/send-dreamsheet', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      credentials: 'same-origin',
    });
    const contentType = response.headers.get('content-type') || '';
    const body: SendDreamSheetEmailResponse | null = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null;
    if (!response.ok || !body?.ok) throw new DreamSheetEmailError(body?.error || 'SEND_FAILED');
  } catch (error) {
    if (error instanceof DreamSheetEmailError) throw error;
    throw new DreamSheetEmailError(error instanceof DOMException && error.name === 'AbortError' ? 'TIMEOUT' : 'SEND_FAILED');
  } finally {
    window.clearTimeout(timeout);
  }
}
