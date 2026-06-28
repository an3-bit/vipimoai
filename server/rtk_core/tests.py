from __future__ import annotations

import io
import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status


class RTKCoreAPITests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username='rtk_test', password='password')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('rtk_core.views.georeference_and_extract.delay')
    def test_ingest_returns_202_and_task_id(self, mock_delay):
        mock_delay.return_value.id = 'test-task-123'

        payload = {
            'coordinates': json.dumps([
                {'lat': -1.2921, 'lng': 36.8219},
                {'lat': -1.2921, 'lng': 36.8229},
                {'lat': -1.2931, 'lng': 36.8229},
                {'lat': -1.2931, 'lng': 36.8219},
            ]),
            'crs_name': 'EPSG:21037',
            'rim_image': SimpleUploadedFile('test.png', io.BytesIO(b'\x89PNG\r\n\x1a\n').getvalue(), content_type='image/png'),
        }

        response = self.client.post('/api/rtk/ingest/', payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data.get('task_id'), 'test-task-123')
        mock_delay.assert_called_once()

    def test_ingest_requires_image(self):
        payload = {
            'coordinates': json.dumps([
                {'lat': -1.2921, 'lng': 36.8219},
                {'lat': -1.2921, 'lng': 36.8229},
                {'lat': -1.2931, 'lng': 36.8229},
                {'lat': -1.2931, 'lng': 36.8219},
            ]),
            'crs_name': 'EPSG:21037',
        }

        response = self.client.post('/api/rtk/ingest/', payload, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('error'), 'rim_image file required')
