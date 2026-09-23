export interface ValidationCheckResult {
  resolution: boolean;
  blur: boolean;
  brightness: boolean;
  eye_detection: boolean;
  eyelid_visibility: boolean;
}

export interface ValidationErrorItem {
  code: string;
  message: string;
}

export interface ValidationResponse {
  valid: boolean;
  message: string;
  checks: ValidationCheckResult;
  errors: ValidationErrorItem[];
}

export interface ImageValidationState {
  status: "idle" | "validating" | "valid" | "invalid" | "error";
  message?: string;
  errorDetail?: string;
}

/**
 * Validates a lower-eyelid image by calling POST /api/screen/validate-image.
 * Accepts a File, Blob, or a preview URL string.
 */
export async function validateEyelidImage(
  imageSource: File | Blob | string
): Promise<ValidationResponse> {
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

    // Call through Next.js proxy or direct backend URL
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    const endpoint = backendBase ? `${backendBase}/api/screen/validate-image` : "/api/screen/validate-image";

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

    const data = (await response.json()) as ValidationResponse;
    return data;
  } catch (err: unknown) {
    console.error("Validation network error:", err);
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
              : "Could not connect to image validation service.",
        },
      ],
    };
  }
}
