from __future__ import annotations
import os
import logging
from celery import shared_task

import cv2
import numpy as np
import pyproj
import rasterio
from rasterio.transform import from_origin

from django.contrib.auth import get_user_model
from django.conf import settings

logger = logging.getLogger(__name__)


def _order_points(pts: np.ndarray) -> np.ndarray:
    # pts: array of shape (4,2)
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # top-left
    rect[2] = pts[np.argmax(s)]  # bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # top-right
    rect[3] = pts[np.argmax(diff)]  # bottom-left
    return rect


def _georeference_and_extract(image_path: str, polygon_coords: list, crs_name: str, user_id: int):
    """Core implementation for georeference and feature extraction."""
    logger.info("Starting georeference job for image=%s user=%s", image_path, user_id)

    if not os.path.exists(image_path):
        logger.error("Image not found: %s", image_path)
        return {'error': 'image_not_found'}

    # Load image
    img = cv2.imread(image_path)
    if img is None:
        logger.error("Failed to read image: %s", image_path)
        return {'error': 'read_failed'}

    h_img, w_img = img.shape[:2]

    # Edge detection and contour find
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blur, 50, 150)
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    sheet_pts = None
    for cnt in contours:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4:
            sheet_pts = approx.reshape(4, 2)
            break

    if sheet_pts is None:
        # fallback to image corners
        sheet_pts = np.array([[0, 0], [w_img - 1, 0], [w_img - 1, h_img - 1], [0, h_img - 1]], dtype="float32")
    else:
        sheet_pts = _order_points(sheet_pts)

    # Compute target bbox in projected CRS
    lats = [float(c['lat']) for c in polygon_coords]
    lngs = [float(c['lng']) for c in polygon_coords]
    minLat, maxLat = min(lats), max(lats)
    minLng, maxLng = min(lngs), max(lngs)

    # Project to target CRS (easting/northing)
    try:
        transformer = pyproj.Transformer.from_crs('epsg:4326', crs_name, always_xy=True)
    except Exception:
        transformer = pyproj.Transformer.from_crs('epsg:4326', 'epsg:21037', always_xy=True)
        crs_name = 'EPSG:21037'

    minx, miny = transformer.transform(minLng, minLat)
    maxx, maxy = transformer.transform(maxLng, maxLat)

    # Ensure min/max ordering
    x0, x1 = min(minx, maxx), max(minx, maxx)
    y0, y1 = min(miny, maxy), max(miny, maxy)
    width_m = x1 - x0
    height_m = y1 - y0
    if width_m <= 0 or height_m <= 0:
        logger.error("Invalid projected bbox size: %s x %s", width_m, height_m)
        return {'error': 'invalid_bbox'}

    # Determine output pixel size (pixels per meter)
    MAX_PIXELS = 2000
    ppm = min(max(1.0, MAX_PIXELS / max(width_m, height_m)), 5.0)
    dst_w = max(64, int(round(width_m * ppm)))
    dst_h = max(64, int(round(height_m * ppm)))

    dst_pts = np.array([[0, 0], [dst_w - 1, 0], [dst_w - 1, dst_h - 1], [0, dst_h - 1]], dtype="float32")

    # Compute homography and warp
    M = cv2.getPerspectiveTransform(np.array(sheet_pts, dtype='float32'), dst_pts)
    warped = cv2.warpPerspective(img, M, (dst_w, dst_h))

    # Prepare storage paths
    basename = os.path.splitext(os.path.basename(image_path))[0]
    preview_rel = f"rims/{basename}_warped.png"
    geotiff_rel = f"rims/{basename}_warped.tif"
    media_root = getattr(settings, 'MEDIA_ROOT', '/app/media')
    os.makedirs(os.path.join(media_root, 'rims'), exist_ok=True)
    preview_path = os.path.join(media_root, preview_rel)
    geotiff_path = os.path.join(media_root, geotiff_rel)

    # Save preview PNG
    try:
        cv2.imwrite(preview_path, warped)
    except Exception:
        # fallback using PIL
        from PIL import Image
        Image.fromarray(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB)).save(preview_path)

    # Save GeoTIFF with rasterio
    xres = width_m / float(dst_w)
    yres = height_m / float(dst_h)
    transform = from_origin(x0, y1, xres, yres)

    try:
        # rasterio expects bands in (count, height, width)
        warped_rgb = cv2.cvtColor(warped, cv2.COLOR_BGR2RGB)
        warped_rgb = np.transpose(warped_rgb, (2, 0, 1))
        with rasterio.open(
            geotiff_path,
            'w',
            driver='GTiff',
            height=dst_h,
            width=dst_w,
            count=3,
            dtype=warped.dtype,
            crs=crs_name,
            transform=transform,
        ) as dst:
            dst.write(warped_rgb)
    except Exception as exc:
        logger.exception('Failed to write GeoTIFF: %s', exc)
        # continue — preview is available

    # Call LLM adapter with warped image bytes
    from .llm import send_image_for_extraction
    _, img_png = cv2.imencode('.png', warped)
    img_bytes = img_png.tobytes()

    try:
        extraction = send_image_for_extraction(img_bytes, crs_name=crs_name)
    except Exception as exc:
        logger.exception('LLM extraction failed: %s', exc)
        extraction = {'error': str(exc)}

    # Persist to spatial_db
    try:
        from spatial_db.models import RIMRaster, RIMExtractedFeature, TruthOverride
        from spatial_db.utils import bbox_to_polygon, parse_geometry
        User = get_user_model()
        user = None
        try:
            user = User.objects.get(id=user_id)
        except Exception:
            user = None

        rim = RIMRaster.objects.create(
            uploaded_by=user,
            file_path=geotiff_rel if os.path.exists(geotiff_path) else preview_rel,
            preview_path=preview_rel,
            crs=crs_name,
            bbox={'minx': x0, 'miny': y0, 'maxx': x1, 'maxy': y1},
            transform={'a': float(xres), 'e': float(yres), 'origin_x': float(x0), 'origin_y': float(y1)},
            footprint=bbox_to_polygon({'minx': x0, 'miny': y0, 'maxx': x1, 'maxy': y1}),
        )

        parcels = extraction.get('parcels') if isinstance(extraction, dict) else None
        if parcels:
            for p in parcels:
                RIMExtractedFeature.objects.create(
                    rim=rim,
                    feature_type='parcel',
                    value=str(p.get('id') or p.get('value') or ''),
                    geometry=p.get('geometry'),
                    geometry_spatial=parse_geometry(p.get('geometry')),
                    confidence=float(p.get('confidence', 1.0)) if p.get('confidence') is not None else 1.0,
                )

        annotations = extraction.get('annotations') if isinstance(extraction, dict) else None
        if annotations:
            for a in annotations:
                RIMExtractedFeature.objects.create(
                    rim=rim,
                    feature_type=a.get('type', 'label'),
                    value=a.get('text'),
                    geometry=a.get('bbox'),
                    geometry_spatial=parse_geometry(a.get('bbox')),
                    confidence=float(a.get('confidence', 1.0)) if a.get('confidence') is not None else 1.0,
                )

        # If LLM returned explicit overrides
        overrides = extraction.get('overrides') if isinstance(extraction, dict) else None
        created_overrides = []
        if overrides:
            for o in overrides:
                to = TruthOverride.objects.create(
                    rim=rim,
                    target_project=o.get('target_project'),
                    geometry=o.get('geometry'),
                    geometry_spatial=parse_geometry(o.get('geometry')),
                    attributes=o.get('attributes', {}),
                    immutable=bool(o.get('immutable', True)),
                    created_by=user,
                )
                created_overrides.append(to.id)
    except Exception as exc:
        logger.exception('Failed to persist spatial_db models: %s', exc)

    result = {
        'rim_id': getattr(rim, 'id', None),
        'preview': preview_rel,
        'geotiff': geotiff_rel if os.path.exists(geotiff_path) else None,
        'extraction_summary': {
            'parcels': len(parcels) if parcels else 0,
            'annotations': len(annotations) if annotations else 0,
            'overrides_created': created_overrides if overrides else [],
        },
        'raw_extraction': extraction,
    }

    logger.info('Georeference job completed: %s', result)
    return result


