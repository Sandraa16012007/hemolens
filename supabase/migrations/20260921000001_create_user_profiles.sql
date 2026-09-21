-- ==============================================================================
-- Migration: 20260921000001_create_user_profiles.sql
-- Purpose: Create public.user_profiles table, constraints, RLS policies, and triggers
-- ==============================================================================

-- 1. Create table public.user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  -- Primary key linked directly to Supabase auth.users UUID
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic demographic & biometric metrics
  age SMALLINT CHECK (age IS NULL OR (age > 0 AND age <= 125)),
  gender TEXT CHECK (gender IS NULL OR gender IN ('Female', 'Male', 'Other', 'Prefer not to say')),
  height_cm NUMERIC(5, 1) CHECK (height_cm IS NULL OR (height_cm >= 40.0 AND height_cm <= 300.0)),
  weight_kg NUMERIC(5, 1) CHECK (weight_kg IS NULL OR (weight_kg >= 10.0 AND weight_kg <= 400.0)),
  
  -- Lifestyle & medical context
  dietary_pattern TEXT CHECK (dietary_pattern IS NULL OR dietary_pattern IN ('Vegetarian', 'Non-veg', 'Vegan')),
  anemia_history TEXT CHECK (anemia_history IS NULL OR anemia_history IN ('No', 'Yes', 'Not sure')),
  chronic_conditions TEXT,
  symptoms TEXT[] DEFAULT ARRAY[]::TEXT[],
  pregnancy_status TEXT CHECK (pregnancy_status IS NULL OR pregnancy_status IN ('Not applicable', 'Pregnant', 'Not pregnant')),
  location TEXT,
  
  -- Primary care provider follow-up (optional)
  doctor_name TEXT,
  doctor_phone TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Add table comment
COMMENT ON TABLE public.user_profiles IS 'Stores authenticated user health profile information for HemoLens preliminary anemia risk baselining.';

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.user_profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.user_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.user_profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can delete own profile'
  ) THEN
    CREATE POLICY "Users can delete own profile"
      ON public.user_profiles
      FOR DELETE
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

-- 5. Auto-update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. Auto-create empty profile row on user signup via auth.users trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, created_at, updated_at)
  VALUES (NEW.id, timezone('utc'::text, now()), timezone('utc'::text, now()))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();
