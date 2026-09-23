"""
HemoLens — Automated Validation Test Suite
==========================================
Tests the image quality validation pipeline against:
1. Real local dataset images (good, blurry, poorly framed, no conjunctiva)
2. Synthetic edge cases (low resolution, extreme brightness, corrupt images)

Can be executed with pytest or standalone:
    pytest backend/tests/test_validation.py -v
    python backend/tests/test_validation.py
"""

from __future__ import annotations

import os
import unittest
from pathlib import Path
from typing import Any

import cv2
import numpy as np

# Flexible imports
try:
    from backend import config
    from backend.routers.screen import (
        _check_resolution,
        _check_blur,
        _check_brightness,
        _check_eye_and_eyelid,
        _decode_image,
    )
except ModuleNotFoundError:
    import config
    from routers.screen import (
        _check_resolution,
        _check_blur,
        _check_brightness,
        _check_eye_and_eyelid,
        _decode_image,
    )

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
TEST_IMAGES_DIR = PROJECT_ROOT / "public" / "assets" / "test-images"


def validate_local_image(image_path: Path | str) -> dict[str, Any]:
    """Runs the full validation pipeline directly on a local file."""
    with open(image_path, "rb") as f:
        raw_bytes = f.read()

    img_bgr = _decode_image(raw_bytes)
    if img_bgr is None:
        return {
            "valid": False,
            "errors": ["DECODE_FAILED"],
            "checks": {"resolution": False, "blur": False, "brightness": False, "eye_detection": False, "eyelid_visibility": False},
            "metrics": {},
        }

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    errors = []
    checks = {}
    metrics = {}

    # 1. Resolution
    res_ok, res_meta = _check_resolution(img_bgr)
    checks["resolution"] = res_ok
    metrics.update(res_meta)
    if not res_ok:
        errors.append("RESOLUTION_TOO_LOW")

    # 2. Blur
    blur_ok, blur_meta = _check_blur(gray)
    checks["blur"] = blur_ok
    metrics.update(blur_meta)
    if not blur_ok:
        errors.append("IMAGE_TOO_BLURRY")

    # 3. Brightness
    bright_ok, bright_meta = _check_brightness(gray)
    checks["brightness"] = bright_ok
    metrics.update(bright_meta)
    if not bright_ok:
        errors.append("IMAGE_OVEREXPOSED" if bright_meta["overexposed"] else "IMAGE_TOO_DARK")

    # 4 & 5. Eye Detection & Lower Eyelid Visibility
    eye_ok, eyelid_ok, eye_meta = _check_eye_and_eyelid(img_rgb)
    checks["eye_detection"] = eye_ok
    checks["eyelid_visibility"] = eyelid_ok
    metrics.update(eye_meta)

    if not eye_ok:
        err_code = eye_meta.get("framing_error", "EYE_NOT_DETECTED")
        errors.append(err_code)
    elif not eyelid_ok:
        errors.append("EYELID_NOT_VISIBLE")

    valid = len(errors) == 0
    return {
        "valid": valid,
        "errors": errors,
        "checks": checks,
        "metrics": metrics,
    }


