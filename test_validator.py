"""
HemoLens — Validation Runner Script
Run with:
    python test_validator.py
"""

from backend.tests.test_validation import print_test_report
import unittest

if __name__ == "__main__":
    print_test_report()
    loader = unittest.TestLoader()
    suite = loader.discover("backend/tests", pattern="test_*.py")
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite)
