import json

try:
    from django.contrib.gis.geos import GEOSException
except Exception:
    GEOSException = Exception

from rest_framework import serializers

from .models import RIMRaster, RIMExtractedFeature, TruthOverride
from .utils import parse_geometry


def _serialize_geometry(value):
    if value is None:
        return None
    try:
        return json.loads(value.geojson)
    except (AttributeError, GEOSException, ValueError):
        return None


def _deserialize_geometry(raw):
    if raw is None:
        return None
    geom = parse_geometry(raw)
    if geom is None:
        raise serializers.ValidationError('Invalid geometry payload.')
    return geom


class RIMExtractedFeatureSerializer(serializers.ModelSerializer):
    geometry_spatial = serializers.ReadOnlyField()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        geom = getattr(instance, 'geometry_spatial', None)
        if geom is not None:
            try:
                data['geometry_spatial'] = json.loads(geom.geojson)
            except (AttributeError, GEOSException, ValueError):
                data['geometry_spatial'] = None
        else:
            data['geometry_spatial'] = None
        return data

    def to_internal_value(self, data):
        if isinstance(data, dict) and 'geometry_spatial' in data:
            raw = data.pop('geometry_spatial')
            geom = _deserialize_geometry(raw)
            if geom is None and raw is not None:
                raise serializers.ValidationError({'geometry_spatial': 'Invalid geometry payload.'})
            internal = super().to_internal_value(data)
            internal['geometry_spatial'] = geom
            return internal
        return super().to_internal_value(data)
    class Meta:
        model = RIMExtractedFeature
        fields = '__all__'


class TruthOverrideSerializer(serializers.ModelSerializer):
    geometry_spatial = serializers.ReadOnlyField()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        geom = getattr(instance, 'geometry_spatial', None)
        if geom is not None:
            try:
                data['geometry_spatial'] = json.loads(geom.geojson)
            except (AttributeError, GEOSException, ValueError):
                data['geometry_spatial'] = None
        else:
            data['geometry_spatial'] = None
        return data

    def to_internal_value(self, data):
        if isinstance(data, dict) and 'geometry_spatial' in data:
            raw = data.pop('geometry_spatial')
            geom = _deserialize_geometry(raw)
            if geom is None and raw is not None:
                raise serializers.ValidationError({'geometry_spatial': 'Invalid geometry payload.'})
            internal = super().to_internal_value(data)
            internal['geometry_spatial'] = geom
            return internal
        return super().to_internal_value(data)
    class Meta:
        model = TruthOverride
        fields = '__all__'


class RIMRasterSerializer(serializers.ModelSerializer):
    footprint = serializers.ReadOnlyField()
    features = RIMExtractedFeatureSerializer(many=True, read_only=True)
    overrides = TruthOverrideSerializer(many=True, read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['footprint'] = _serialize_geometry(getattr(instance, 'footprint', None))
        return data

    def to_internal_value(self, data):
        if isinstance(data, dict) and 'footprint' in data:
            raw = data.pop('footprint')
            geom = _deserialize_geometry(raw)
            internal = super().to_internal_value(data)
            internal['footprint'] = geom
            return internal
        return super().to_internal_value(data)

    class Meta:
        model = RIMRaster
        fields = '__all__'
