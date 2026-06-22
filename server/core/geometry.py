import math

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
