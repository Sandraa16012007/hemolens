import { createClient } from "./client";
import type { Screening, Report, ReportInsert } from "@/types/database.types";

/**
 * Fetch a screening by ID, verifying the authenticated user owns it.
 * Returns null if not found or if auth.uid() doesn't match the owner.
 */
export async function getScreeningForReport(screeningId: string): Promise<{
  data: Screening | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: null, error: new Error("Authentication required.") };
  }

  const { data, error } = await supabase
    .from("screenings")
    .select("*")
    .eq("id", screeningId)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return {
      data: null,
      error: new Error(
        error.code === "PGRST116"
          ? "Screening not found or access denied."
          : error.message
      ),
    };
  }

  return { data: data as Screening, error: null };
}

/**
 * Fetch the report for a given screening, or create a pending one if missing.
 * Safe to call on every report page load.
 */
export async function getOrCreateReport(
  screeningId: string,
  userId: string
): Promise<{ data: Report | null; error: Error | null }> {
  const supabase = createClient();

  // Attempt to fetch an existing report
  const { data: existing, error: fetchError } = await supabase
    .from("reports")
    .select("*")
    .eq("screening_id", screeningId)
    .single();

  if (existing && !fetchError) {
    return { data: existing as Report, error: null };
  }

  // PGRST116 = "no rows returned" — safe to create
  if (fetchError && fetchError.code !== "PGRST116") {
    return { data: null, error: new Error(fetchError.message) };
  }

  const payload: ReportInsert = {
    screening_id: screeningId,
    user_id: userId,
    status: "pending",
    result: null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: insertError } = await (supabase.from("reports") as any)
    .insert(payload)
    .select()
    .single();

  if (insertError) {
    return { data: null, error: new Error(insertError.message) };
  }

  return { data: created as Report, error: null };
}
