import math
import pyproj

def calculate_distance(coord1, coord2):
    """Haversine formula to calculate the distance between two points in meters."""
    R = 6371000.0  # Earth's radius in meters
    lat1 = math.radians(float(coord1['lat']))
    lat2 = math.radians(float(coord2['lat']))
    delta_lat = math.radians(float(coord2['lat']) - float(coord1['lat']))
    delta_lng = math.radians(float(coord2['lng']) - float(coord1['lng']))

    a = math.sin(delta_lat / 2.0) ** 2 + \
        math.cos(lat1) * math.cos(lat2) * (math.sin(delta_lng / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return R * c

def calculate_polygon_area(coordinates):
    """Calculates spherical polygon area in square meters."""
    if len(coordinates) < 3:
        return 0.0
    R = 6371000.0
    total = 0.0
    
    for i in range(len(coordinates)):
        j = (i + 1) % len(coordinates)
        lat1 = math.radians(float(coordinates[i]['lat']))
        lng1 = math.radians(float(coordinates[i]['lng']))
        lat2 = math.radians(float(coordinates[j]['lat']))
        lng2 = math.radians(float(coordinates[j]['lng']))
        total += (lng2 - lng1) * (2.0 + math.sin(lat1) + math.sin(lat2))
        
    return abs(total * R * R / 2.0)

def get_bounding_box(coordinates):
    lats = [float(c['lat']) for c in coordinates]
    lngs = [float(c['lng']) for c in coordinates]
    return {
        'minLat': min(lats),
        'maxLat': max(lats),
        'minLng': min(lngs),
        'maxLng': max(lngs),
    }

def subdivide_rectangular(coordinates, plot_width, plot_depth, road_setback, side_setback, strategy, target_count=None):
    """
    Subdivide a polygon bounding box into rectangular plots.
    Replicates the algorithm from Supabase Edge Function exactly in Python.
    """
    bbox = get_bounding_box(coordinates)
    parcel_width = calculate_distance(
        {'lat': bbox['minLat'], 'lng': bbox['minLng']},
        {'lat': bbox['minLat'], 'lng': bbox['maxLng']}
    )
    parcel_depth = calculate_distance(
        {'lat': bbox['minLat'], 'lng': bbox['minLng']},
        {'lat': bbox['maxLat'], 'lng': bbox['minLng']}
    )

    effective_width = float(parcel_width) - (2.0 * float(side_setback))
    effective_depth = float(parcel_depth) - float(road_setback)
    parcel_area = calculate_polygon_area(coordinates)

    final_plot_width = float(plot_width)
    final_plot_depth = float(plot_depth)
    suggestions = []

    # Calculate max plots that can fit
    if final_plot_width <= 0 or final_plot_depth <= 0:
        return {'plots': [], 'beacons': [], 'suggestions': [{'type': 'warning', 'message': 'Invalid plot dimensions'}]}
        
    max_plots_per_row = int(effective_width // final_plot_width)
    max_rows = int(effective_depth // final_plot_depth)
    max_total_plots = max_plots_per_row * max_rows

    # Strategy handling
    if strategy == 'fixed_count' and target_count:
        target_count = int(target_count)
        if target_count > max_total_plots:
            suggestions.append({
                'type': 'warning',
                'message': f"Cannot fit {target_count} plots. Maximum possible: {max_total_plots} plots.",
                'suggested_count': max_total_plots,
            })

    if strategy == 'equal_resize' and target_count:
        target_count = int(target_count)
        if target_count > 0:
            plots_per_row = math.ceil(math.sqrt(target_count))
            rows = math.ceil(target_count / plots_per_row)
            if plots_per_row > 0 and rows > 0:
                final_plot_width = effective_width / plots_per_row
                final_plot_depth = effective_depth / rows
                
                suggestions.append({
                    'type': 'resize',
                    'message': f"Plots resized to {final_plot_width:.1f}m x {final_plot_depth:.1f}m to fit {target_count} plots evenly.",
                    'suggested_width': final_plot_width,
                    'suggested_depth': final_plot_depth,
                })

    if max_total_plots == 0 and not (strategy == 'equal_resize' and target_count):
        suggested_width = math.sqrt(parcel_area / 4.0 * (float(plot_width) / float(plot_depth)))
        suggested_depth = suggested_width * (float(plot_depth) / float(plot_width))
        
        suggestions.append({
            'type': 'alternative_layout',
            'message': f"Current plot size ({plot_width}m x {plot_depth}m) is too large. Consider {suggested_width:.1f}m x {suggested_depth:.1f}m for 4 plots.",
            'suggested_width': suggested_width,
            'suggested_depth': suggested_depth,
            'suggested_count': 4,
        })
        return {'plots': [], 'beacons': [], 'suggestions': suggestions}

    plots = []
    beacons = []
    beacon_counter = 1

    plots_per_row = math.ceil(math.sqrt(target_count)) if (strategy == 'equal_resize' and target_count) else max_plots_per_row
    rows = math.ceil(target_count / plots_per_row) if (strategy == 'equal_resize' and target_count) else max_rows

    if parcel_depth > 0 and parcel_width > 0:
        lat_per_meter = (bbox['maxLat'] - bbox['minLat']) / parcel_depth
        lng_per_meter = (bbox['maxLng'] - bbox['minLng']) / parcel_width
    else:
        lat_per_meter = 0
        lng_per_meter = 0

    start_lng = bbox['minLng'] + (float(side_setback) * lng_per_meter)
    start_lat = bbox['minLat'] + (float(road_setback) * lat_per_meter)

    plot_number = 1
    max_plots = min(int(target_count), max_total_plots) if (strategy == 'fixed_count' and target_count) else (plots_per_row * rows)

    for row in range(rows):
        if plot_number > max_plots:
            break
        for col in range(plots_per_row):
            if plot_number > max_plots:
                break
                
            plot_min_lat = start_lat + (row * final_plot_depth * lat_per_meter)
            plot_max_lat = plot_min_lat + (final_plot_depth * lat_per_meter)
            plot_min_lng = start_lng + (col * final_plot_width * lng_per_meter)
            plot_max_lng = plot_min_lng + (final_plot_width * lng_per_meter)

            plot_coordinates = [
                {'lat': plot_min_lat, 'lng': plot_min_lng},
                {'lat': plot_min_lat, 'lng': plot_max_lng},
                {'lat': plot_max_lat, 'lng': plot_max_lng},
                {'lat': plot_max_lat, 'lng': plot_min_lng},
            ]

            plot_area = calculate_polygon_area(plot_coordinates)

            plots.append({
                'plot_number': plot_number,
                'coordinates': plot_coordinates,
                'area_sqm': plot_area,
                'width_m': final_plot_width,
                'depth_m': final_plot_depth,
                'is_partial': False,
            })

            # Add beacons for this plot
            for idx, coord in enumerate(plot_coordinates):
                beacons.append({
                    'beacon_number': beacon_counter,
                    'latitude': coord['lat'],
                    'longitude': coord['lng'],
                    'description': f"Plot {plot_number} - Corner {idx + 1}",
                })
                beacon_counter += 1

            plot_number += 1

    # Check for leftover space
    used_width = plots_per_row * final_plot_width
    used_depth = rows * final_plot_depth
    remainder_width = effective_width - used_width
    remainder_depth = effective_depth - used_depth

    if remainder_width > 5.0 or remainder_depth > 5.0:
        suggestions.append({
            'type': 'extract_full',
            'message': f"{len(plots)} full plots extracted. Remaining space: {remainder_width:.1f}m width, {remainder_depth:.1f}m depth.",
            'suggested_count': len(plots),
        })

    return {'plots': plots, 'beacons': beacons, 'suggestions': suggestions}


# --- PLANAR MATH & SUCCESSION SLIDE LINE SPLITTER ---

def get_transformers(crs_name="EPSG:21037"):
    """
    Resolves transformers for converting between WGS84 and the target UTM Zone.
    Supports Kenya East (Zone 37S, default) and Kenya West (Zone 36S), 
    supporting both Arc 1960 and WGS 84 UTM datum variants.
    """
    crs_name = crs_name.upper().strip()
    
    # Arc 1960 Ellipsoid parameters
    arc1960_ellps = "+a=6378249.145 +rf=293.465 +towgs84=-160,-6,-302,0,0,0,0"
    
    if "36" in crs_name or "21036" in crs_name or "32736" in crs_name:
        # Zone 36S (Western Kenya)
        if "WGS84" in crs_name or "32736" in crs_name:
            crs_spec = "+proj=utm +zone=36 +south +datum=WGS84 +units=m +no_defs"
        else:
            crs_spec = f"+proj=utm +zone=36 +south {arc1960_ellps} +units=m +no_defs"
    else:
        # Zone 37S (Default, Nairobi/Central/Eastern Kenya)
        if "WGS84" in crs_name or "32737" in crs_name:
            crs_spec = "+proj=utm +zone=37 +south +datum=WGS84 +units=m +no_defs"
        else:
            crs_spec = f"+proj=utm +zone=37 +south {arc1960_ellps} +units=m +no_defs"
            
    to_utm = pyproj.Transformer.from_crs("epsg:4326", crs_spec, always_xy=True)
    to_wgs84 = pyproj.Transformer.from_crs(crs_spec, "epsg:4326", always_xy=True)
    return to_utm, to_wgs84

def planar_polygon_area(coords):
    """Calculates flat 2D Cartesian polygon area using the Shoelace formula."""
    n = len(coords)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        x1, y1 = coords[i]
        x2, y2 = coords[j]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0

def planar_centroid(coords):
    """Calculates flat 2D Cartesian centroid of a polygon."""
    n = len(coords)
    if n < 3:
        return (0.0, 0.0)
    cx = 0.0
    cy = 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        x1, y1 = coords[i]
        x2, y2 = coords[j]
        factor = x1 * y2 - x2 * y1
        cx += (x1 + x2) * factor
        cy += (y1 + y2) * factor
        area += factor
    if abs(area) < 1e-9:
        return coords[0]
    area = area / 2.0
    cx = cx / (6.0 * area)
    cy = cy / (6.0 * area)
    return (cx, cy)

def line_intersection(p1, p2, a, b, c):
    """Computes intersection of segment p1-p2 with line ax + by + c = 0."""
    x1, y1 = p1
    x2, y2 = p2
    d1 = a * x1 + b * y1 + c
    d2 = a * x2 + b * y2 + c
    if abs(d1 - d2) < 1e-9:
        return p1
    t = d1 / (d1 - d2)
    x = x1 + t * (x2 - x1)
    y = y1 + t * (y2 - y1)
    return (x, y)

def clip_polygon_halfplane(poly, a, b, c):
    """Clips polygon to half-plane ax + by + c >= 0 (Sutherland-Hodgman)."""
    clipped = []
    if not poly:
        return clipped
    for i in range(len(poly)):
        p1 = poly[i]
        p2 = poly[(i + 1) % len(poly)]
        d1 = a * p1[0] + b * p1[1] + c
        d2 = a * p2[0] + b * p2[1] + c
        p1_inside = d1 >= -1e-9
        p2_inside = d2 >= -1e-9
        if p1_inside and p2_inside:
            clipped.append(p2)
        elif p1_inside and not p2_inside:
            clipped.append(line_intersection(p1, p2, a, b, c))
        elif not p1_inside and p2_inside:
            clipped.append(line_intersection(p1, p2, a, b, c))
            clipped.append(p2)
    return clipped

def get_inward_normal(poly):
    """Computes normal vector of the first edge pointing into the polygon."""
    p1 = poly[0]
    p2 = poly[-1]
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    length = math.sqrt(dx**2 + dy**2)
    if length < 1e-9:
        return (1.0, 0.0)
    ux, uy = dx/length, dy/length
    n1x, n1y = -uy, ux
    
    # Centroid relative to edge midpoint
    cx, cy = planar_centroid(poly)
    mx = (p1[0] + p2[0]) / 2.0
    my = (p1[1] + p2[1]) / 2.0
    rx = cx - mx
    ry = cy - my
    
    if rx * n1x + ry * n1y >= 0:
        return (n1x, n1y)
    else:
        return (uy, -ux)

def slide_line_split(poly, target_area, normal_vector=None):
    """Slices a polygon into a target area using binary search and clipping."""
    if not poly or len(poly) < 3:
        return [], []
        
    if normal_vector is None:
        normal_vector = get_inward_normal(poly)
        
    nx, ny = normal_vector
    
    # Project all points onto the normal vector
    projections = [p[0] * nx + p[1] * ny for p in poly]
    min_proj = min(projections)
    max_proj = max(projections)
    
    low = min_proj
    high = max_proj
    best_t = min_proj
    
    # Run binary search
    for _ in range(60):
        t = (low + high) / 2.0
        # Clipper equation for anchor side: -nx * x - ny * y + t >= 0
        clipped = clip_polygon_halfplane(poly, -nx, -ny, t)
        area = planar_polygon_area(clipped)
        
        if area < target_area:
            low = t
        else:
            high = t
            best_t = t
            
    plot = clip_polygon_halfplane(poly, -nx, -ny, best_t)
    remainder = clip_polygon_halfplane(poly, nx, ny, -best_t)
    return plot, remainder

def solve_succession_subdivision(parent_coords, target_areas, crs_name="EPSG:21037"):
    """
    Sequentially subdivides a parent parcel into a list of target plot areas.
    Returns generated plots and coordinate beacon definitions.
    """
    to_utm, to_wgs84 = get_transformers(crs_name)
    
    # Project parent coords to UTM
    utm_parent = []
    for c in parent_coords:
        x, y = to_utm.transform(float(c['lng']), float(c['lat']))
        utm_parent.append((x, y))
        
    # Ensure coordinates are in clockwise or counter-clockwise order
    # Shoelace formula returns positive area, let's keep polygon vertices in order
    current_parcel = utm_parent
    plots = []
    
    for idx, target_sqm in enumerate(target_areas):
        if not current_parcel or len(current_parcel) < 3:
            break
            
        # For the last plot, it's just the remainder!
        if idx == len(target_areas) - 1:
            plot_utm = current_parcel
            current_parcel = []
        else:
            plot_utm, current_parcel = slide_line_split(current_parcel, target_sqm)
            
        if not plot_utm or len(plot_utm) < 3:
            continue
            
        # Convert UTM coordinates back to WGS84
        plot_wgs84 = []
        for x, y in plot_utm:
            lng, lat = to_wgs84.transform(x, y)
            plot_wgs84.append({'lat': lat, 'lng': lng})
            
        area_sqm = planar_polygon_area(plot_utm)
        cx_utm, cy_utm = planar_centroid(plot_utm)
        clng, clat = to_wgs84.transform(cx_utm, cy_utm)
        
        # Approximate dimensions
        xs = [p[0] for p in plot_utm]
        ys = [p[1] for p in plot_utm]
        w = max(xs) - min(xs)
        d = max(ys) - min(ys)
        
        plots.append({
            'plot_number': idx + 1,
            'coordinates': plot_wgs84,
            'area_sqm': area_sqm,
            'width_m': w,
            'depth_m': d,
            'centroid': {'lat': clat, 'lng': clng},
            'is_partial': False,
            'status': 'valid'
        })
        
    # Generate beacons with UTM credentials
    beacons = []
    beacon_counter = 1
    for p in plots:
        for offset, coord in enumerate(p['coordinates']):
            x, y = to_utm.transform(coord['lng'], coord['lat'])
            beacons.append({
                'beacon_number': beacon_counter,
                'latitude': coord['lat'],
                'longitude': coord['lng'],
                'easting': x,
                'northing': y,
                'description': f"Plot {p['plot_number']} - Corner {offset + 1}"
            })
            beacon_counter += 1
            
    return plots, beacons
