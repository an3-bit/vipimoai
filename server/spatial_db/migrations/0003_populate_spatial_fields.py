from django.db import migrations


def populate_spatial_fields(apps, schema_editor):
    from spatial_db.utils import bbox_to_polygon, parse_geometry

    RIMRaster = apps.get_model('spatial_db', 'RIMRaster')
    RIMExtractedFeature = apps.get_model('spatial_db', 'RIMExtractedFeature')
    TruthOverride = apps.get_model('spatial_db', 'TruthOverride')

    for rim in RIMRaster.objects.all():
        updated = False
        if not rim.footprint and rim.bbox:
            footprint = bbox_to_polygon(rim.bbox)
            if footprint is not None:
                rim.footprint = footprint
                updated = True
        if updated:
            rim.save(update_fields=['footprint'])

    for feature in RIMExtractedFeature.objects.all():
        if not feature.geometry_spatial and feature.geometry is not None:
            geom = parse_geometry(feature.geometry)
            if geom is not None:
                feature.geometry_spatial = geom
                feature.save(update_fields=['geometry_spatial'])

    for override in TruthOverride.objects.all():
        if not override.geometry_spatial and override.geometry is not None:
            geom = parse_geometry(override.geometry)
            if geom is not None:
                override.geometry_spatial = geom
                override.save(update_fields=['geometry_spatial'])


class Migration(migrations.Migration):

    dependencies = [
        ('spatial_db', '0002_rimextractedfeature_geometry_spatial_and_more'),
    ]

    operations = [
        migrations.RunPython(populate_spatial_fields, reverse_code=migrations.RunPython.noop),
    ]
