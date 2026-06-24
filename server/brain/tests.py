from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from spatial_db.models import RIMRaster, TruthOverride


class BrainAPITests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='brain_test', password='password')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.rim = RIMRaster.objects.create(
            uploaded_by=self.user,
            file_path='rims/test.tif',
            preview_path='rims/test.png',
            crs='EPSG:21037',
            bbox={"minx": 0, "miny": 0, "maxx": 10, "maxy": 10},
            transform={"a": 1.0, "e": 1.0, "origin_x": 0.0, "origin_y": 10.0},
        )
        TruthOverride.objects.create(
            rim=self.rim,
            target_project='test',
            geometry={"type": "Point", "coordinates": [2, 2]},
            attributes={"parcel_id": "123", "confidence": 0.8},
            immutable=True,
            created_by=self.user,
        )

    def test_strategy_endpoint_requires_rim_id(self):
        response = self.client.get('/api/brain/strategy/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('error'), 'rim_id query parameter is required.')

    def test_strategy_endpoint_returns_policy(self):
        response = self.client.get(f'/api/brain/strategy/?rim_id={self.rim.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('policy'), 'truth_override_priority')
        self.assertEqual(len(response.data.get('neighbors', [])), 1)
