export interface EyelidValidationCheckResult {
  resolution: boolean;
  blur: boolean;
  brightness: boolean;
  eye_detection: boolean;
  eyelid_visibility: boolean;
}

export type ValidationCheckResult = EyelidValidationCheckResult;

export interface ValidationErrorItem {
  code: string;
  message: string;
}

export interface EyelidValidationResponse {
  valid: boolean;
  message: string;
  checks: EyelidValidationCheckResult;
  errors: ValidationErrorItem[];
}

export type ValidationResponse = EyelidValidationResponse;

export interface ImageValidationState {
  status: "idle" | "validating" | "valid" | "invalid" | "error";
  message?: string;
  errorDetail?: string;
}

/**
 * Validates a lower-eyelid image by calling POST /api/screen/validate-image-eyelid.
 * Accepts a File, Blob, or a preview URL string.
 */
export async function validateEyelidImage(
  imageSource: File | Blob | string
): Promise<EyelidValidationResponse> {
  try {
    let fileBlob: Blob;
    let filename = "eyelid.jpg";

    if (typeof imageSource === "string") {
      const resp = await fetch(imageSource);
      if (!resp.ok) {
        return {
          valid: false,
          message: "Failed to load image preview for validation.",
          checks: { resolution: false, blur: false, brightness: false, eye_detection: false, eyelid_visibility: false },
          errors: [{ code: "PREVIEW_FETCH_FAILED", message: "Could not load image data." }],
        };
      }
      fileBlob = await resp.blob();
    } else {
      fileBlob = imageSource;
      if (imageSource instanceof File) {
        filename = imageSource.name;
      }
    }

    const formData = new FormData();
    formData.append("image", fileBlob, filename);

    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    const endpoint = backendBase ? `${backendBase}/api/screen/validate-image-eyelid` : "/api/screen/validate-image-eyelid";

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        valid: false,
        message: "Image validation service encountered an unexpected error.",
        checks: { resolution: false, blur: false, brightness: false, eye_detection: false, eyelid_visibility: false },
        errors: [{ code: "SERVER_ERROR", message: errorText || "Internal validation server error." }],
      };
    }

    const data = (await response.json()) as EyelidValidationResponse;
    return data;
  } catch (err: unknown) {
    console.error("Eyelid validation network error:", err);
    return {
      valid: false,
      message: "Validation service is unreachable. Please ensure the backend server is running and try again.",
      checks: { resolution: false, blur: false, brightness: false, eye_detection: false, eyelid_visibility: false },
      errors: [
        {
          code: "NETWORK_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Could not connect to eyelid validation service.",
        },
      ],
    };
  }
}

// ===========================================================================
// NAIL-BED IMAGE VALIDATION
// ===========================================================================

export interface NailValidationCheckResult {
  resolution: boolean;
  blur: boolean;
  brightness: boolean;
  nail_detection: boolean;
  nail_quality: boolean;
}

export interface NailValidationResponse {
  valid: boolean;
  message: string;
  checks: NailValidationCheckResult;
  errors: ValidationErrorItem[];
  nail_count: number;
}

/**
 * Validates a nail-bed image by calling POST /api/screen/validate-image-nail.
 * Accepts a File, Blob, or a preview URL string.
 * Requires at least 3 clearly visible fingernails.
 */
export async function validateNailImage(
  imageSource: File | Blob | string
): Promise<NailValidationResponse> {
  const emptyChecks: NailValidationCheckResult = {
    resolution: false,
    blur: false,
    brightness: false,
    nail_detection: false,
    nail_quality: false,
  };

  try {
    let fileBlob: Blob;
    let filename = "nail.jpg";

    if (typeof imageSource === "string") {
      const resp = await fetch(imageSource);
      if (!resp.ok) {
        return {
          valid: false,
          message: "Failed to load image preview for validation.",
          checks: emptyChecks,
          errors: [{ code: "PREVIEW_FETCH_FAILED", message: "Could not load image data." }],
          nail_count: 0,
        };
      }
      fileBlob = await resp.blob();
    } else {
      fileBlob = imageSource;
      if (imageSource instanceof File) {
        filename = imageSource.name;
      }
    }

    const formData = new FormData();
    formData.append("image", fileBlob, filename);

    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    const endpoint = backendBase
      ? `${backendBase}/api/screen/validate-image-nail`
      : "/api/screen/validate-image-nail";

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        valid: false,
        message: "Nail validation service encountered an unexpected error.",
        checks: emptyChecks,
        errors: [{ code: "SERVER_ERROR", message: errorText || "Internal validation server error." }],
        nail_count: 0,
      };
    }

    const data = (await response.json()) as NailValidationResponse;
    return data;
  } catch (err: unknown) {
    console.error("Nail validation network error:", err);
    return {
      valid: false,
      message: "Validation service is unreachable. Please ensure the backend server is running and try again.",
      checks: emptyChecks,
      errors: [
        {
          code: "NETWORK_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Could not connect to nail validation service.",
        },
      ],
      nail_count: 0,
    };
  }
}
