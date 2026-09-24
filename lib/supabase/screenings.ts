import { createClient } from "./client";
import type { Screening, ScreeningInsert, ScreeningSymptoms, Json } from "@/types/database.types";

export interface ImagePayload {
  file?: File | Blob;
  previewUrl?: string;
  name?: string;
}

export interface CreateScreeningInput {
  eyelidImage: ImagePayload;
  nailBedImage?: ImagePayload | null;
  /** Phase 2: ROI-marked eyelid image (generated via POST /extract-eyelid-features) */
  eyelidRoiImage?: ImagePayload | null;
  /** Phase 2 passthrough: teammate-generated ROI-marked nailbed image */
  nailbedRoiImage?: ImagePayload | null;
  /** Alternative: base64 data URL for ROI images (convenience) */
  eyelidRoiBase64?: string | null;
  nailbedRoiBase64?: string | null;
  symptoms?: ScreeningSymptoms | null;
}

/**
 * Determine a clean, normalized file extension (.jpg, .png, .webp).
 */
function getNormalizedExtension(file?: File | Blob, name?: string): string {
  if (file?.type) {
    if (file.type.includes("png")) return "png";
    if (file.type.includes("webp")) return "webp";
    if (file.type.includes("jpeg") || file.type.includes("jpg")) return "jpg";
  }

  const filename = name || (file instanceof File ? file.name : "");
  if (filename) {
    const extMatch = filename.match(/\.([0-9a-z]+)(?:[?#]|$)/i);
    if (extMatch && extMatch[1]) {
      const ext = extMatch[1].toLowerCase();
      if (ext === "jpeg") return "jpg";
      if (["jpg", "png", "webp"].includes(ext)) return ext;
    }
  }

  return "jpg";
}

/**
 * Convert ImagePayload into an uploadable Blob + MIME type + Extension.
 */
async function resolveImageBlob(
  payload: ImagePayload,
  defaultName: string
): Promise<{ blob: Blob; ext: string; contentType: string }> {
  let blob: Blob;

  if (payload.file) {
    blob = payload.file;
  } else if (payload.previewUrl) {
    const response = await fetch(payload.previewUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image source from preview URL: ${payload.previewUrl}`);
    }
    blob = await response.blob();
  } else {
    throw new Error(`No file or preview URL provided for ${defaultName}.`);
  }

  const ext = getNormalizedExtension(blob, payload.name || defaultName);
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  return { blob, ext, contentType };
}

/**
 * Convert base64 data URL (e.g. data:image/jpeg;base64,...) to Blob + extension.
 */
function base64DataUrlToBlob(dataUrl: string): { blob: Blob; ext: string; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 data URL");
  const contentType = match[1];
  const b64 = match[2];
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: contentType });
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  return { blob, ext, contentType };
}

function resolveRoiPayload(
  imagePayload: ImagePayload | null | undefined,
  base64: string | null | undefined,
  defaultName: string
): Promise<{ blob: Blob; ext: string; contentType: string } | null> {
  if (imagePayload && (imagePayload.file || imagePayload.previewUrl)) {
    return resolveImageBlob(imagePayload, defaultName);
  }
  if (base64) {
    try {
      const { blob, ext, contentType } = base64DataUrlToBlob(base64);
      return Promise.resolve({ blob, ext, contentType });
    } catch (e) {
      console.warn(`Failed to parse ROI base64 for ${defaultName}:`, e);
      return Promise.resolve(null);
    }
  }
  return Promise.resolve(null);
}

/**
 * Uploads screening images to Supabase Storage ('screening-images' bucket)
 * and creates a screening record in public.screenings with strict ownership.
 */
export async function createScreeningWithImages({
  eyelidImage,
  nailBedImage,
  eyelidRoiImage,
  nailbedRoiImage,
  eyelidRoiBase64,
  nailbedRoiBase64,
  symptoms,
}: CreateScreeningInput): Promise<{ data: Screening | null; error: Error | null }> {
  const supabase = createClient();

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      data: null,
      error: new Error("Authentication required. Please sign in to create a screening."),
    };
  }

  const userId = user.id;
  const screeningId = crypto.randomUUID();
  const uploadedPaths: string[] = [];

  try {
    // 2. Prepare Eyelid Image (Mandatory)
    const eyelidResolved = await resolveImageBlob(eyelidImage, "eyelid.jpg");
    const eyelidPath = `${userId}/${screeningId}/eyelid.${eyelidResolved.ext}`;

    // Upload Eyelid to Supabase Storage
    const { error: eyelidUploadError } = await supabase.storage
      .from("screening-images")
      .upload(eyelidPath, eyelidResolved.blob, {
        contentType: eyelidResolved.contentType,
        upsert: true,
      });

    if (eyelidUploadError) {
      throw new Error(`Failed to upload lower-eyelid image: ${eyelidUploadError.message}`);
    }
    uploadedPaths.push(eyelidPath);

    const {
      data: { publicUrl: eyelidPublicUrl },
    } = supabase.storage.from("screening-images").getPublicUrl(eyelidPath);

    // 3. Prepare Nail-bed Image (Optional)
    let nailbedPath: string | null = null;
    let nailbedPublicUrl: string | null = null;

    if (nailBedImage && (nailBedImage.file || nailBedImage.previewUrl)) {
      const nailResolved = await resolveImageBlob(nailBedImage, "nailbed.jpg");
      nailbedPath = `${userId}/${screeningId}/nailbed.${nailResolved.ext}`;

      const { error: nailUploadError } = await supabase.storage
        .from("screening-images")
        .upload(nailbedPath, nailResolved.blob, {
          contentType: nailResolved.contentType,
          upsert: true,
        });

      if (nailUploadError) {
        throw new Error(`Failed to upload nail-bed image: ${nailUploadError.message}`);
      }
      uploadedPaths.push(nailbedPath);

      const {
        data: { publicUrl: nailUrl },
      } = supabase.storage.from("screening-images").getPublicUrl(nailbedPath);
      nailbedPublicUrl = nailUrl;
    }

    // 3b. Prepare Eyelid ROI Image (Phase 2) — optional but preferred
    let eyelidRoiPath: string | null = null;
    let eyelidRoiPublicUrl: string | null = null;
    const eyelidRoiResolved = await resolveRoiPayload(eyelidRoiImage, eyelidRoiBase64, "eyelid_roi.jpg");
    if (eyelidRoiResolved) {
      eyelidRoiPath = `${userId}/${screeningId}/eyelid_roi.${eyelidRoiResolved.ext}`;
      const { error: roiUploadError } = await supabase.storage
        .from("screening-images")
        .upload(eyelidRoiPath, eyelidRoiResolved.blob, {
          contentType: eyelidRoiResolved.contentType,
          upsert: true,
        });
      if (roiUploadError) {
        console.warn(`Failed to upload eyelid ROI image (non-fatal): ${roiUploadError.message}`);
        eyelidRoiPath = null;
      } else {
        uploadedPaths.push(eyelidRoiPath);
        const {
          data: { publicUrl: roiUrl },
        } = supabase.storage.from("screening-images").getPublicUrl(eyelidRoiPath);
        eyelidRoiPublicUrl = roiUrl;
      }
    }

    // 3c. Prepare Nail-bed ROI Image (Phase 2 passthrough, teammate)
    let nailbedRoiPath: string | null = null;
    let nailbedRoiPublicUrl: string | null = null;
    const nailbedRoiResolved = await resolveRoiPayload(nailbedRoiImage, nailbedRoiBase64, "nailbed_roi.jpg");
    if (nailbedRoiResolved) {
      nailbedRoiPath = `${userId}/${screeningId}/nailbed_roi.${nailbedRoiResolved.ext}`;
      const { error: nailRoiUploadError } = await supabase.storage
        .from("screening-images")
        .upload(nailbedRoiPath, nailbedRoiResolved.blob, {
          contentType: nailbedRoiResolved.contentType,
          upsert: true,
        });
      if (nailRoiUploadError) {
        console.warn(`Failed to upload nailbed ROI image (non-fatal): ${nailRoiUploadError.message}`);
        nailbedRoiPath = null;
      } else {
        uploadedPaths.push(nailbedRoiPath);
        const {
          data: { publicUrl: nailRoiUrl },
        } = supabase.storage.from("screening-images").getPublicUrl(nailbedRoiPath);
        nailbedRoiPublicUrl = nailRoiUrl;
      }
    }

    // 4. Insert row into public.screenings (including Phase 2 ROI urls)
    const screeningPayload: ScreeningInsert = {
      id: screeningId,
      user_id: userId,
      eyelid_image_path: eyelidPath,
      eyelid_image_url: eyelidPublicUrl,
      nailbed_image_path: nailbedPath,
      nailbed_image_url: nailbedPublicUrl,
      eyelid_roi_image_path: eyelidRoiPath,
      eyelid_roi_image_url: eyelidRoiPublicUrl,
      nailbed_roi_image_path: nailbedRoiPath,
      nailbed_roi_image_url: nailbedRoiPublicUrl,
      symptoms: (symptoms || null) as unknown as Json,
      status: "uploaded",
    };

    const { data: screeningRecord, error: dbError } = await supabase
      .from("screenings")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(screeningPayload as any)
      .select()
      .single();

    if (dbError) {
      throw new Error(`Failed to create database screening record: ${dbError.message}`);
    }

    return { data: screeningRecord as Screening, error: null };
  } catch (err: unknown) {
    // 5. Rollback uploaded storage files on error to avoid orphaned storage objects
    if (uploadedPaths.length > 0) {
      try {
        await supabase.storage.from("screening-images").remove(uploadedPaths);
      } catch (cleanupError) {
        console.warn("Storage cleanup failed after abortive upload:", cleanupError);
      }
    }

    const message = err instanceof Error ? err.message : "Screening creation failed.";
    return { data: null, error: new Error(message) };
  }
}

/**
 * Fetch an individual screening record by its ID.
 */
export async function getScreeningById(
  screeningId: string
): Promise<{ data: Screening | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("screenings")
    .select("*")
    .eq("id", screeningId)
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  return { data: data as Screening, error: null };
}

/**
 * Fetch all historical screenings for the authenticated user.
 */
export async function getUserScreenings(): Promise<{
  data: Screening[];
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("screenings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }
  return { data: (data as Screening[]) || [], error: null };
}
