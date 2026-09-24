# HemoLens Phase 2 — Eyelid / Palpebral Conjunctiva Feature Extraction Report

**Date:** 2025-09-24
**Scope:** ONLY Phase 2 eyelid feature extraction. No Hb prediction, no classification, no ML/LLM, no nail implementation, no verification changes, minimal report plumbing.

---

## 1. Files Created / Changed

### New files (isolated, no existing logic modified)
| Path | Purpose |
|------|---------|
| `backend/cv/eyelid_features.py` | Core deterministic pipeline: ROI detection (triangle+entropy), CLAHE normalization, RGB/HSV/LAB + redness features, ROI-marked generation, isolated function `extract_eyelid_features()` |
| `backend/routers/features.py` | FastAPI router exposing `POST /api/screen/extract-eyelid-features` + `GET /api/screen/report-image-refs/{id}` (passthrough). Zero dependency on `screen.py` validation |
| `backend/tests/test_eyelid_features.py` | 8 tests: success, invalid ROI, determinism, finite/fixed-length, name/vector alignment, preservation, marked generation, endpoint passthrough. Logs ROI + every feature |
| `lib/api/eyelidFeatures.ts` | Frontend helper calling `POST /api/screen/extract-eyelid-features` with optional nail passthrough |
| `docs/PHASE2_EYELID_FEATURES_REPORT.md` | This report |

### Minimally changed files (one-line integration, no refactoring)
| Path | Change |
|------|--------|
| `backend/main.py:28-30,78-79` | Import `features` router and `app.include_router(features.router)` — single line addition |
| `app/screening-report/components/TopMetricsGrid.tsx` | Added optional props `eyelidRoiMarkedUrl`, `nailbedRoiMarkedUrl` and conditional 4-image vertical structure (`Original Eyelid ↓ ROI-Marked \| Original Nail ↓ ROI-Marked`). Falls back to original 2-image grid when refs absent |
| `app/screening-report/components/ImagePreviewModal.tsx` | Added `eyelidRoiMarkedUrl`, `nailbedRoiMarkedUrl` props and 4-image modal layout with arrow separators |
| `next.config.ts`, `app/api/auth`, `supabase/*`, `backend/routers/screen.py`, `backend/config.py`, `lib/supabase/*` etc | **NOT modified** |

**Git diff summary** (run `git diff --stat`): 5 new files, 3 minimally edited (main.py 2 lines, TopMetricsGrid ~80 lines additive, ImagePreviewModal ~80 lines additive, all behind conditional rendering).

---

## 2. Exact ROI Method (CP-AnemiC research basis)

**Target:** Lower palpebral conjunctiva — highly vascularized mucosal tissue, close to surface, color correlates with Hb.

**Steps (deterministic, OpenCV only):**

1. **Grayscale + Entropy:** `BGR->GRAY`, `GaussianBlur 5x5`, histogram entropy `−Σ p log2 p` (logged as `meta.entropy`). Research requires entropy/grayscale processing; entropy used for validation (must be >3.0, rejects uniform images).

2. **Triangle thresholding:** `cv2.threshold(gray_blur, 0,255, THRESH_BINARY+THRESH_TRIANGLE)` → `tri_mask`, `tri_thresh` value, `tri_inv = bitwise_not(tri_mask)`. This is the CP-AnemiC triangle step.

3. **Mucosal color pre-filter (RGB):** In `RGB` space (from `BGR->RGB`):  
   `mucosa = (R>80) & (R−G>30) & (R−B>40)` → `mucosa_u8`. Simple image-derived redness pre-filter, **NOT clinically validated**, justified as vascular pink/red heuristic (same as validation).

4. ** Landmark vs Macro branch:**
   - **If MediaPipe FaceLandmarker detects face (validation thresholds 0.25):** Build convex hull of lower-eyelid landmarks (`RIGHT_LOWER` or `LEFT_LOWER` dominant eye), dilate 7x7, intersect `mucosa_u8 & hull`. If sparse (<500px), fallback to hull alone (landmark polygon is strong prior). Optionally intersect with `tri_inv` if it retains >15% of combined. Clean via `MORPH_OPEN 7x7 iter1` + `MORPH_CLOSE 7x7 iter2`.
   - **Else macro close-up (no face):** `mucosa_u8` cleaned `OPEN iter2 CLOSE iter2`, adaptively intersect with `tri_inv` if `0.05 < tri_inv_frac <0.60` and retains >15%. Find external contours.

5. **Contour selection:**
   - Landmark: largest contour in cleaned mask → `bbox (x,y,w,h)` via `boundingRect`, `precise_mask` via `drawContours(..., -1, 255, -1)`, `pixel_count = countNonZero(precise_mask)`.
   - Macro: filter contours by `frac = area/total` in `[0.003, 0.80]` (relaxed for high-res 0.54% and tight macro 88%), allow huge 0.60–0.95 if absolute >10k, prefer central `dist_norm = hypot(cx−w/2,cy−h/2)/hypot(w/2,h/2)`. Largest central area wins. If huge >0.85 and mask >0.90 white, try `tri_inv` refined.

