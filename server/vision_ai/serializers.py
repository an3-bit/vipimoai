from rest_framework import serializers


class RIMCreateSerializer(serializers.Serializer):
    """Create a minimal RIM metadata record.

    Request body (application/json):
      - name: optional human-readable name
      - project_id: optional project identifier
      - crs: optional CRS name (default EPSG:21037)
      - bbox: optional JSON bbox {minx,miny,maxx,maxy}
      - metadata: optional JSON object with arbitrary metadata
    """

    name = serializers.CharField(required=False, allow_blank=True)
    project_id = serializers.CharField(required=False, allow_blank=True)
    crs = serializers.CharField(required=False, default='EPSG:21037')
    bbox = serializers.JSONField(required=False, allow_null=True)
    metadata = serializers.JSONField(required=False, allow_null=True)


class RIMUploadSerializer(serializers.Serializer):
    """Serializer for multipart uploads to a RIM record.

    Expected multipart/form-data fields:
      - file: image file (required)
      - tie_points: optional JSON array of tie points
          [{"image_x":...,"image_y":...,"lon":...,"lat":...}, ...]
    """

    file = serializers.FileField(required=True)
    tie_points = serializers.JSONField(required=False, allow_null=True)


class VisionIngestSerializer(serializers.Serializer):
    """Trigger ingest/processing for a RIM.

    Accepts either `rim_id` (to use an already-uploaded file) or
    an inline `image_path`/`file_path` (server-side path). Also accepts
    `polygon` (array of lat/lng objects) describing the target georeference
    polygon for alignment. `options` is a free-form dict for future flags.
    """

    rim_id = serializers.IntegerField(required=False)
    image_path = serializers.CharField(required=False)
    polygon = serializers.JSONField(required=False, allow_null=True)
    crs = serializers.CharField(required=False, default='EPSG:21037')
    options = serializers.JSONField(required=False, allow_null=True)

    def validate(self, data):
        if not data.get('rim_id') and not data.get('image_path'):
            raise serializers.ValidationError('Either rim_id or image_path is required.')
        return data
