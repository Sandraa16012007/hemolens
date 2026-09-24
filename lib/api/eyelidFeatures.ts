/**
 * HemoLens Phase 2 — Eyelid Feature Extraction API helper
 * Calls POST /api/screen/extract-eyelid-features
 * Isolated from validation, ML, LLM logic.
 */

export interface EyelidRoi {
  x: number;
  y: number;
  width: number;
  height: number;
  pixel_count: number;
}

export interface EyelidFeaturesSuccess {
  success: true;
  feature_vector: number[];
  feature_names: string[];
  roi: EyelidRoi;
  original_image_reference: string;
  roi_marked_image_reference: string;
  /** Base64 data URL of original (preserved) — for verification */
  original_image_base64?: string;
  /** Base64 data URL of ROI-marked image — upload this to Supabase as eyelid_roi_image */
  roi_marked_image_base64?: string;
  nailbed_original_reference?: string | null;
  nailbed_roi_reference?: string | null;
  meta?: Record<string, unknown>;
}

export interface EyelidFeaturesFailure {
  success: false;
  error: string;
  reason: string;
  roi: null;
  feature_vector: number[];
  feature_names: string[];
  nailbed_original_reference?: string | null;
  nailbed_roi_reference?: string | null;
  meta?: Record<string, unknown>;
}

export type EyelidFeaturesResponse = EyelidFeaturesSuccess | EyelidFeaturesFailure;

/**
 * Extract features from a verified eyelid image.
 * @param imageSource File | Blob | string (preview URL)
 * @param nailbedRefs optional passthrough for nail-bed image references (teammate)
 */
export async function extractEyelidFeatures(
  imageSource: File | Blob | string,
  nailbedRefs?: {
    nailbed_original_reference?: string | null;
    nailbed_roi_reference?: string | null;
  }
): Promise<EyelidFeaturesResponse> {
  let fileBlob: Blob;
  let filename = "eyelid.jpg";

  if (typeof imageSource === "string") {
    const resp = await fetch(imageSource);
    if (!resp.ok) {
      return {
        success: false,
        error: "PREVIEW_FETCH_FAILED",
        reason: "Could not load image data from preview URL.",
        roi: null,
        feature_vector: [],
        feature_names: [],
      };
    }
    fileBlob = await resp.blob();
  } else {
    fileBlob = imageSource;
    if (imageSource instanceof File) filename = imageSource.name;
  }

  const formData = new FormData();
  formData.append("image", fileBlob, filename);
  if (nailbedRefs?.nailbed_original_reference) {
    formData.append("nailbed_original_reference", nailbedRefs.nailbed_original_reference);
  }
  if (nailbedRefs?.nailbed_roi_reference) {
    formData.append("nailbed_roi_reference", nailbedRefs.nailbed_roi_reference);
  }

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const endpoint = backendBase
    ? `${backendBase}/api/screen/extract-eyelid-features`
    : "/api/screen/extract-eyelid-features";

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      success: false,
      error: "SERVER_ERROR",
      reason: text || `Server returned ${response.status}`,
      roi: null,
      feature_vector: [],
      feature_names: [],
    };
  }

  const data = (await response.json()) as EyelidFeaturesResponse;
  return data;
}
