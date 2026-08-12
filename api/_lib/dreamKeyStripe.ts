import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import Stripe from 'stripe';

export class DreamKeyServerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DreamKeyServerConfigurationError';
  }
}

function requireEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new DreamKeyServerConfigurationError(`Missing ${name}.`);
  return value;
}

export function getDreamSheetAppOrigin(): string {
  const configured = requireEnvironmentValue('DREAMSHEET_APP_ORIGIN');
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new DreamKeyServerConfigurationError('DREAMSHEET_APP_ORIGIN is invalid.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== configured.replace(/\/$/, '')) {
    throw new DreamKeyServerConfigurationError('DREAMSHEET_APP_ORIGIN must be an origin without a path.');
  }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new DreamKeyServerConfigurationError('DREAMSHEET_APP_ORIGIN must use HTTPS outside local development.');
  }
  return url.origin;
}

export function getStripeClient(): Stripe {
  const secretKey = requireEnvironmentValue('STRIPE_SECRET_KEY');
  if (!secretKey.startsWith('sk_test_')) {
    throw new DreamKeyServerConfigurationError('DREAMKey payments require a Stripe test-mode secret key.');
  }
  return new Stripe(secretKey);
}

export function getStripeWebhookSecret(): string {
  return requireEnvironmentValue('STRIPE_WEBHOOK_SECRET');
}

export function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
    || process.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new DreamKeyServerConfigurationError('Missing SUPABASE_URL or VITE_SUPABASE_URL.');
  }

  const serviceRoleKey = requireEnvironmentValue('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function authenticateDreamKeyRequest(
  request: Request,
  supabase: SupabaseClient,
): Promise<User | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

export function getSafeServerErrorDetails(error: unknown) {
  if (!error || typeof error !== 'object') return { name: 'UnknownError' };
  const value = error as Record<string, unknown>;
  return {
    name: typeof value.name === 'string' ? value.name : undefined,
    message: error instanceof DreamKeyServerConfigurationError ? error.message : undefined,
    type: typeof value.type === 'string' ? value.type : undefined,
    code: typeof value.code === 'string' ? value.code : undefined,
    statusCode: typeof value.statusCode === 'number' ? value.statusCode : undefined,
  };
}