6. **ROI validation (structured failure, never fabricated):**
   - `pixel_count >= 1500` **and** `frac >=0.003` else `INVALID_ROI`
   - `frac <=0.95` else too large
   - `w,h >=20`
   - `entropy >=3.0`
   - `bbox` not covering >95% width+height simultaneously
   - On failure returns `{"success": false, "error":"INVALID_ROI", "reason": "...", "roi": null, "feature_vector": [], "feature_names": FEATURE_NAMES}`.

**Example ROI outputs (logged in tests):**
- `good1.jpg: x=458 y=686 w=622 h=272 pixel_count=95903 frac=0.0927 entropy 7.18 tri 117.0`
- `good2.jpeg (landmark): x=506 y=1813 w=361 h=177 pixel_count=40220 frac=0.0054`
- `good4.png: x=170 y=229 w=275 h=201 pixel_count=19035`
- `good3.png (macro close-up): x=0 y=0 w=600 h=557 pixel_count=294815 frac=0.88` (tight crop, whole image is conjunctiva)
- `uniform gray 500x500: INVALID_ROI No mucosa contour`
- `blurry.png, no-conjunctiva.jpg: INVALID_ROI` (correctly rejected)

---

## 3. Preprocessing — Lightweight OpenCV Illumination/Color Normalization

**Method:** LAB CLAHE on L-channel only.

```python
lab = cv2.cvtColor(bgr, COLOR_BGR2LAB)
l,a,b = split(lab)
clahe = createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
l_eq = clahe.apply(l)
normalized = cvtColor(merge([l_eq,a,b]), COLOR_LAB2BGR)
```

- **Why:** Research emphasizes lighting strongly affects color analysis; CLAHE on L reduces illumination variation while preserving chromaticity (`a*`, `b*` unchanged). Lightweight, deterministic, OpenCV-only.
- **Documented:** Applied to whole image before feature extraction; features computed **only on ROI pixels** of normalized image.
- **Logged:** `meta.normalization = "LAB_CLAHE_L_clip2.0_tile8x8"`.

---

## 4. Every Feature Definition & Research Basis

All statistics computed **only on valid ROI pixels** (normalized BGR), using `numpy` percentiles. Deterministic, reproducible.

**OpenCV scaling documented:**
- **RGB:** `BGR 0-255 -> RGB 0-255` via `cvtColor`. `R = rgb[:,:,0]`.
- **HSV:** `H 0-179` (0-360°/2), `S 0-255`, `V 0-255` via `COLOR_BGR2HSV`.
- **CIELAB (OpenCV):** `L 0-255 = L*×255/100`, `a 0-255 = a*+128`, `b 0-255 = b*+128` via `COLOR_BGR2LAB`. Emphasis on `a` (red-green) per CP-AnemiC: higher Hb → higher `a*`.

### RGB (15) — raw reflectance
| Feature | Definition |
|---------|------------|
| `r_mean`, `r_std`, `r_p25`, `r_median`, `r_p75` | Mean/std/25th/median/75th of R channel (0-255) in ROI |
| `g_mean`...`g_p75` | Same for G |
| `b_mean`...`b_p75` | Same for B |

Basis: Direct reflectance; conjunctiva redness (R) vs pallor (lower R) is primary signal.

### HSV (15) — perceptual color
| Feature | Definition |
|---------|------------|
| `h_mean`...`h_p75` | H 0-179 |
| `s_mean`...`s_p75` | S 0-255 (saturation, vascular vividness) |
| `v_mean`...`v_p75` | V 0-255 (value, brightness, already normalized via CLAHE) |

Basis: HSV separates hue/saturation from value, more robust to lighting than RGB alone.

### CIELAB (15) — perceptually uniform, research-justified
| Feature | Definition |
|---------|------------|
| `lab_l_mean`...`lab_l_p75` | L 0-255 (≈L*) |
| `lab_a_mean`...`lab_a_p75` | **a 0-255 (≈a* +128) — emphasis**. CP-AnemiC reports `a*` red-green correlates with Hb; higher Hb → higher `a*`, lower Hb → lower `a*`. We compute full stats (mean/std/p25/median/p75) to capture distribution, not single threshold. **No anemia threshold created.** |
| `lab_b_mean`...`lab_b_p75` | b 0-255 (≈b* +128, yellow-blue) |

Basis: Paper specifically uses CIELAB and highlights `a*`. We expose all stats for later ML; no clinical claim.

