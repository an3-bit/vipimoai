# Step 1: Backend Django API Implementation

## Summary

This document describes the Step 1 backend API updates that make Django the **single source of truth** for spatial math, area calculations, and subdivision logic.

---

## Endpoint 1: POST /api/rtk/ingest-coordinates/

### Purpose
Accept raw WGS84 coordinates, project them to Arc 1960 (SRID 21037), calculate the exact authoritative area in hectares, and return projected coordinates and area to the frontend.

### Authentication
Required: JWT Bearer Token (IsAuthenticated)

### Request Payload

```json
{
  "coordinates": [
    {"lat": -1.234567, "lng": 36.654321},
    {"lat": -1.234500, "lng": 36.655000},
    {"lat": -1.235000, "lng": 36.655000},
    {"lat": -1.235000, "lng": 36.654321}
  ],
  "crs_input": "EPSG:4326",  // Optional, default: WGS84
  "crs_output": "EPSG:21037" // Optional, default: Arc 1960 Zone 37S
}
```

### Request Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `coordinates` | Array of objects | Yes | Array of points with `lat` and `lng` fields in WGS84 (minimum 3 points) |
| `crs_input` | String | No | Input CRS identifier (default: "EPSG:4326" for WGS84) |
| `crs_output` | String | No | Output CRS identifier (default: "EPSG:21037" for Arc 1960 UTM Zone 37S) |

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "wgs84_coordinates": [
      {"lat": -1.234567, "lng": 36.654321},
      {"lat": -1.234500, "lng": 36.655000},
      {"lat": -1.235000, "lng": 36.655000},
      {"lat": -1.235000, "lng": 36.654321}
    ],
    "projected_coordinates": [
      {"easting": 467123.4567, "northing": 8643210.1234},
      {"easting": 467189.6789, "northing": 8643270.9012},
      {"easting": 467189.6789, "northing": 8643215.3456},
      {"easting": 467123.4567, "northing": 8643155.5678}
    ],
    "area": {
      "square_meters": 4523.67,
      "hectares": 0.4524,
      "acres": 1.1177
    },
    "crs_input": "EPSG:4326",
    "crs_output": "EPSG:21037"
  }
}
```

### Response Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates successful coordinate projection and area calculation |
| `data.wgs84_coordinates` | Array | The original input coordinates (unchanged) |
| `data.projected_coordinates` | Array | Coordinates projected to Arc 1960 (easting/northing in meters) |
| `data.area.square_meters` | Number | Calculated area in square meters (from Arc 1960 planar geometry) |
| `data.area.hectares` | Number | Calculated area in hectares (1 ha = 10,000 m²) |
| `data.area.acres` | Number | Calculated area in acres (1 ha ≈ 2.471 acres) |
| `data.crs_input` | String | CRS used for input interpretation |
| `data.crs_output` | String | CRS used for projection output |

### Error Response (400/500)

```json
{
  "success": false,
  "error": "Coordinate projection/area calculation failed: [error details]"
}
```

### Key Points

- **Authority**: All area calculations are performed using Arc 1960 (EPSG:21037) projected geometry
- **Projection**: Uses pyproj for precise WGS84 → Arc 1960 transformation
- **Area Accuracy**: Planar area calculation from projected coordinates (more accurate than spherical approximation)
- **Units**: Output in square meters, hectares, and acres for convenience
- **Frontend Use**: Frontend must use the `hectares` value as the authoritative area for the parcel

### Example cURL Request

```bash
curl -X POST http://localhost:8000/api/rtk/ingest-coordinates/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "coordinates": [
      {"lat": -1.234567, "lng": 36.654321},
      {"lat": -1.234500, "lng": 36.655000},
      {"lat": -1.235000, "lng": 36.655000},
      {"lat": -1.235000, "lng": 36.654321}
    ]
  }'
