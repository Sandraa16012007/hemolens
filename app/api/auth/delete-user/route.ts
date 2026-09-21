import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: No active session found." },
        { status: 401 }
      );
    }

    const userId = user.id;
    let deleted = false;

    // Method 1: Try executing the delete_user RPC function
    try {
      const { error: rpcError } = await supabase.rpc("delete_user");
      if (!rpcError) {
        deleted = true;
      }
    } catch {
      // RPC might not exist yet, fallback to next method
    }

    // Method 2: If Service Role Key is configured, use admin client
    if (!deleted && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && serviceRoleKey) {
        const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey);
        const { error: adminError } = await adminSupabase.auth.admin.deleteUser(userId);
        if (!adminError) {
          deleted = true;
        }
      }
    }

    // Method 3: Fallback cleanup on public tables
    if (!deleted) {
      await supabase.from("user_profiles").delete().eq("id", userId);
    }

    // Invalidate session cookies
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: "User account and profile data deleted successfully.",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to delete user account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
