-- ==============================================================================
-- Migration: 20260923000001_add_roi_columns.sql
-- Purpose: Add ROI-marked image references for Phase 2 eyelid feature extraction
--          Stores original ↓ ROI-Marked structure for report:
--            Original Eyelid  -> ROI-Marked Eyelid
--            Original Nailbed -> ROI-Marked Nailbed
-- ==============================================================================

-- Add columns if not exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='screenings' AND column_name='eyelid_roi_image_path') THEN
    ALTER TABLE public.screenings ADD COLUMN eyelid_roi_image_path TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='screenings' AND column_name='eyelid_roi_image_url') THEN
    ALTER TABLE public.screenings ADD COLUMN eyelid_roi_image_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='screenings' AND column_name='nailbed_roi_image_path') THEN
    ALTER TABLE public.screenings ADD COLUMN nailbed_roi_image_path TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='screenings' AND column_name='nailbed_roi_image_url') THEN
    ALTER TABLE public.screenings ADD COLUMN nailbed_roi_image_url TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.screenings.eyelid_roi_image_path IS 'Storage path for ROI-marked eyelid image (translucent mask + outline), generated via triangle+entropy Phase 2.';
COMMENT ON COLUMN public.screenings.eyelid_roi_image_url IS 'Public URL for ROI-marked eyelid image.';
COMMENT ON COLUMN public.screenings.nailbed_roi_image_path IS 'Storage path for ROI-marked nailbed image (teammate, passthrough).';
COMMENT ON COLUMN public.screenings.nailbed_roi_image_url IS 'Public URL for ROI-marked nailbed image.';
