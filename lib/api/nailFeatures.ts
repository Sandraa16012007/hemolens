/**
 * HemoLens — Nail-Bed Feature Extraction API helper
 * Calls POST /api/screen/extract-nail-features
 * Mirrors lib/api/eyelidFeatures.ts conventions.
 * Isolated from validation, ML, LLM logic. Not wired to Hb prediction.
 */

export interface NailRoi {
  x: number;
  y: number;
  width: number;
  height: number;
  pixel_count: number;
  nail_id?: number;
}

export interface PerNailFeatures {
  nail_id: number;
  candidate_index: number;
  valid: boolean;
  bbox: NailRoi;
  inner_bbox: NailRoi;
  pixel_count: number;
  clipped_fraction: number;
  mask_source: string;
  normalization: string;
  feature_vector: number[];
  features: Record<string, number>;
}

export interface NailFeaturesSuccess {
  success: true;
  feature_vector: number[];
  feature_names: string[];
  roi: NailRoi;
  nail_rois: NailRoi[];
  nail_count: number;
  per_nail_features: PerNailFeatures[];
  original_image_reference: string;
  roi_marked_image_reference: string;
  /** Base64 data URL of original (preserved) */
  original_image_base64?: string;
  /** Base64 data URL of ROI-marked image — upload to Supabase as nail_roi_image */
  roi_marked_image_base64?: string;
  meta?: Record<string, unknown>;
}

export interface NailFeaturesFailure {
  success: false;
  error: string;
  reason: string;
  roi: null;
  feature_vector: number[];
  feature_names: string[];
  nail_count: number;
  per_nail_features: PerNailFeatures[];
  original_image_reference?: string;
  roi_marked_image_reference?: string;
  original_image_base64?: string;
  roi_marked_image_base64?: string;
  meta?: Record<string, unknown>;
}

export type NailFeaturesResponse = NailFeaturesSuccess | NailFeaturesFailure;

/**
 * Extract features from a validated nail-bed image
 * (must already have passed validate-image-nail).
 */
export async function extractNailFeatures(
  imageSource: File | Blob | string,
  screeningId?: string
): Promise<NailFeaturesResponse> {
  let fileBlob: Blob;
  let filename = "nail.jpg";

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
        nail_count: 0,
        per_nail_features: [],
      };
    }
    fileBlob = await resp.blob();
  } else {
    fileBlob = imageSource;
    if (imageSource instanceof File) filename = imageSource.name;
  }

  const formData = new FormData();
  formData.append("image", fileBlob, filename);
  if (screeningId) {
    formData.append("screening_id", screeningId);
  }

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const endpoint = backendBase
    ? `${backendBase}/api/screen/extract-nail-features`
    : "/api/screen/extract-nail-features";

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
      nail_count: 0,
      per_nail_features: [],
    };
  }

  const data = (await response.json()) as NailFeaturesResponse;
  return data;
}
