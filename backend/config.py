"""
HemoLens Backend — Validation Thresholds & Constants
=====================================================
All tunable parameters for image quality validation live here.
Adjust these values to calibrate sensitivity without modifying endpoint logic.
"""

# ===========================================================================
# SHARED IMAGE QUALITY THRESHOLDS
# ===========================================================================

# Resolution
MIN_WIDTH: int = 400    # minimum acceptable image width in pixels
MIN_HEIGHT: int = 300   # minimum acceptable image height in pixels

# Blur detection (standardized scale, max dimension 1024px)
BLUR_THRESHOLD: float = 25.0       # Eyelid Laplacian blur threshold
BLUR_NORM_MAX_DIM: int = 1024
NAIL_BLUR_THRESHOLD: float = 350.0 # Nail-bed skin-edge Tenengrad threshold

# Brightness / exposure (mean grayscale pixel value, 0–255)
MIN_BRIGHTNESS: int = 30    # below → image is too dark
MAX_BRIGHTNESS: int = 235   # above → image is overexposed


# ===========================================================================
# EYELID IMAGE VALIDATION THRESHOLDS
# ===========================================================================

# MediaPipe Face Mesh configuration
FACE_MESH_MAX_FACES: int = 1
FACE_MESH_REFINE_LANDMARKS: bool = True   # enables 478-point model with iris
FACE_MESH_MIN_DETECTION_CONFIDENCE: float = 0.25
FACE_MESH_MIN_TRACKING_CONFIDENCE: float = 0.25

# Eye landmark indices (MediaPipe 478-point Face Mesh)
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

# Face Framing & Eye Region Size (when full/partial face is detected)
MIN_FACE_EYE_WIDTH_PX: int = 300
MIN_FACE_EYE_FRACTION: float = 0.30

# Eye openness — Eye Aspect Ratio (EAR)
MIN_EYE_ASPECT_RATIO: float = 0.06

# Lower-eyelid visibility — vertical spread of lower eyelid landmarks
MIN_LOWER_EYELID_VERTICAL_FRACTION: float = 0.008

# Macro / Close-Up Eye & Palpebral Conjunctiva Detection
MIN_MACRO_SCLERA_PX: int = 25000
MIN_MACRO_SCLERA_FRACTION: float = 0.08
MIN_MACRO_CONJUNCTIVA_FRACTION: float = 0.015


# ===========================================================================
# NAIL-BED IMAGE VALIDATION THRESHOLDS
# ===========================================================================
# Must have AT LEAST 3 clearly visible fingernails sufficiently large for ROI analysis.

NAIL_MIN_COUNT: int = 3                # At least 3 visible fingernails required
NAIL_MAX_COUNT: int = 10               # Maximum candidate limit for sanity check

# Minimum individual fingernail area
NAIL_MIN_CONTOUR_AREA_PX: int = 2500   # Minimum area in px² for a single nail
NAIL_MIN_CONTOUR_AREA_FRACTION: float = 0.009 # At least 0.9% of frame per nail
NAIL_MAX_CONTOUR_AREA_FRACTION: float = 0.20  # At most 20% of frame per nail

# Shape filtering
NAIL_MIN_ASPECT_RATIO: float = 0.25
NAIL_MAX_ASPECT_RATIO: float = 3.50
NAIL_MIN_SOLIDITY: float = 0.40
