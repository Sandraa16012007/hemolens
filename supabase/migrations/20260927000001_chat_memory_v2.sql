-- ==============================================================================
-- Migration: 20260927000001_chat_memory_v2.sql
-- Purpose: Extend public.chat_memory with persistent assistant memory columns.
-- Adds profile_details (compact allowlisted health context) and reports
-- (compact newest-first screening summaries). Backfills facts with an empty
-- conversations list so existing rows keep working.
--
-- Does NOT drop/recreate the table and does NOT touch PK/FK/trigger/RLS.
-- ==============================================================================

-- 1. New columns (idempotent)
ALTER TABLE public.chat_memory
  ADD COLUMN IF NOT EXISTS profile_details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.chat_memory
  ADD COLUMN IF NOT EXISTS reports JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Preserve existing rows: ensure facts carries a conversations list
UPDATE public.chat_memory
  SET facts = COALESCE(facts, '{}'::jsonb) || '{"conversations":[]}'::jsonb
  WHERE NOT (COALESCE(facts, '{}'::jsonb) ? 'conversations');

-- 3. Refresh table comment
COMMENT ON TABLE public.chat_memory IS 'Stores persistent AI assistant memory: profile_details (compact health context), reports (compact newest-first screening summaries), and facts.conversations (last 10 exchanges). One row per user.';

-- 4. RLS: own-row policies already exist (created in 20260926000001); create
-- only if missing, following the same pg_policies guard pattern.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_memory' AND policyname = 'Users can view own chat memory'
  ) THEN
    CREATE POLICY "Users can view own chat memory"
      ON public.chat_memory
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_memory' AND policyname = 'Users can insert own chat memory'
  ) THEN
    CREATE POLICY "Users can insert own chat memory"
      ON public.chat_memory
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_memory' AND policyname = 'Users can update own chat memory'
  ) THEN
    CREATE POLICY "Users can update own chat memory"
      ON public.chat_memory
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_memory' AND policyname = 'Users can delete own chat memory'
  ) THEN
    CREATE POLICY "Users can delete own chat memory"
      ON public.chat_memory
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Verify-only check: the updated_at trigger must still exist.
-- This block only inspects pg_trigger; it never creates, drops, or alters it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_chat_memory_updated_at'
  ) THEN
    RAISE WARNING 'chat_memory trigger set_chat_memory_updated_at is missing (expected from 20260926000001).';
  END IF;
END $$;
