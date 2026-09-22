-- ==============================================================================
-- Migration: 20260922000002_create_reports.sql
-- Purpose: Create public.reports table with RLS policies
-- ==============================================================================

-- 1. Create table public.reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_id UUID NOT NULL UNIQUE REFERENCES public.screenings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Add table comment
COMMENT ON TABLE public.reports IS 'Stores AI report records for each screening. One-to-one with screenings. Status progresses: pending → processing → complete | failed.';

-- 3. Enable Row Level Security
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can view own reports'
  ) THEN
    CREATE POLICY "Users can view own reports"
      ON public.reports
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can insert own reports'
  ) THEN
    CREATE POLICY "Users can insert own reports"
      ON public.reports
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can update own reports'
  ) THEN
    CREATE POLICY "Users can update own reports"
      ON public.reports
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can delete own reports'
  ) THEN
    CREATE POLICY "Users can delete own reports"
      ON public.reports
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Auto-update updated_at on row changes
DROP TRIGGER IF EXISTS set_reports_updated_at ON public.reports;
CREATE TRIGGER set_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
