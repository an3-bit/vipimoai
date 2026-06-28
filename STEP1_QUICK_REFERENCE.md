# Quick Reference: Step 1 Backend API

## New Endpoint Summary

### 🆕 POST /api/rtk/ingest-coordinates/

**Purpose**: Ingest WGS84 coordinates → Project to Arc 1960 → Calculate area

**Request**:
```json
{
  "coordinates": [
    {"lat": -1.25, "lng": 36.65},
    {"lat": -1.25, "lng": 36.66},
    {"lat": -1.26, "lng": 36.66}
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "wgs84_coordinates": [...],
    "projected_coordinates": [
      {"easting": 467123.45, "northing": 8643210.12},
      ...
    ],
    "area": {
      "square_meters": 4523.67,
      "hectares": 0.4524,
      "acres": 1.1177
    }
  }
}
```

**Use Case**: Frontend calls this to get authoritative area for any parcel

---

### 📝 POST /api/subdivide/ - Enhanced

**Now Supports**: target_areas array + frontage_edges array

**Request with Multi-Target Areas**:
```json
{
  "parcelCoordinates": [...],
  "strategy": "succession",
  "target_areas": [
    {"value": 5.0, "unit": "hectares"},
    {"value": 2.0, "unit": "hectares"},
    {"value": 1.0, "unit": "hectares"}
  ],
  "frontage_edges": [
    {"start_index": 0, "end_index": 1}
  ]
}
```

**Response Now Includes**:
```json
{
  "success": true,
  "subdivision": {
    "frontage_edges": [...],    // ← PRESERVED
    "target_areas": [...]        // ← PRESERVED
  },
  "results": {
    "plots": [...]
  }
}
```

**Use Case**: Frontend passes multi-target areas → Backend calculates exact plots

---

## Implementation Checklist ✅

- [x] Create CoordinateIngestView in rtk_core/views.py
- [x] Create CoordinateIngestSerializer in rtk_core/serializers.py
- [x] Add URL route in rtk_core/urls.py
- [x] Update AISubdivisionView response to include frontage_edges and target_areas
- [x] Validate all Python syntax
- [x] Verify Django configuration
- [x] Create API specification documentation
- [x] Create implementation summary

---

## Architecture

```
Frontend (Step 2)
    ↓
POST /api/rtk/ingest-coordinates/  ← NEW
    ↓
Backend:
  1. Validate WGS84 coords
  2. Transform to Arc 1960 using pyproj
  3. Calculate planar area (Arc 1960 geometry)
  4. Return: WGS84 + projected coords + area
    ↓
Frontend uses returned area as authoritative value

---

Frontend with multi-target areas
    ↓
POST /api/subdivide/
  target_areas: [{5.0 ha}, {2.0 ha}, ...]
  frontage_edges: [...]
    ↓
Backend:
  1. Validate inputs
  2. Execute succession algorithm
  3. Create plots matching target areas
  4. Return: plots + frontage_edges + target_areas
    ↓
Frontend displays results
```

---

## Files Reference

| File | Change | Type |
|------|--------|------|
| [rtk_core/views.py](server/rtk_core/views.py) | Added CoordinateIngestView | New |
| [rtk_core/serializers.py](server/rtk_core/serializers.py) | Added CoordinateIngestSerializer | New |
| [rtk_core/urls.py](server/rtk_core/urls.py) | Added ingest-coordinates route | New |
| [core/views.py](server/core/views.py) | Updated AISubdivisionView response | Modified |
| [core/serializers.py](server/core/serializers.py) | (No changes - already complete) | No Change |

---

## Verification

```bash
# Check Django
cd server
source .venv/bin/activate
python manage.py check
# Expected: "System check identified no issues (0 silenced)"

# Test new endpoint (after approval)
curl -X POST http://localhost:8000/api/rtk/ingest-coordinates/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "coordinates": [
      {"lat": -1.25, "lng": 36.65},
      {"lat": -1.25, "lng": 36.66},
      {"lat": -1.26, "lng": 36.66}
    ]
  }'
```

---

## Dependencies

All required packages already installed:
- ✅ pyproj (coordinate transformation)
- ✅ shapely (geometry operations)
- ✅ django.contrib.gis (GeoDjango)
- ✅ rest_framework (API framework)

---

## Next: Step 2 (Awaiting Approval)

Once approved, will implement:
1. Delete SmartSubdivisionEngine.ts
2. Update SubdivisionForm.tsx with multi-target areas input
3. Call /api/rtk/ingest-coordinates/ for area
4. Call /api/subdivide/ with target_areas and frontage_edges
5. Use backend results as authoritative data

---

## Documentation

- Full API Spec: [STEP1_BACKEND_API_SPEC.md](STEP1_BACKEND_API_SPEC.md)
- Implementation Summary: [STEP1_IMPLEMENTATION_SUMMARY.md](STEP1_IMPLEMENTATION_SUMMARY.md)
