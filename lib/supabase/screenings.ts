import { createClient } from "./client";
import type { Screening, ScreeningInsert, ScreeningSymptoms, Json, Report } from "@/types/database.types";
import { parseReportResult, type ParsedReportResult } from "./reportResult";

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
 * Upload a post-analysis ROI-marked image (base64 data URL) to the
 * 'screening-images' bucket and update the screening row with the real
 * storage path + public URL (plus status flip to completed).
 *
 * This is the post-analysis counterpart to the pre-upload ROI support in
 * createScreeningWithImages: ROI markup only exists AFTER backend analysis,
 * so it must be stored via update, never by stuffing base64 into URL columns.
 *
 * Non-fatal by design: returns null (with a console warning) on any failure
 * so callers can fall back to sessionStorage caching. Never throws.
 */
export type RoiKind = "eyelid" | "nailbed";

export async function uploadRoiImageAndUpdateScreening({
  screeningId,
  kind,
  base64,
}: {
  screeningId: string;
  kind: RoiKind;
  base64: string;
}): Promise<{ publicUrl: string; path: string } | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.warn("ROI upload skipped: no authenticated user.");
      return null;
    }

    const { blob, ext, contentType } = base64DataUrlToBlob(base64);
    const fileName = kind === "eyelid" ? "eyelid_roi" : "nailbed_roi";
    const roiPath = `${user.id}/${screeningId}/${fileName}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("screening-images")
      .upload(roiPath, blob, { contentType, upsert: true });
    if (uploadError) {
      console.warn(`Failed to upload ${fileName} image (non-fatal): ${uploadError.message}`);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("screening-images").getPublicUrl(roiPath);

    const urlColumn = kind === "eyelid" ? "eyelid_roi_image_url" : "nailbed_roi_image_url";
    const pathColumn = kind === "eyelid" ? "eyelid_roi_image_path" : "nailbed_roi_image_path";

    const { error: updateError } = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.from("screenings") as any
    )
      .update({ [urlColumn]: publicUrl, [pathColumn]: roiPath, status: "completed" })
      .eq("id", screeningId)
      .eq("user_id", user.id);
    if (updateError) {
      console.warn(`Failed to save ${fileName} URL to screening row (non-fatal): ${updateError.message}`);
      // Storage file exists and is publicly readable; still return refs.
    }

    return { publicUrl, path: roiPath };
  } catch (err) {
    console.warn("Non-fatal ROI upload issue:", err);
    return null;
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

export interface ScreeningHistoryItem {
  id: string;
  screening: Screening;
  report: Report | null;
  parsed: ParsedReportResult;
  createdAt: string;
  formattedDate: string;
  shortDate: string;
  hbEstimate: number | null;
  hbRange: string;
  riskLevel: "Lower risk" | "Mild risk" | "Moderate risk" | "High risk" | "Severe risk" | "Pending" | "Unclassifiable";
  rawRiskCategory: string | null;
  summary: string;
  reportHref: string;
  isLatest: boolean;
}

function formatScreeningDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "Recent";
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return "Recent";
  }
}

function formatScreeningShortDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "Recent";
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return "Recent";
  }
}

function mapRiskLevel(
  riskCategory?: string | null,
  status?: string
): ScreeningHistoryItem["riskLevel"] {
  if (status === "pending" || !riskCategory) return "Pending";
  const cat = riskCategory.toLowerCase();
  if (cat.includes("normal") || cat.includes("low")) return "Lower risk";
  if (cat.includes("mild")) return "Mild risk";
  if (cat.includes("mod")) return "Moderate risk";
  if (cat.includes("sev") || cat.includes("high")) return "High risk";
  if (cat.includes("unclass")) return "Unclassifiable";
  return "Lower risk";
}

function buildHistoryItem(
  screening: Screening,
  report: Report | null,
  isLatest: boolean
): ScreeningHistoryItem {
  const parsed = parseReportResult(report);

  let hbRange = "—";
  if (parsed.ml_prediction?.hb_estimate != null) {
    hbRange = `${parsed.ml_prediction.hb_estimate.toFixed(1)}`;
  } else if (parsed.ml_prediction?.hb_range) {
    const [low, high] = parsed.ml_prediction.hb_range;
    hbRange = `${low.toFixed(1)}–${high.toFixed(1)}`;
  }

  const rawRiskCategory = parsed.clinical_classification?.risk_category ?? null;
  const riskLevel = mapRiskLevel(rawRiskCategory, report?.status);

  let summary = parsed.narrative_report?.summary;
  if (!summary) {
    if (parsed.ml_prediction?.hb_estimate != null) {
      const hb = parsed.ml_prediction.hb_estimate;
      if (hb < 11.0) {
        summary = `Suggests moderate-to-elevated anemia risk (${hb.toFixed(1)} g/dL). A confirmatory blood test is recommended.`;
      } else {
        summary = `Estimated hemoglobin level (${hb.toFixed(1)} g/dL) suggests lower risk.`;
      }
    } else {
      summary = "Screening recorded. View report for detailed clinical insights.";
    }
  }

  return {
    id: screening.id,
    screening,
    report,
    parsed,
    createdAt: screening.created_at,
    formattedDate: formatScreeningDate(screening.created_at),
    shortDate: formatScreeningShortDate(screening.created_at),
    hbEstimate: parsed.ml_prediction?.hb_estimate ?? null,
    hbRange,
    riskLevel,
    rawRiskCategory,
    summary,
    reportHref: `/screening-report?screeningId=${screening.id}`,
    isLatest,
  };
}

/**
 * Fetch all completed screenings with their parsed report results for the current authenticated user.
 */
export async function getUserScreeningHistory(): Promise<{
  data: ScreeningHistoryItem[];
  error: Error | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { data: [], error: null };
  }

  // 1. Fetch screenings with joined reports
  const { data, error } = await supabase
    .from("screenings")
    .select(`
      *,
      reports (*)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback: Query tables independently if PostgREST relation syntax encounters issues
    const { data: screeningsData, error: sErr } = await supabase
      .from("screenings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (sErr) {
      return { data: [], error: new Error(sErr.message) };
    }

    const { data: reportsData } = await supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.id);

    const reportsMap = new Map<string, Report>();
    if (reportsData) {
      for (const r of reportsData as Report[]) {
        reportsMap.set(r.screening_id, r);
      }
    }

    const items: ScreeningHistoryItem[] = (screeningsData || []).map(
      (s: Screening, idx: number) => {
        const rep = reportsMap.get(s.id) || null;
        return buildHistoryItem(s, rep, idx === 0);
      }
    );

    return { data: items, error: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: ScreeningHistoryItem[] = ((data as any[]) || []).map((row: any, idx: number) => {
    const rawReport = Array.isArray(row.reports) ? row.reports[0] : row.reports;
    const report: Report | null = rawReport || null;
    const screening: Screening = {
      id: row.id,
      user_id: row.user_id,
      eyelid_image_path: row.eyelid_image_path,
      eyelid_image_url: row.eyelid_image_url,
      nailbed_image_path: row.nailbed_image_path,
      nailbed_image_url: row.nailbed_image_url,
      symptoms: row.symptoms,
      status: row.status,
      created_at: row.created_at,
      eyelid_roi_image_path: row.eyelid_roi_image_path,
      eyelid_roi_image_url: row.eyelid_roi_image_url,
      nailbed_roi_image_path: row.nailbed_roi_image_path,
      nailbed_roi_image_url: row.nailbed_roi_image_url,
    };
    return buildHistoryItem(screening, report, idx === 0);
  });

  return { data: items, error: null };
}
