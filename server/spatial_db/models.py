from django.db import models
from django.contrib.auth.models import User

# GeoDjango spatial fields — only available when GDAL is installed.
# Falls back to JSONField so the server starts without GDAL on local/SQLite dev.
try:
    from django.contrib.gis.db import models as gis_models
    _GEODJANGO_AVAILABLE = True
except Exception:
    gis_models = None
    _GEODJANGO_AVAILABLE = False


def _spatial_field(**kwargs):
    """Return a GeoDjango field when GDAL is available, else a JSONField."""
    if _GEODJANGO_AVAILABLE:
        return gis_models.GeometryField(**kwargs)
    return models.JSONField(null=True, blank=True)


def _polygon_field(**kwargs):
    """Return a GeoDjango PolygonField when GDAL is available, else a JSONField."""
    if _GEODJANGO_AVAILABLE:
        return gis_models.PolygonField(**kwargs)
    return models.JSONField(null=True, blank=True)

# NOTE: These models currently use JSON geometry payloads for portability.
# In the next PostGIS migration, replace the legacy JSON geometry fields with
# GeoDjango GeometryField-based spatial columns and keep JSON as a compatibility
# staging field during migration.


class RIMRaster(models.Model):
    """Stores a georeferenced raster produced from a RIM photo."""
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    file_path = models.CharField(max_length=1024)
    preview_path = models.CharField(max_length=1024, null=True, blank=True)
    crs = models.CharField(max_length=50, default='EPSG:21037')
    bbox = models.JSONField(null=True, blank=True)
    transform = models.JSONField(null=True, blank=True)
    footprint = _polygon_field(srid=21037, null=True, blank=True)
    processed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"RIMRaster {self.id} by {self.uploaded_by}"


class RIMExtractedFeature(models.Model):
    """Parsed features (parcels, roads) from a RIM."""
    rim = models.ForeignKey(RIMRaster, on_delete=models.CASCADE, related_name='features')
    feature_type = models.CharField(max_length=50)  # 'parcel', 'road', 'label'
    value = models.CharField(max_length=255, null=True, blank=True)
    geometry = models.JSONField(null=True, blank=True)
    geometry_spatial = _spatial_field(srid=21037, null=True, blank=True)
    confidence = models.FloatField(default=0.0)

    def __str__(self):
        return f"Feature {self.feature_type}:{self.value} ({self.confidence:.2f})"


class TruthOverride(models.Model):
    """Highest-tier ground truth entries that supersede satellite-derived geometry."""
    rim = models.ForeignKey(RIMRaster, on_delete=models.CASCADE, related_name='overrides')
    target_project = models.CharField(max_length=255, null=True, blank=True)
    geometry = models.JSONField()
    geometry_spatial = _spatial_field(srid=21037, null=True, blank=True)
    attributes = models.JSONField(null=True, blank=True)
    immutable = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"TruthOverride {self.id} (immutable={self.immutable})"
