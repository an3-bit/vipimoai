from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .serializers import RTKPolygonSerializer, CoordinateIngestSerializer
from vision.tasks import georeference_and_extract
import json


class CoordinateIngestView(APIView):
    """
    POST /api/rtk/ingest/
    
    Accepts raw WGS84 coordinates, projects them to Arc 1960 (SRID 21037),
    calculates the exact authoritative area in hectares, and returns both
    the projected coordinates and area to the frontend.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CoordinateIngestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        wgs84_coordinates = data['coordinates']
        crs_input = data.get('crs_input', 'EPSG:4326')
        crs_output = data.get('crs_output', 'EPSG:21037')

        try:
            # Import here to avoid issues if GeoDjango is not available
            from django.contrib.gis.geos import GEOSGeometry, Polygon
            from django.contrib.gis.db.models.functions import Transform
            from django.db import connection
            import pyproj

            # Convert WGS84 coordinates to Arc 1960
            # WGS84: (lat, lng) -> GEOSGeometry expects (lng, lat)
            ring = []
            for coord in wgs84_coordinates:
                ring.append((float(coord['lng']), float(coord['lat'])))
            
            # Close the ring
            if ring[0] != ring[-1]:
                ring.append(ring[0])

            # Create polygon in WGS84
            wgs84_polygon = Polygon(ring)
            wgs84_polygon.srid = 4326

            # Project to Arc 1960 (EPSG:21037)
            # Using pyproj for transformation
            transformer = pyproj.Transformer.from_crs('EPSG:4326', 'EPSG:21037', always_xy=True)
            
            projected_ring = []
            for lng, lat in ring[:-1]:  # Exclude the closing point for now
                x, y = transformer.transform(lng, lat)
                projected_ring.append((x, y))
            
            # Close the ring
            projected_ring.append(projected_ring[0])
            
            # Create projected polygon
            arc1960_polygon = Polygon(projected_ring)
            arc1960_polygon.srid = 21037
            
            # Calculate area in square meters (Arc 1960 is in meters)
            area_sqm = arc1960_polygon.area
            area_ha = area_sqm / 10000.0  # Convert to hectares
            
            # Convert projected coordinates back to {lat, lng} format for response
            projected_coordinates = []
            for x, y in projected_ring[:-1]:  # Exclude closing point
                projected_coordinates.append({
                    'easting': round(x, 4),
                    'northing': round(y, 4)
                })

            return Response({
                'success': True,
                'data': {
                    'wgs84_coordinates': wgs84_coordinates,
                    'projected_coordinates': projected_coordinates,
                    'area': {
                        'square_meters': round(area_sqm, 2),
                        'hectares': round(area_ha, 4),
                        'acres': round(area_ha * 2.471054, 4),
                    },
                    'crs_input': crs_input,
                    'crs_output': crs_output,
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'error': f'Coordinate projection/area calculation failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RTKIngestView(APIView):
    """Accepts RTK polygon (WGS84) and enqueues a vision job."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RTKPolygonSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        # For now, accept uploaded image path or an upload field named `rim_image`
        image = request.FILES.get('rim_image')

        # Persist image to MEDIA and enqueue task
        if image:
            from django.core.files.storage import default_storage
            path = default_storage.save(f"rims/{image.name}", image)
            media_path = default_storage.path(path)
        else:
            return Response({'error': 'rim_image file required'}, status=status.HTTP_400_BAD_REQUEST)

        # Enqueue Celery task (async)
        task = georeference_and_extract.delay(media_path, data['coordinates'], data.get('crs_name', 'EPSG:21037'), request.user.id)

        return Response({'task_id': task.id}, status=status.HTTP_202_ACCEPTED)