### Redness / Erythema proxies (4) — simple, justified, **NOT clinically validated**
Do NOT claim validated formulas. Small number, straightforward image-derived:

| Feature | Formula (per-pixel in RGB 0-255, then mean over ROI) | Justification |
|---------|--------------------------------------------------------|---------------|
| `red_chromaticity_mean` | `mean( R / (R+G+B+1e-6) )` | Normalized red chromaticity, insensitive to brightness |
| `r_minus_g_mean` | `mean( R - G )` | Red minus green, redness excess |
| `r_minus_b_mean` | `mean( R - B )` | Red minus blue, vascular red vs venous |
| `excess_red_mean` | `mean( 2*R - G - B )` | Classic excess red (2R-G-B), highlights reddish mucosa |

These complement `a*` with lightweight RGB erythema information; explicitly **not** medically validated indices, only image-derived.

---

## 5. Exact Feature-Vector Length / Order

**Length:** `49` (`FEATURE_DIM`).

**Ordered `FEATURE_NAMES` (matches `feature_vector` index):**

```
0  r_mean
1  r_std
2  r_p25
3  r_median
4  r_p75
5  g_mean
6  g_std
7  g_p25
8  g_median
9  g_p75
10 b_mean
11 b_std
12 b_p25
13 b_median
14 b_p75
15 h_mean
16 h_std
17 h_p25
18 h_median
19 h_p75
20 s_mean
21 s_std
22 s_p25
23 s_median
24 s_p75
25 v_mean
26 v_std
27 v_p25
28 v_median
29 v_p75
30 lab_l_mean
31 lab_l_std
32 lab_l_p25
33 lab_l_median
34 lab_l_p75
35 lab_a_mean   # red-green emphasis
36 lab_a_std
37 lab_a_p25
38 lab_a_median
39 lab_a_p75
40 lab_b_mean
41 lab_b_std
42 lab_b_p25
43 lab_b_median
44 lab_b_p75
45 red_chromaticity_mean
46 r_minus_g_mean
47 r_minus_b_mean
48 excess_red_mean
```

All values `finite`, `float`, deterministic for identical input (tested via repeated extraction equality). No randomness.

---

## 6. Image References & Storage / API Contract

**Output JSON (success):**
```json
{
  "success": true,
  "feature_vector": [49 floats],
  "feature_names": [49 strings ordered as above],
  "roi": {"x":0,"y":0,"width":0,"height":0,"pixel_count":0},
  "original_image_reference": "backend/storage/eyelid_features/<uuid>/eyelid_original.jpg",
  "roi_marked_image_reference": "backend/storage/eyelid_features/<uuid>/eyelid_roi_marked.jpg",
  "nailbed_original_reference": null,   // passthrough teammate
  "nailbed_roi_reference": null,        // passthrough teammate
  "meta": {"entropy": 7.18, "tri_thresh": 117.0, "normalization": "LAB_CLAHE_L_clip2.0_tile8x8", "roi_fraction": 0.09}
}
```

**Failure:**
```json
{"success": false, "error":"INVALID_ROI", "reason":"No mucosa contour found (macro path)", "roi": null, "feature_vector": [], "feature_names": [49 names]}
```

**Endpoint:**
`POST /api/screen/extract-eyelid-features`  
- Form: `image` (File), optional `nailbed_original_reference`, `nailbed_roi_reference` (Form strings, echoed).  
- `GET /api/screen/report-image-refs/{screening_id}` — minimal plumbing returns stored refs and structure array `["Original Eyelid Image","ROI-Marked Eyelid Image","Original Nail-Bed Image","ROI-Marked Nail-Bed Image"]`.

**Image generation:**
- Original preserved unchanged (`marked = original.copy()` then overlay only on `mask>0`; original file saved via `cv2.imwrite` with `JPEG_QUALITY 95`).
- ROI-marked: translucent red `overlay[mask>0]=(0,0,255)` blended `addWeighted(overlay,0.35, original,0.65)` + yellow contour `drawContours(..., (0,255,255),2)` + white bbox `rectangle(..., (255,255,255),1)`. Clearly shows conjunctiva.

**Report display structure (future report, minimal plumbing already implemented):**
```
Original Eyelid Image
        ↓  (ArrowDown)
ROI-Marked Eyelid Image

Original Nail-Bed Image        ← existing Supabase url
        ↓
ROI-Marked Nail-Bed Image      ← teammate passthrough (echoed)
```
In code: `TopMetricsGrid` and `ImagePreviewModal` now accept `eyelidRoiMarkedUrl` / `nailbedRoiMarkedUrl`; when provided they render 2-column × 2-row vertical stacks with `ArrowDown` icons; when absent they fallback to original 2-image grid (backward compatible). No redesign of report layout, only additive conditional rendering.

