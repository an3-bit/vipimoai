from __future__ import annotations

import os
import tempfile

import cv2
import numpy as np
from django.contrib.auth import get_user_model
from django.conf import settings
from django.test import TestCase, override_settings
from unittest.mock import patch

from .tasks import _order_points, _georeference_and_extract
from spatial_db.models import RIMRaster, RIMExtractedFeature, TruthOverride


class VisionTasksTests(TestCase):
    def test_order_points_sorts_corners_clockwise(self):
        pts = np.array([
            [0.0, 0.0],
            [10.0, 0.0],
            [10.0, 20.0],
            [0.0, 20.0],
        ], dtype="float32")

        ordered = _order_points(pts)

        self.assertEqual(ordered.shape, (4, 2))
        self.assertTrue(np.allclose(ordered[0], [0.0, 0.0]))
        self.assertTrue(np.allclose(ordered[1], [10.0, 0.0]))
        self.assertTrue(np.allclose(ordered[2], [10.0, 20.0]))
        self.assertTrue(np.allclose(ordered[3], [0.0, 20.0]))

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    @patch("vision.llm.send_image_for_extraction")
    def test_georeference_and_extract_creates_raster_and_features(self, mock_extract):
        mock_extract.return_value = {
            "parcels": [
                {
                    "id": "parcel-1",
                    "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]},
                    "confidence": 0.85,
                }
            ],
            "annotations": [
                {
                    "type": "label",
                    "text": "Road A",
                    "bbox": [10, 20, 30, 40],
                    "confidence": 0.92,
                }
            ],
            "overrides": [
                {
                    "target_project": "test-project",
                    "geometry": {"type": "Point", "coordinates": [0, 0]},
                    "attributes": {"name": "override"},
                    "immutable": False,
                }
            ],
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = os.path.join(tmpdir, "test_rim.jpg")
            image = np.full((120, 120, 3), 255, dtype=np.uint8)
            cv2.rectangle(image, (10, 10), (110, 110), (0, 0, 0), 2)
            cv2.imwrite(image_path, image)

            User = get_user_model()
            user = User.objects.create_user(username="vision_test", password="password")

            polygon_coords = [
                {"lat": -1.2921, "lng": 36.8219},
                {"lat": -1.2921, "lng": 36.8229},
                {"lat": -1.2931, "lng": 36.8229},
                {"lat": -1.2931, "lng": 36.8219},
            ]

            result = _georeference_and_extract(
                image_path=image_path,
                polygon_coords=polygon_coords,
                crs_name="EPSG:21037",
                user_id=user.id,
            )

            self.assertIn("rim_id", result)
            self.assertIn("preview", result)
            self.assertIn("extraction_summary", result)
            self.assertEqual(result["extraction_summary"]["parcels"], 1)
            self.assertEqual(result["extraction_summary"]["annotations"], 1)
            self.assertEqual(len(result["extraction_summary"]["overrides_created"]), 1)

            self.assertTrue(RIMRaster.objects.filter(id=result["rim_id"]).exists())
            self.assertEqual(RIMExtractedFeature.objects.count(), 2)
            self.assertEqual(TruthOverride.objects.count(), 1)

            rim = RIMRaster.objects.get(id=result["rim_id"])
            self.assertEqual(rim.uploaded_by_id, user.id)
            self.assertTrue(
                os.path.exists(os.path.join(settings.MEDIA_ROOT, rim.file_path))
                or os.path.exists(os.path.join(settings.MEDIA_ROOT, rim.preview_path))
            )
