-- ==============================================================================
-- Migration: 20260926000001_create_chat_memory.sql
-- Purpose: Create public.chat_memory table with RLS policies
-- Stores long-term conversational facts for the HemoLens AI Health Assistant.
-- Facts hold ONLY conversational items (recent_topics, user_notes) — never
-- Hb values, clinical numbers, images, or model internals.
-- ==============================================================================

-- 1. Create table public.chat_memory
CREATE TABLE IF NOT EXISTS public.chat_memory (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Add table comment
COMMENT ON TABLE public.chat_memory IS 'Stores long-term conversational memory (recent_topics, user_notes) for the AI Health Assistant. One row per user.';

-- 3. Enable Row Level Security
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
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

-- 5. Auto-update updated_at on row changes
DROP TRIGGER IF EXISTS set_chat_memory_updated_at ON public.chat_memory;
CREATE TRIGGER set_chat_memory_updated_at
  BEFORE UPDATE ON public.chat_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