class TestDatasetValidation(unittest.TestCase):
    """Tests against real sample images in public/assets/test-images."""

    def test_good_images_pass(self):
        good_samples = ["good1.jpg", "good2.jpeg", "good3.png", "good4.png"]
        for filename in good_samples:
            path = TEST_IMAGES_DIR / filename
            if not path.exists():
                continue
            with self.subTest(image=filename):
                result = validate_local_image(path)
                self.assertTrue(
                    result["valid"],
                    f"{filename} should PASS validation, but failed with errors: {result['errors']}. Metrics: {result['metrics']}",
                )

    def test_blurry_images_fail_blur_check(self):
        blurry_samples = ["blurry.png", "blurry2.png"]
        for filename in blurry_samples:
            path = TEST_IMAGES_DIR / filename
            if not path.exists():
                continue
            with self.subTest(image=filename):
                result = validate_local_image(path)
                self.assertFalse(result["valid"], f"{filename} should fail validation")
                self.assertIn(
                    "IMAGE_TOO_BLURRY",
                    result["errors"],
                    f"{filename} should contain IMAGE_TOO_BLURRY error. Errors: {result['errors']}",
                )

    def test_poorly_framed_images_fail(self):
        zoomed_out = ["eyelid-area-not-big-enough.png", "eyelid-area-not-big-enough2.png"]
        for filename in zoomed_out:
            path = TEST_IMAGES_DIR / filename
            if not path.exists():
                continue
            with self.subTest(image=filename):
                result = validate_local_image(path)
                self.assertFalse(result["valid"], f"{filename} should fail validation")
                self.assertIn(
                    "EYELID_AREA_NOT_BIG_ENOUGH",
                    result["errors"],
                    f"{filename} should fail framing check. Errors: {result['errors']}",
                )

    def test_no_conjunctiva_images_fail(self):
        no_conj = ["no-conjuctiva.jpg", "no-conjuctiva.png"]
        for filename in no_conj:
            path = TEST_IMAGES_DIR / filename
            if not path.exists():
                continue
            with self.subTest(image=filename):
                result = validate_local_image(path)
                self.assertFalse(result["valid"], f"{filename} should fail validation")
                has_eye_or_eyelid_err = any(e in ["EYE_NOT_DETECTED", "EYELID_NOT_VISIBLE"] for e in result["errors"])
                self.assertTrue(
                    has_eye_or_eyelid_err,
                    f"{filename} should fail eye/eyelid check. Errors: {result['errors']}",
                )


class TestSyntheticEdgeCases(unittest.TestCase):
    """Automated tests for resolution, extreme exposure, and corrupt payloads."""

    def test_malformed_image_bytes(self):
        result = _decode_image(b"not an image file data")
        self.assertIsNone(result)

    def test_low_resolution_failure(self):
        tiny = np.zeros((150, 150, 3), dtype=np.uint8)
        passed, meta = _check_resolution(tiny)
        self.assertFalse(passed)
        self.assertEqual(meta["width"], 150)
        self.assertEqual(meta["height"], 150)

    def test_dark_image_failure(self):
        dark_gray = np.full((500, 500), 10, dtype=np.uint8)
        passed, meta = _check_brightness(dark_gray)
        self.assertFalse(passed)
        self.assertTrue(meta["too_dark"])

    def test_overexposed_image_failure(self):
        bright_gray = np.full((500, 500), 245, dtype=np.uint8)
        passed, meta = _check_brightness(bright_gray)
        self.assertFalse(passed)
        self.assertTrue(meta["overexposed"])


def print_test_report():
    """CLI Reporter for all test dataset images."""
    if not TEST_IMAGES_DIR.exists():
        print(f"Test directory not found at {TEST_IMAGES_DIR}")
        return

    print("\n" + "=" * 115)
    print(" HEMOLENS VALIDATION CALIBRATION & BENCHMARK REPORT")
    print("=" * 115)
    print(f"{'Filename':32s} | {'Status':8s} | {'Failed Check(s)':34s} | Relevant Metrics")
    print("-" * 115)

    files = sorted(os.listdir(TEST_IMAGES_DIR))
    for f in files:
        p = TEST_IMAGES_DIR / f
        if not p.is_file():
            continue
        res = validate_local_image(p)
        status_str = "VALID" if res["valid"] else "INVALID"
        err_str = ", ".join(res["errors"]) if res["errors"] else "None (Passed)"

        # Format key metrics
        m = res["metrics"]
        metric_parts = []
        if "laplacian_variance" in m:
            metric_parts.append(f"LapVar: {m['laplacian_variance']}")
        if "mean_brightness" in m:
            metric_parts.append(f"Bright: {m['mean_brightness']}")
        if m.get("face_detected"):
            metric_parts.append(f"EyeW: {m.get('eye_width_px')}px ({m.get('eye_region_fraction')})")
        elif "sclera_frac" in m:
            metric_parts.append(f"Sclera: {m.get('sclera_frac')} ({m.get('sclera_px')}px), Mucosa: {m.get('mucosa_frac')}")

        metric_str = ", ".join(metric_parts)
        print(f"{f:32s} | {status_str:8s} | {err_str:34s} | {metric_str}")

    print("=" * 115 + "\n")


if __name__ == "__main__":
    print_test_report()
    unittest.main()
