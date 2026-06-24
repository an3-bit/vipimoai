# GeoDjango / PostGIS Migration Plan for `spatial_db`

This plan describes the steps to migrate the existing `spatial_db` app from JSON geometry storage to native PostGIS spatial columns.

## Goals

- Keep the current application functional during migration.
- Introduce GeoDjango spatial fields for raster footprints and extracted geometry.
- Preserve existing JSON payloads until the new spatial fields are stable.
- Add tests and data migrations for geometry conversion.

## Current schema

- `RIMRaster`
  - `bbox = JSONField`
  - `transform = JSONField`
- `RIMExtractedFeature`
  - `geometry = JSONField`
- `TruthOverride`
  - `geometry = JSONField`

## Target schema

- `RIMRaster`
  - `footprint = PolygonField(srid=21037, null=True, blank=True)`
  - `transform = JSONField` (keep for now)
  - `bbox = JSONField` (keep for now)
- `RIMExtractedFeature`
  - `geometry = GeometryField(srid=21037, null=True, blank=True)`
  - `raw_geometry = JSONField(null=True, blank=True)`
- `TruthOverride`
  - `geometry = GeometryField(srid=21037, null=True, blank=True)`
  - `raw_geometry = JSONField(null=True, blank=True)`

## Migration steps

1. Confirm the PostGIS Docker stack is running.
   - `docker-compose -f ../docker-compose.dev.yml up --build`

2. Ensure `DB_ENGINE=postgis` and `DATABASE_URL` are set.

3. Update `server/vipimoai_backend/settings.py` to include `django.contrib.gis` during PostGIS mode. (Already implemented.)

4. Add `django.contrib.gis` imports and new geometry fields in `server/spatial_db/models.py`.

5. Create a new migration:
   - `python manage.py makemigrations spatial_db`

6. Add a custom data migration to populate the new spatial fields from JSON payloads.
   - Use `GEOSGeometry` and `Point`, `Polygon` conversions.
   - If the JSON is a GeoJSON `Point`/`Polygon`, convert directly.
   - If user input is a bounding box or other spatial reference, construct the appropriate geometry.

7. Keep old JSON geometry fields as staging fields until the app is fully switched.
   - Example: `raw_geometry` for extracted geometries.
   - Preserve `bbox` and `transform` in `RIMRaster`.

8. Update serializers and views:
   - Expose both the new spatial field and the raw JSON fallback.
   - Support writes to `raw_geometry` and `geometry` from API inputs.

9. Run migrations and tests:
   - `python manage.py migrate`
   - `python manage.py test spatial_db`

10. Remove legacy JSON-only fields once migration is complete.

## Implementation notes

- Use `django.contrib.gis.geos.GEOSGeometry` to parse GeoJSON strings.
- `geom = GEOSGeometry(json.dumps(geojson))` will convert GeoJSON objects into spatial fields.
- PostGIS uses `srid=21037` for local projected coordinates, but preserve the `crs` field on the raster record.

## Rollback strategy

- Keep the old JSON fields until new geometry-backed APIs are validated.
- If migration fails, the original fields remain available for reads/writes.
- Roll back by removing the GeoDjango fields and restoring the previous model state.