```

---

## Endpoint 2: POST /api/subdivide/

### Purpose
Execute subdivision algorithms with support for:
- Multi-target area cuts (array of target areas in different units)
- Frontage/road constraint awareness
- Rectangular and succession subdivision strategies

### Authentication
Required: JWT Bearer Token (IsAuthenticated)

### Request Payload

```json
{
  "parcelCoordinates": [
    {"lat": -1.234567, "lng": 36.654321},
    {"lat": -1.234500, "lng": 36.655000},
    {"lat": -1.235000, "lng": 36.655000},
    {"lat": -1.235000, "lng": 36.654321}
  ],
  "strategy": "succession",
  "target_areas": [
    {"value": 5.0, "unit": "hectares"},
    {"value": 2.0, "unit": "hectares"},
    {"value": 1.0, "unit": "hectares"},
    {"value": 1.0, "unit": "hectares"}
  ],
  "frontage_edges": [
    {
      "start_index": 0,
      "end_index": 1,
      "coordinates": []
    }
  ],
  "road_setback_m": 5.0,
  "side_setback_m": 2.0,
  "crs_name": "EPSG:21037"
}
```

### Request Field Descriptions - Rectangular Strategies (auto_fit, fixed_count, equal_resize)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parcelCoordinates` | Array | Yes | Array of {lat, lng} points defining the parcel boundary (minimum 3 points) |
| `strategy` | String | No | Subdivision strategy: "auto_fit", "fixed_count", "equal_resize" (default: "auto_fit") |
| `plot_width` | Number | Yes (for rectangular strategies) | Width of each plot in meters |
| `plot_depth` | Number | Yes (for rectangular strategies) | Depth of each plot in meters |
| `target_plot_count` | Number | No | For "fixed_count" and "equal_resize" strategies |
| `road_setback_m` | Number | No | Setback from road edge in meters (default: 0) |
| `side_setback_m` | Number | No | Setback from side edges in meters (default: 0) |
| `orientation_degrees` | Number | No | Rotation angle in degrees (default: 0) |
| `notes` | String | No | Additional notes about the subdivision |
| `crs_name` | String | No | CRS for calculation (default: "EPSG:21037") |

### Request Field Descriptions - Succession Strategy

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `parcelCoordinates` | Array | Yes | Array of {lat, lng} points defining the parcel boundary |
| `strategy` | String | Yes | Must be "succession" for multi-target cuts |
| `target_areas` | Array of objects | Yes | Array of target areas with `value` and `unit` fields |
| `frontage_edges` | Array of objects | No | Array of frontage/road constraints |
| `road_setback_m` | Number | No | Setback from road edge in meters |
| `side_setback_m` | Number | No | Setback from side edges in meters |
| `crs_name` | String | No | CRS for calculation (default: "EPSG:21037") |

### Target Area Entry Format

```json
{
  "value": 5.0,
  "unit": "hectares"  // "hectares", "ha", "acres", "ac", or "sqm"
}
```

### Frontage Edge Format

```json
{
  "start_index": 0,
  "end_index": 1,
  "coordinates": []  // Optional: explicit coordinates for the edge
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "parcel": {
    "area_sqm": 45236.78,
    "width_m": 234.56,
    "depth_m": 193.12,
    "coordinates": [...]
  },
  "subdivision": {
    "strategy": "succession",
    "plot_width": null,
    "plot_depth": null,
    "road_setback_m": 5.0,
    "side_setback_m": 2.0,
    "orientation_degrees": 0.0,
    "target_plot_count": null,
    "crs_name": "EPSG:21037",
    "frontage_edges": [...],
    "target_areas": [...]
  },
  "results": {
    "total_plots": 4,
    "plots": [
      {
        "plot_number": 1,
        "coordinates": [...],
        "area_sqm": 50000.0,
        "width_m": null,
        "depth_m": null,
        "is_partial": false
      },
      ...
    ],
    "beacons": [
      {
        "beacon_number": 1,
        "latitude": -1.234567,
        "longitude": 36.654321,
        "description": "Plot 1 - Corner 1"
      },
      ...
    ],
    "efficiency_percent": 92.5
  },
  "suggestions": [...],
  "ai_analysis": null
}
```

### Error Response (400/500)

```json
{
  "error": "error message describing what went wrong"
}
```

### Key Enhancements

✅ **Target Areas Support**: The `target_areas` array allows specifying multiple plot areas for "succession" strategy
- Supports flexible units: hectares (ha), acres (ac), square meters (sqm)
- Backend automatically converts all units to square meters for calculation

✅ **Frontage Edges Support**: The `frontage_edges` array allows specifying road/frontage constraints
- Array of objects with `start_index`, `end_index`, and optional `coordinates`
- Indices refer to positions in the parcel coordinate array
- Frontage edges are preserved in the response for frontend tracking

✅ **Area Calculations**: All calculations use projected Arc 1960 geometry for accuracy

### Example cURL Request - Succession Strategy

```bash
curl -X POST http://localhost:8000/api/subdivide/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parcelCoordinates": [
      {"lat": -1.234567, "lng": 36.654321},
      {"lat": -1.234500, "lng": 36.655000},
      {"lat": -1.235000, "lng": 36.655000},
      {"lat": -1.235000, "lng": 36.654321}
    ],
    "strategy": "succession",
    "target_areas": [
      {"value": 5.0, "unit": "hectares"},
      {"value": 2.0, "unit": "hectares"},
      {"value": 1.0, "unit": "hectares"},
      {"value": 1.0, "unit": "hectares"}
    ],
    "frontage_edges": [
      {"start_index": 0, "end_index": 1}
    ],
    "road_setback_m": 5.0,
    "side_setback_m": 2.0
  }'
```

