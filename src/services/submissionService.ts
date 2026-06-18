import { supabase } from "../lib/supabaseClient";

export type DreamSheetSubmission = {
  client_name?: string;
  coach_name?: string;
  domains?: string[];
  focus_areas?: unknown;
  plan_data: unknown;
};

export async function saveDreamSheetSubmission(
  submission: DreamSheetSubmission
) {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from("submissions")
    .insert({
      client_name: submission.client_name ?? null,
      coach_name: submission.coach_name ?? null,
      domains: submission.domains ?? [],
      focus_areas: submission.focus_areas ?? {},
      plan_data: submission.plan_data,
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("Supabase save error:", error);
    throw error;
  }

  return data;
}
