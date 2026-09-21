-- ==============================================================================
-- Migration: 20260921000002_delete_user_rpc.sql
-- Purpose: Provide a secure RPC function for authenticated users to delete their
--          own account from auth.users (cascades to public.user_profiles).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Retrieve the authenticated user ID from context
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete from auth.users (cascades to public.user_profiles and related tables)
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Grant execution permission specifically to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
COMMENT ON FUNCTION public.delete_user() IS 'Enables an authenticated user to permanently delete their account from auth.users with cascade deletion to associated health records.';