**Nail-bed handling:** No nail processing implemented. Endpoint simply echoes `nailbed_original_reference` and `nailbed_roi_reference` without modification; frontend plumbing preserves them for report to render below originals. Teammate's nail module will populate `nailbed_roi_reference`.

---

## 7. Test Results (with ROI logging)

All tests run via `pytest backend/tests/test_eyelid_features.py -v -s` — each logs ROI coords/pixel count and every feature.

**Summary: 8 passed, 0 failed** (plus validation suite 8 passed).

| Test | Result | Key log |
|------|--------|---------|
| `test_successful_extraction` (good1.jpg) | PASS | ROI 458,686,622,272 pc=95903 frac 0.0927; 49 finite features logged; original and marked files exist, differ, original mean diff 0.56 <5.0 |
| `test_invalid_roi` (uniform gray, tiny 20x20, corrupt bytes, random noise) | PASS | All 4 return `success false`, `vector []`, `roi null`, never fabricated. Uniform: `No mucosa contour found` |
| `test_deterministic_repeated_extraction` | PASS | Two consecutive calls on same good1 bytes produce identical `roi` and `feature_vector` (equality asserted) |
| `test_finite_fixed_length` | PASS | `len(vector)==49==len(FEATURE_NAMES)`, all `isfinite` and `float` |
| `test_feature_name_vector_alignment` | PASS | `names == FEATURE_NAMES`, `lab_a_mean` in [0,255], order `r_mean→b_p75 → h_mean→v_p75 → lab_l_mean→lab_b_p75 → red_chromaticity→excess_red` |
| `test_original_image_preservation` | PASS | Saved original dims match input `h,w`; mean abs diff 0.56; marked exists and mean diff from original >1.0 |
| `test_roi_marked_image_generation` | PASS | Marked file exists, crop within bbox has `red>150` pixels >10 (outline present) |
| `test_endpoint_via_fastapi` | PASS | `POST /api/screen/extract-eyelid-features` with `image` + passthrough nail refs returns 200, `success true`, 49 vector, `feature_names` match, `nailbed_*` echoed correctly; image refs under `backend/storage/eyelid_features/<uuid>/` |
| `test_validation` suite (8) | PASS | Good images still pass validation; blurry, no-conjunctiva, poorly framed still fail |

**Logged example (good1):**
```
[ROI] x=458 y=686 width=622 height=272 pixel_count=95903
  original_image_reference: .../eyelid_original.jpg
  roi_marked_image_reference: .../eyelid_roi_marked.jpg
  meta: {'entropy': 7.17, 'tri_thresh': 117.0, 'normalization': 'LAB_CLAHE_L_clip2.0_tile8x8', 'roi_fraction': 0.092}
    r_mean = 164.2147
    r_std = 33.8856
    ...
    lab_a_mean = 143.3414  # red-green emphasis
    lab_a_median = 141.0
    ...
    red_chromaticity_mean = 0.4328
    r_minus_g_mean = 42.6854
    r_minus_b_mean = 51.8988
    excess_red_mean = 94.5842
```

Build: `next build` — ✓ Compiled successfully (Turbopack), no new type errors. `npm run lint` — same 1 pre-existing error (SidebarContext), no new errors from Phase 2.

---

## 8. Explicit Confirmations (Phase 2 constraints)

- **NO Hb prediction** — No regression, no `hb_estimate`.
- **NO anemia classification** — No threshold, no `anemia_probability`.
- **NO Random Forest / XGBoost** — No tree models, no `sklearn`.
- **NO LLM** — No `google-genai` calls, no chat/report generation.
- **NO nail-bed implementation** — Nail images are only passthrough strings; no nail ROI extraction, no nail feature computation.
- **NO verification changes** — `backend/routers/screen.py` untouched; `backend/config.py` untouched; verification tests still pass.
- **NO report redesign** — Report header, metrics, insights, trends untouched; only `TopMetricsGrid`/`ImagePreviewModal` gained optional additive props with conditional rendering for the required 4-image structure, no layout overhaul.
- **NO new ML dependency** — Only `opencv-python-headless`, `numpy`, existing `mediapipe`, `fastapi` etc.

---

## 9. Integration Notes

- Backend storage is local filesystem (`backend/storage/eyelid_features/<uuid>/`). For production Supabase, upload these two files to `screening-images` bucket under `${userId}/${screeningId}/eyelid_roi_marked.jpg` and store URLs in `screenings` or `reports.result` JSON. Current minimal plumbing returns local paths; `getReportImageRefs` demonstrates structure.
- Frontend after validation: call `extractEyelidFeatures(file, {nailbed_original_reference, nailbed_roi_reference})`, then upload both `original` and `roi_marked` via `createScreeningWithImages` extension or store refs in `reports.result`.
- All feature extraction is deterministic; for ML Phase 3, consume `feature_vector` ordered by `FEATURE_NAMES` (49-dim).