@shared_task(bind=True)
def georeference_and_extract(self, image_path: str, polygon_coords: list, crs_name: str, user_id: int):
    task_id = None
    try:
        task_id = self.request.id
    except Exception:
        task_id = None

    # Notify websocket listeners (if Channels is available)
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer is not None and task_id is not None:
            async_to_sync(channel_layer.group_send)(
                f"task_{task_id}",
                {
                    'type': 'task.message',
                    'status': 'started',
                    'payload': {'message': 'task started'}
                }
            )
    except Exception:
        # Channels not installed or not reachable — ignore
        pass

    try:
        result = _georeference_and_extract(image_path, polygon_coords, crs_name, user_id)
        # Send completed message
        try:
            if task_id is not None and channel_layer is not None:
                async_to_sync(channel_layer.group_send)(
                    f"task_{task_id}",
                    {
                        'type': 'task.message',
                        'status': 'finished',
                        'payload': {'result': result}
                    }
                )
        except Exception:
            pass
        return result
    except Exception as exc:
        try:
            if task_id is not None and channel_layer is not None:
                async_to_sync(channel_layer.group_send)(
                    f"task_{task_id}",
                    {
                        'type': 'task.message',
                        'status': 'failed',
                        'payload': {'error': str(exc)}
                    }
                )
        except Exception:
            pass
        raise
