import { supabase } from "../lib/supabaseClient";

export type DreamSheetSubmission = {
  client_name?: string;
  coach_name?: string;
  domains?: string[];
  focus_areas?: unknown;
  plan_data: unknown;
};

export interface SavedDreamSheet {
  id: string;
  user_id: string;
  client_name: string | null;
  coach_name: string | null;
  domains: string[] | null;
  focus_areas: unknown;
  plan_data: unknown;
  created_at: string | null;
}

export class SubmissionServiceError extends Error {
  constructor(public readonly code: 'AUTH_REQUIRED' | 'CONFIGURATION' | 'QUERY_FAILED', message: string) {
    super(message);
    this.name = 'SubmissionServiceError';
  }
}

const SUBMISSION_FIELDS = 'id, user_id, client_name, coach_name, domains, focus_areas, plan_data';
const SUBMISSION_FIELDS_WITH_CREATED_AT = `${SUBMISSION_FIELDS}, created_at`;

function getPlanCreatedAt(planData: unknown): string | null {
  if (!planData || typeof planData !== 'object') return null;
  const value = (planData as Record<string, unknown>).planCreatedAt;
  return typeof value === 'string' ? value : null;
}

function normalizeSavedDreamSheet(value: Record<string, unknown>): SavedDreamSheet {
  return {
    ...value,
    created_at: typeof value.created_at === 'string' ? value.created_at : getPlanCreatedAt(value.plan_data),
  } as SavedDreamSheet;
}

export function isAuthRequiredError(error: unknown): boolean {
  return error instanceof SubmissionServiceError && error.code === 'AUTH_REQUIRED';
}

function requireSupabase() {
  if (!supabase) throw new SubmissionServiceError('CONFIGURATION', 'Supabase is not configured');
  return supabase;
}

async function getAuthenticatedUser() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError' && error.status !== 401 && error.status !== 403) {
    throw new SubmissionServiceError('QUERY_FAILED', 'Your secure session could not be verified. Please try again.');
  }
  if (!data.user) throw new SubmissionServiceError('AUTH_REQUIRED', 'Please sign in to save or view DREAMsheets.');
  return { client, user: data.user };
}

export async function saveDreamSheetSubmission(
  submission: DreamSheetSubmission
) {
  const { client, user } = await getAuthenticatedUser();

  const { error } = await client
    .from("submissions")
    .insert({
      user_id: user.id,
      client_name: submission.client_name ?? null,
      coach_name: submission.coach_name ?? null,
      domains: submission.domains ?? [],
      focus_areas: submission.focus_areas ?? {},
      plan_data: submission.plan_data,
    });

  if (error) {
    console.error("Supabase save error:", error);
    throw error;
  }

  return { success: true };
}

export async function getMyDreamSheets(): Promise<SavedDreamSheet[]> {
  const { client, user } = await getAuthenticatedUser();
  const primary = await client
    .from('submissions')
    .select(SUBMISSION_FIELDS_WITH_CREATED_AT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  let data = primary.data as Record<string, unknown>[] | null;
  let queryError = primary.error;
  if (queryError?.code === '42703') {
    const fallback = await client.from('submissions').select(SUBMISSION_FIELDS).eq('user_id', user.id);
    data = fallback.data as Record<string, unknown>[] | null;
    queryError = fallback.error;
  }
  if (queryError) throw new SubmissionServiceError('QUERY_FAILED', 'Your DREAMsheets could not be loaded.');
  return (data ?? [])
    .map(normalizeSavedDreamSheet)
    .sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0));
}

export async function getMyDreamSheetById(id: string): Promise<SavedDreamSheet> {
  const { client, user } = await getAuthenticatedUser();
  const primary = await client
    .from('submissions')
    .select(SUBMISSION_FIELDS_WITH_CREATED_AT)
    .eq('user_id', user.id)
    .eq('id', id)
    .single();
  let data = primary.data as Record<string, unknown> | null;
  let queryError = primary.error;
  if (queryError?.code === '42703') {
    const fallback = await client.from('submissions').select(SUBMISSION_FIELDS).eq('user_id', user.id).eq('id', id).single();
    data = fallback.data as Record<string, unknown> | null;
    queryError = fallback.error;
  }
  if (queryError || !data) throw new SubmissionServiceError('QUERY_FAILED', 'This DREAMsheet could not be loaded.');
  return normalizeSavedDreamSheet(data);
}
