-- ==============================================================================
-- Migration: 20260922000001_create_screenings_and_storage.sql
-- Purpose: Create public.screenings table, RLS policies, and storage configuration
-- ==============================================================================

-- 1. Create table public.screenings
CREATE TABLE IF NOT EXISTS public.screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  eyelid_image_path TEXT NOT NULL,
  eyelid_image_url TEXT NOT NULL,
  nailbed_image_path TEXT,
  nailbed_image_url TEXT,
  symptoms JSONB,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Add table comment
COMMENT ON TABLE public.screenings IS 'Stores individual user screening sessions, image storage references, and active symptoms.';

-- 3. Enable Row Level Security (RLS) on screenings
ALTER TABLE public.screenings ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for public.screenings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'screenings' AND policyname = 'Users can view own screenings'
  ) THEN
    CREATE POLICY "Users can view own screenings"
      ON public.screenings
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'screenings' AND policyname = 'Users can insert own screenings'
  ) THEN
    CREATE POLICY "Users can insert own screenings"
      ON public.screenings
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'screenings' AND policyname = 'Users can update own screenings'
  ) THEN
    CREATE POLICY "Users can update own screenings"
      ON public.screenings
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'screenings' AND policyname = 'Users can delete own screenings'
  ) THEN
    CREATE POLICY "Users can delete own screenings"
      ON public.screenings
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Storage Bucket Configuration for screening-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'screening-images',
  'screening-images',
  true,
  10485760, -- 10MB limit per image
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 6. Storage Bucket RLS Policies
DO $$
BEGIN
  -- Authenticated users can upload to their own user folder: {user_id}/*
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload own screening images'
  ) THEN
    CREATE POLICY "Users can upload own screening images"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'screening-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Anyone or authenticated users can view public screening images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read for screening images'
  ) THEN
    CREATE POLICY "Public read for screening images"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'screening-images');
  END IF;

  -- Users can update images in their own folder
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own screening images'
  ) THEN
    CREATE POLICY "Users can update own screening images"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'screening-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'screening-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Users can delete images in their own folder
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own screening images'
  ) THEN
    CREATE POLICY "Users can delete own screening images"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'screening-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