---

## Files Modified in Step 1

### 1. [server/rtk_core/serializers.py](server/rtk_core/serializers.py)
- ✅ Added `CoordinateIngestSerializer` for validating coordinate ingestion requests
- Validates: array format, minimum 3 points, lat/lng numeric values
- Supports configurable input/output CRS

### 2. [server/rtk_core/views.py](server/rtk_core/views.py)
- ✅ Added `CoordinateIngestView` for POST /api/rtk/ingest-coordinates/
- Implements WGS84 → Arc 1960 projection using pyproj
- Calculates area using planar geometry (Arc 1960 projected coordinates)
- Returns area in square meters, hectares, and acres

### 3. [server/rtk_core/urls.py](server/rtk_core/urls.py)
- ✅ Added route for `CoordinateIngestView` at `/ingest-coordinates/`

### 4. [server/core/views.py](server/core/views.py)
- ✅ Updated `AISubdivisionView` response to include `frontage_edges` and `target_areas` in response
- Ensures these fields are preserved through the subdivision workflow

### 5. [server/core/serializers.py](server/core/serializers.py)
- No changes (already supports target_areas and frontage_edges via `AISubdivisionRequestSerializer`)

---

## Testing the Implementation

### Test 1: Coordinate Ingestion

```bash
# POST to /api/rtk/ingest-coordinates/
curl -X POST http://localhost:8000/api/rtk/ingest-coordinates/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "coordinates": [
      {"lat": -1.25, "lng": 36.65},
      {"lat": -1.25, "lng": 36.66},
      {"lat": -1.26, "lng": 36.66},
      {"lat": -1.26, "lng": 36.65}
    ]
  }'

# Expected response includes:
# - Original WGS84 coordinates
# - Projected Arc 1960 coordinates (easting/northing)
# - Area in square meters, hectares, acres
```

### Test 2: Succession Subdivision

```bash
# POST to /api/subdivide/ with succession strategy
curl -X POST http://localhost:8000/api/subdivide/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parcelCoordinates": [...],
    "strategy": "succession",
    "target_areas": [
      {"value": 5.0, "unit": "hectares"},
      {"value": 2.0, "unit": "hectares"}
    ],
    "frontage_edges": [{"start_index": 0, "end_index": 1}]
  }'

# Expected response includes:
# - Subdivision results with multiple plots
# - Each plot with area_sqm close to targets (after unit conversion)
# - Frontage edges preserved in response
```

---

## Architecture Notes

### Coordinate Systems Used
- **WGS84 (EPSG:4326)**: Input CRS, lat/lng format
- **Arc 1960 UTM Zone 37S (EPSG:21037)**: Processing and calculation CRS, easting/northing in meters

### Area Calculation Strategy
1. Input coordinates in WGS84 (lat/lng)
2. Transform to Arc 1960 (easting/northing in meters) using pyproj
3. Calculate planar area using GEOS/Shapely geometry
4. Result is accurate because Arc 1960 is a projected (planar) CRS with meter units

### Dependencies
- **pyproj**: Coordinate transformation (WGS84 ↔ Arc 1960)
- **Shapely**: Geometry operations and area calculation
- **Django GIS**: GeometryField storage (SRID 21037)

---

## Frontend Integration Notes

### For Frontend Developers (Step 2)

1. **Use the Ingestion Endpoint First**
   - Replace local coordinate math with calls to `/api/rtk/ingest-coordinates/`
   - Use the returned `hectares` value as authoritative area
   - Store projected `easting` and `northing` if needed for display

2. **Use Subdivision with Multi-Target Areas**
   - Pass `target_areas` array to `/api/subdivide/` instead of creating plots locally
   - Example: `[{value: 5.0, unit: "hectares"}, {value: 2.0, unit: "hectares"}]`
   - Backend will split the parcel according to target areas

3. **Preserve Frontage Edges**
   - Include `frontage_edges` array in subdivision requests
   - Frontage edges will be echoed back in the response
   - Use them to constrain plot generation logic

4. **Delete Local Subdivision Engine**
   - Once Step 2 frontend changes are complete, delete `SmartSubdivisionEngine.ts`
   - All subdivision logic is now server-side

---

## Next Steps (Step 2 - Do Not Execute Yet)

These tasks will be executed after Step 1 is approved:

- Delete local `SmartSubdivisionEngine.ts` from frontend
- Update `SubdivisionForm.tsx` to accept multi-target areas input
- Replace frontend API calls to use new ingestion endpoint for area calculation
- Update subdivision request payload to send `target_areas` and `frontage_edges`
