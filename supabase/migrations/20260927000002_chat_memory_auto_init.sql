-- ==============================================================================
-- Migration: 20260927000002_chat_memory_auto_init.sql
-- Purpose: Auto-init/sync public.chat_memory.profile_details from
-- public.user_profiles via trigger, mirroring backend/ai/chat/memory.py
-- _compact_profile allowlist (never invents values).
--
-- - On INSERT to user_profiles: insert chat_memory row
--   (user_id, profile_details, reports='[]', facts='{"conversations":[]}')
--   with ON CONFLICT (user_id) DO UPDATE (signup auto-profile + race safe).
-- - On UPDATE of profile columns: sync profile_details only (no new rows).
-- - Does NOT touch other tables/triggers/RLS.
-- ==============================================================================

-- 1. Sync function (idempotent)
CREATE OR REPLACE FUNCTION public.sync_chat_memory_profile()
RETURNS TRIGGER AS $$
DECLARE
  compact JSONB;
BEGIN
  -- Same keys/shape as memory.py _PROFILE_ALLOWLIST minus "name"
  -- (user_profiles has no name column). previous_anemia_history is sourced
  -- from NEW.anemia_history. Nulls/empty strings/empty arrays are dropped
  -- via NULLIF + jsonb_strip_nulls; never invents values.
  compact := jsonb_strip_nulls(jsonb_build_object(
    'age', NEW.age,
    'gender', NULLIF(BTRIM(NEW.gender), ''),
    'height_cm', NEW.height_cm,
    'weight_kg', NEW.weight_kg,
    'dietary_pattern', NULLIF(BTRIM(NEW.dietary_pattern), ''),
    'previous_anemia_history', NULLIF(BTRIM(NEW.anemia_history), ''),
    'chronic_conditions', NULLIF(BTRIM(NEW.chronic_conditions), ''),
    'symptoms', CASE
      WHEN array_length(NEW.symptoms, 1) > 0 THEN to_jsonb(NEW.symptoms)
      ELSE NULL
    END,
    'pregnancy_status', NULLIF(BTRIM(NEW.pregnancy_status), ''),
    'location', NULLIF(BTRIM(NEW.location), '')
  ));

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.chat_memory (user_id, profile_details, reports, facts)
    VALUES (NEW.id, compact, '[]'::jsonb, '{"conversations":[]}'::jsonb)
    ON CONFLICT (user_id) DO UPDATE SET profile_details = EXCLUDED.profile_details;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.chat_memory
    SET profile_details = compact
    WHERE user_id = NEW.id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Triggers (idempotent guards)
DROP TRIGGER IF EXISTS sync_chat_memory_on_profile_insert ON public.user_profiles;
CREATE TRIGGER sync_chat_memory_on_profile_insert
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_chat_memory_profile();

DROP TRIGGER IF EXISTS sync_chat_memory_on_profile_update ON public.user_profiles;
CREATE TRIGGER sync_chat_memory_on_profile_update
  AFTER UPDATE OF age, gender, height_cm, weight_kg, dietary_pattern, anemia_history, chronic_conditions, symptoms, pregnancy_status, location ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_chat_memory_profile();
