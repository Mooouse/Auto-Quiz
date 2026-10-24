"""Offline tests: a second visible vehicle always disqualifies a source photo."""
import runpy
import unittest
from pathlib import Path

script = runpy.run_path(str(Path(__file__).with_name("approve-photos.py")))
review = script["review"]
overlap = script["overlap"]


class PhotoScreenTests(unittest.TestCase):
    def test_single_confident_car_is_eligible_for_review(self):
        ok, _ = review([{"class": "car", "confidence": 0.94, "bbox": [60, 120, 580, 480]}])
        self.assertTrue(ok)

    def test_second_car_rejected_even_if_distant(self):
        ok, reason = review([
            {"class": "car", "confidence": 0.94, "bbox": [40, 100, 500, 490]},
            {"class": "car", "confidence": 0.31, "bbox": [520, 40, 570, 95]}
        ])
        self.assertFalse(ok)
        self.assertIn("Another vehicle", reason)

    def test_bus_and_motorcycle_also_rejected(self):
        for kind in ("bus", "truck", "motorcycle"):
            ok, _ = review([
                {"class": "car", "confidence": 0.94, "bbox": [40, 100, 500, 490]},
                {"class": kind, "confidence": 0.25, "bbox": [500, 10, 600, 80]}
            ])
            self.assertFalse(ok)

    def test_missing_or_uncertain_car_rejected(self):
        self.assertFalse(review([])[0])
        self.assertFalse(review([{"class": "car", "confidence": 0.24, "bbox": [40, 100, 500, 490]}])[0])

    def test_nms_iou(self):
        self.assertAlmostEqual(overlap([0, 0, 100, 100], [0, 0, 100, 100]), 1)
        self.assertEqual(overlap([0, 0, 30, 30], [80, 80, 100, 100]), 0)


if __name__ == "__main__":
    unittest.main()
