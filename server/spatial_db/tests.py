from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from .models import RIMRaster, RIMExtractedFeature, TruthOverride


class SpatialDBAPITests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='spatial_test', password='password')
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
        self.feature = RIMExtractedFeature.objects.create(
            rim=self.rim,
            feature_type='parcel',
            value='parcel-1',
            geometry={"type": "Point", "coordinates": [1, 1]},
            confidence=0.9,
        )
        self.override = TruthOverride.objects.create(
            rim=self.rim,
            target_project='test',
            geometry={"type": "Point", "coordinates": [2, 2]},
            attributes={"name": "override"},
            immutable=True,
            created_by=self.user,
        )

    def test_list_rims(self):
        response = self.client.get('/api/spatial-db/rims/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.rim.id)

    def test_list_features(self):
        response = self.client.get('/api/spatial-db/features/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.feature.id)

    def test_list_overrides(self):
        response = self.client.get('/api/spatial-db/overrides/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.override.id)

    def test_spatial_field_serialization(self):
        response = self.client.get(f'/api/spatial-db/features/{self.feature.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('geometry_spatial', response.data)
        self.assertIsNone(response.data['geometry_spatial'])

        response = self.client.get(f'/api/spatial-db/overrides/{self.override.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('geometry_spatial', response.data)
        self.assertIsNone(response.data['geometry_spatial'])

    def test_create_feature_with_geometry_spatial(self):
        payload = {
            'rim': self.rim.id,
            'feature_type': 'parcel',
            'value': 'new-parcel',
            'geometry_spatial': {"type": "Polygon", "coordinates": [[[0,0],[1,0],[1,1],[0,1],[0,0]]]},
            'confidence': 0.5,
        }
        response = self.client.post('/api/spatial-db/features/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('geometry_spatial', response.data)
        self.assertIsNotNone(response.data['geometry_spatial'])

        # Ensure stored spatial field is queryable
        feature_id = response.data['id']
        get_resp = self.client.get(f'/api/spatial-db/features/{feature_id}/')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(get_resp.data['geometry_spatial'])

    def test_create_rim_with_footprint(self):
        payload = {
            'file_path': 'rims/new.tif',
            'crs': 'EPSG:21037',
            'footprint': {"type": "Polygon", "coordinates": [[[0,0],[2,0],[2,2],[0,2],[0,0]]]},
        }
        response = self.client.post('/api/spatial-db/rims/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('footprint', response.data)
        self.assertIsNotNone(response.data['footprint'])

        rim_id = response.data['id']
        get_resp = self.client.get(f'/api/spatial-db/rims/{rim_id}/')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(get_resp.data['footprint'])
