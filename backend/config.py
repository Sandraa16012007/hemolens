"""
HemoLens Backend — Validation Thresholds & Constants
=====================================================
All tunable parameters for image quality validation live here.
Adjust these values to calibrate sensitivity without modifying endpoint logic.
"""

# ---------------------------------------------------------------------------
# Resolution
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Resolution
# ---------------------------------------------------------------------------
MIN_WIDTH: int = 400    # minimum acceptable image width in pixels (relaxed for mobile crops)
MIN_HEIGHT: int = 300   # minimum acceptable image height in pixels

# ---------------------------------------------------------------------------
# Blur detection  (variance of Laplacian)
# ---------------------------------------------------------------------------
# Images whose Laplacian variance is *below* this threshold are too blurry.
# Higher value = stricter. Relaxed from 80.0 to 40.0 for smartphone front cameras.
BLUR_THRESHOLD: float = 40.0

# ---------------------------------------------------------------------------
# Brightness / exposure  (mean grayscale pixel value, 0–255)
# ---------------------------------------------------------------------------
MIN_BRIGHTNESS: int = 30    # below → image is too dark (relaxed from 40)
MAX_BRIGHTNESS: int = 235   # above → image is overexposed (relaxed from 220)

# ---------------------------------------------------------------------------
# MediaPipe Face Mesh configuration
# ---------------------------------------------------------------------------
FACE_MESH_MAX_FACES: int = 1
FACE_MESH_REFINE_LANDMARKS: bool = True   # enables 478-point model with iris
FACE_MESH_MIN_DETECTION_CONFIDENCE: float = 0.3  # relaxed from 0.5 for angled/partial faces
FACE_MESH_MIN_TRACKING_CONFIDENCE: float = 0.3

# ---------------------------------------------------------------------------
# Eye landmark indices (MediaPipe 478-point Face Mesh)
# ---------------------------------------------------------------------------

# Right eye — lower eyelid contour landmarks
RIGHT_EYE_LOWER_INDICES: list[int] = [145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
# Right eye — upper eyelid contour landmarks (for EAR computation)
RIGHT_EYE_UPPER_INDICES: list[int] = [159, 160, 161]
# Right eye — horizontal corner landmarks
RIGHT_EYE_CORNER_INDICES: list[int] = [33, 133]   # outer, inner

# Left eye — lower eyelid contour landmarks
LEFT_EYE_LOWER_INDICES: list[int] = [374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
# Left eye — upper eyelid contour landmarks (for EAR computation)
LEFT_EYE_UPPER_INDICES: list[int] = [386, 387, 388]
# Left eye — horizontal corner landmarks
LEFT_EYE_CORNER_INDICES: list[int] = [263, 362]   # outer, inner

# ---------------------------------------------------------------------------
# Eye openness — Eye Aspect Ratio (EAR)
# Relaxed from 0.15 to 0.06 to account for eyelid eversion / downward pull
# and upward patient gaze during lower-eyelid examination.
# ---------------------------------------------------------------------------
MIN_EYE_ASPECT_RATIO: float = 0.06

# ---------------------------------------------------------------------------
# Eye region size — fraction of image width that the detected eye span must cover.
# Relaxed from 0.08 to 0.03 for high-resolution wide portraits.
# ---------------------------------------------------------------------------
MIN_EYE_REGION_FRACTION: float = 0.03

# ---------------------------------------------------------------------------
# Lower-eyelid visibility — vertical spread of lower eyelid landmarks
# Relaxed from 0.02 to 0.008 for normalized coordinate variations.
# ---------------------------------------------------------------------------
MIN_LOWER_EYELID_VERTICAL_FRACTION: float = 0.008

# ---------------------------------------------------------------------------
# Close-up / Macro Eye Detection (Fallback when full face is not in frame)
# ---------------------------------------------------------------------------
# Minimum fraction of mucosal / pink-red conjunctival color pixels in close-ups
MIN_CLOSEUP_CONJUNCTIVA_FRACTION: float = 0.04
# Minimum fraction of sclera (white) / skin tones in close-ups
MIN_CLOSEUP_SCLERA_FRACTION: float = 0.03

