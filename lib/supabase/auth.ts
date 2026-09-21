import { createClient } from "./client";
import type { HealthProfile, HealthProfileInsert } from "@/types/database.types";

/**
 * Sign up a new user using email & password.
 * Optionally persists user metadata like full name.
 */
export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  const supabase = createClient();
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
}

/**
 * Sign in existing user using email & password.
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient();
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

/**
 * Sign out current authenticated session.
 */
export async function signOut() {
  const supabase = createClient();
  return await supabase.auth.signOut();
}

/**
 * Get current authenticated user session if present.
 */
export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return user;
}

/**
 * Fetch the authenticated user's health profile from public.user_profiles.
 */
export async function getHealthProfile(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return { data: data as HealthProfile | null, error };
}

/**
 * Upsert the authenticated user's health profile.
 */
export async function upsertHealthProfile(profile: HealthProfileInsert) {
  const supabase = createClient();
  const payload: HealthProfileInsert = {
    ...profile,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(payload as any)
    .select()
    .single();

  return { data: data as HealthProfile | null, error };
}
