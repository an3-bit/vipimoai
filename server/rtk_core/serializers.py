from rest_framework import serializers


class CoordinateSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class CoordinateIngestSerializer(serializers.Serializer):
    """
    Accepts raw WGS84 coordinates, projects to Arc 1960 (SRID 21037),
    and calculates authoritative area in hectares.
    """
    coordinates = serializers.ListField(
        child=CoordinateSerializer(),
        min_length=3,
        help_text="Array of {lat, lng} points in WGS84"
    )
    crs_input = serializers.CharField(
        required=False,
        default='EPSG:4326',
        help_text="Input CRS (default: WGS84)"
    )
    crs_output = serializers.CharField(
        required=False,
        default='EPSG:21037',
        help_text="Output CRS (default: Arc 1960 Zone 37S)"
    )

    def validate_coordinates(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Coordinates must be a list of points.')
        if len(value) < 3:
            raise serializers.ValidationError('At least 3 coordinates are required.')
        for point in value:
            if not isinstance(point, dict):
                raise serializers.ValidationError('Each coordinate must be an object with lat and lng.')
            if 'lat' not in point or 'lng' not in point:
                raise serializers.ValidationError('Each coordinate must include lat and lng.')
            try:
                float(point['lat'])
                float(point['lng'])
            except (TypeError, ValueError):
                raise serializers.ValidationError('lat and lng must be numeric.')
        return value


class RTKPolygonSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True)
    coordinates = serializers.JSONField()
    crs_name = serializers.CharField(required=False, default='EPSG:21037')
    rim_image = serializers.FileField(required=False, allow_null=True)

    def validate_coordinates(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Coordinates must be a list of points.')
        if len(value) < 3:
            raise serializers.ValidationError('At least 3 coordinates are required.')
        for point in value:
            if not isinstance(point, dict):
                raise serializers.ValidationError('Each coordinate must be an object with lat and lng.')
            if 'lat' not in point or 'lng' not in point:
                raise serializers.ValidationError('Each coordinate must include lat and lng.')
            try:
                float(point['lat'])
                float(point['lng'])
            except (TypeError, ValueError):
                raise serializers.ValidationError('lat and lng must be numeric.')
        return value

    def validate_crs_name(self, value):
        return value.strip()
