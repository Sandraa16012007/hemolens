"""
HemoLens Backend — Validation Thresholds & Constants
=====================================================
All tunable parameters for image quality validation live here.
Adjust these values to calibrate sensitivity without modifying endpoint logic.
"""

# ---------------------------------------------------------------------------
# Resolution
# ---------------------------------------------------------------------------
MIN_WIDTH: int = 400    # minimum acceptable image width in pixels
MIN_HEIGHT: int = 300   # minimum acceptable image height in pixels

# ---------------------------------------------------------------------------
# Blur detection  (variance of Laplacian on normalized 1024px max dimension)
# ---------------------------------------------------------------------------
# Images whose normalized Laplacian variance is *below* this threshold are too blurry.
# Calibrated against real mobile samples (blurry: 1.8–4.3; clear: 64.0–110.0).
BLUR_THRESHOLD: float = 25.0
BLUR_NORM_MAX_DIM: int = 1024

# ---------------------------------------------------------------------------
# Brightness / exposure  (mean grayscale pixel value, 0–255)
# ---------------------------------------------------------------------------
MIN_BRIGHTNESS: int = 30    # below → image is too dark
MAX_BRIGHTNESS: int = 235   # above → image is overexposed

# ---------------------------------------------------------------------------
# MediaPipe Face Mesh configuration
# ---------------------------------------------------------------------------
FACE_MESH_MAX_FACES: int = 1
FACE_MESH_REFINE_LANDMARKS: bool = True   # enables 478-point model with iris
FACE_MESH_MIN_DETECTION_CONFIDENCE: float = 0.25
FACE_MESH_MIN_TRACKING_CONFIDENCE: float = 0.25

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
# Face Framing & Eye Region Size (when full/partial face is detected)
# ---------------------------------------------------------------------------
# Minimum eye width in absolute pixels or fraction of frame.
# Prevents zoomed-out full-face portraits from passing without zooming into the eye.
MIN_FACE_EYE_WIDTH_PX: int = 300
MIN_FACE_EYE_FRACTION: float = 0.30

# ---------------------------------------------------------------------------
# Eye openness — Eye Aspect Ratio (EAR)
# ---------------------------------------------------------------------------
MIN_EYE_ASPECT_RATIO: float = 0.06

# ---------------------------------------------------------------------------
# Lower-eyelid visibility — vertical spread of lower eyelid landmarks
# ---------------------------------------------------------------------------
MIN_LOWER_EYELID_VERTICAL_FRACTION: float = 0.008

# ---------------------------------------------------------------------------
# Macro / Close-Up Eye & Palpebral Conjunctiva Detection
# (Used when image is tightly cropped around the eye and whole face is absent)
# ---------------------------------------------------------------------------
# Sclera (white of eye) minimum absolute pixels or fraction of frame
MIN_MACRO_SCLERA_PX: int = 25000
MIN_MACRO_SCLERA_FRACTION: float = 0.08

# Palpebral conjunctiva (mucosal red/pink vascular bed) minimum frame fraction
MIN_MACRO_CONJUNCTIVA_FRACTION: float = 0.015
