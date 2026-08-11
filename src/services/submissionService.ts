import { supabase } from "../lib/supabaseClient";

export type DreamSheetStatus = 'draft' | 'completed';

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
  status: DreamSheetStatus;
  updated_at: string | null;
}

export class SubmissionServiceError extends Error {
  constructor(public readonly code: 'AUTH_REQUIRED' | 'CONFIGURATION' | 'QUERY_FAILED', message: string) {
    super(message);
    this.name = 'SubmissionServiceError';
  }
}

const LEGACY_SUBMISSION_FIELDS = 'id, user_id, client_name, coach_name, domains, focus_areas, plan_data';
const LEGACY_SUBMISSION_FIELDS_WITH_CREATED_AT = `${LEGACY_SUBMISSION_FIELDS}, created_at`;
const SUBMISSION_FIELDS = `${LEGACY_SUBMISSION_FIELDS_WITH_CREATED_AT}, status, updated_at`;

function getPlanCreatedAt(planData: unknown): string | null {
  if (!planData || typeof planData !== 'object') return null;
  const value = (planData as Record<string, unknown>).planCreatedAt;
  return typeof value === 'string' ? value : null;
}

function normalizeSavedDreamSheet(value: Record<string, unknown>): SavedDreamSheet {
  const createdAt = typeof value.created_at === 'string' ? value.created_at : getPlanCreatedAt(value.plan_data);

  return {
    id: typeof value.id === 'string' ? value.id : '',
    user_id: typeof value.user_id === 'string' ? value.user_id : '',
    client_name: typeof value.client_name === 'string' ? value.client_name : null,
    coach_name: typeof value.coach_name === 'string' ? value.coach_name : null,
    domains: Array.isArray(value.domains)
      ? value.domains.filter((domain): domain is string => typeof domain === 'string')
      : null,
    focus_areas: value.focus_areas,
    plan_data: value.plan_data,
    created_at: createdAt,
    status: value.status === 'draft' ? 'draft' : 'completed',
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : createdAt,
  };
}

function getSubmissionPayload(submission: DreamSheetSubmission) {
  return {
    client_name: submission.client_name ?? null,
    coach_name: submission.coach_name ?? null,
    domains: submission.domains ?? [],
    focus_areas: submission.focus_areas ?? {},
    plan_data: submission.plan_data,
  };
}

function throwSubmissionQueryError(message: string, error: unknown): never {
  console.error(message, error);
  throw new SubmissionServiceError('QUERY_FAILED', message);
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
  if (!data.user) throw new SubmissionServiceError('AUTH_REQUIRED', 'Please sign in to save or view DREAMSheets.');
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
      ...getSubmissionPayload(submission),
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
    .select(SUBMISSION_FIELDS)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });
  let data = primary.data as Record<string, unknown>[] | null;
  let queryError = primary.error;
  if (queryError?.code === '42703') {
    const fallback = await client
      .from('submissions')
      .select(LEGACY_SUBMISSION_FIELDS_WITH_CREATED_AT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    data = fallback.data as Record<string, unknown>[] | null;
    queryError = fallback.error;
  }
  if (queryError) throw new SubmissionServiceError('QUERY_FAILED', 'Your DREAMSheets could not be loaded.');
  return (data ?? [])
    .map(normalizeSavedDreamSheet)
    .sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0));
}

export async function getMyDreamSheetById(id: string): Promise<SavedDreamSheet> {
  const { client, user } = await getAuthenticatedUser();
  const primary = await client
    .from('submissions')
    .select(SUBMISSION_FIELDS)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .eq('id', id)
    .single();
  let data = primary.data as Record<string, unknown> | null;
  let queryError = primary.error;
  if (queryError?.code === '42703') {
    const fallback = await client
      .from('submissions')
      .select(LEGACY_SUBMISSION_FIELDS_WITH_CREATED_AT)
      .eq('user_id', user.id)
      .eq('id', id)
      .single();
    data = fallback.data as Record<string, unknown> | null;
    queryError = fallback.error;
  }
  if (queryError || !data) throw new SubmissionServiceError('QUERY_FAILED', 'This DREAMSheet could not be loaded.');
  return normalizeSavedDreamSheet(data);
}

export async function createDreamSheetDraft(
  submission: DreamSheetSubmission,
): Promise<SavedDreamSheet> {
  const { client, user } = await getAuthenticatedUser();
  const { data, error } = await client
    .from('submissions')
    .insert({
      user_id: user.id,
      status: 'draft' satisfies DreamSheetStatus,
      ...getSubmissionPayload(submission),
    })
    .select(SUBMISSION_FIELDS)
    .single();

  if (error || !data) throwSubmissionQueryError('Your DREAMSheet draft could not be created.', error);
  return normalizeSavedDreamSheet(data as Record<string, unknown>);
}

export async function updateDreamSheetDraft(
  id: string,
  submission: DreamSheetSubmission,
): Promise<SavedDreamSheet> {
  const { client, user } = await getAuthenticatedUser();
  const { data, error } = await client
    .from('submissions')
    .update(getSubmissionPayload(submission))
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .select(SUBMISSION_FIELDS)
    .single();

  if (error || !data) throwSubmissionQueryError('Your DREAMSheet draft could not be updated.', error);
  return normalizeSavedDreamSheet(data as Record<string, unknown>);
}

export async function getMyDreamSheetDraftById(id: string): Promise<SavedDreamSheet> {
  const { client, user } = await getAuthenticatedUser();
  const { data, error } = await client
    .from('submissions')
    .select(SUBMISSION_FIELDS)
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .single();

  if (error || !data) throwSubmissionQueryError('This DREAMSheet draft could not be loaded.', error);
  return normalizeSavedDreamSheet(data as Record<string, unknown>);
}

export async function getMyRecentDrafts(): Promise<SavedDreamSheet[]> {
  const { client, user } = await getAuthenticatedUser();
  const { data, error } = await client
    .from('submissions')
    .select(SUBMISSION_FIELDS)
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false });

  if (error) throwSubmissionQueryError('Your DREAMSheet drafts could not be loaded.', error);
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeSavedDreamSheet);
}

export async function completeDreamSheetDraft(
  id: string,
  finalData: DreamSheetSubmission,
): Promise<SavedDreamSheet> {
  const { client, user } = await getAuthenticatedUser();
  const { data, error } = await client
    .from('submissions')
    .update({
      ...getSubmissionPayload(finalData),
      status: 'completed' satisfies DreamSheetStatus,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .select(SUBMISSION_FIELDS)
    .single();

  if (error || !data) throwSubmissionQueryError('Your DREAMSheet draft could not be completed.', error);
  return normalizeSavedDreamSheet(data as Record<string, unknown>);
}
