import json
from django.contrib.gis.geos import GEOSGeometry, Polygon, GEOSException


def bbox_to_polygon(bbox):
    """Convert a bbox dict to a Polygon geometry."""
    if not isinstance(bbox, dict):
        return None

    required = {'minx', 'miny', 'maxx', 'maxy'}
    if not required.issubset(bbox.keys()):
        return None

    try:
        minx = float(bbox['minx'])
        miny = float(bbox['miny'])
        maxx = float(bbox['maxx'])
        maxy = float(bbox['maxy'])
    except (TypeError, ValueError):
        return None

    polygon = Polygon(
        (
            (minx, miny),
            (maxx, miny),
            (maxx, maxy),
            (minx, maxy),
            (minx, miny),
        )
    )
    polygon.srid = 21037
    return polygon


def parse_geometry(value):
    """Parse JSON or bbox payloads into a GEOS geometry."""
    if value is None:
        return None

    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return None

    if isinstance(value, dict) and 'type' in value:
        try:
            geom = GEOSGeometry(json.dumps(value))
            geom.srid = 21037
            return geom
        except (ValueError, GEOSException):
            return None

    if isinstance(value, (list, tuple)) and len(value) == 4:
        try:
            x, y, w, h = [float(v) for v in value]
        except (TypeError, ValueError):
            return None
        polygon = Polygon(
            (
                (x, y),
                (x + w, y),
                (x + w, y + h),
                (x, y + h),
                (x, y),
            )
        )
        polygon.srid = 21037
        return polygon

    return None
