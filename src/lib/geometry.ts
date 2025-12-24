import { Coordinate } from '@/types/survey';

// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371000; // Earth's radius in meters
  const lat1 = coord1.lat * Math.PI / 180;
  const lat2 = coord2.lat * Math.PI / 180;
  const deltaLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const deltaLng = (coord2.lng - coord1.lng) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Calculate polygon area using Shoelace formula (in square meters)
export function calculatePolygonArea(coordinates: Coordinate[]): number {
  if (coordinates.length < 3) return 0;

  const R = 6371000; // Earth's radius in meters
  let total = 0;

  // Convert to radians and use spherical excess formula
  const toRad = (deg: number) => deg * Math.PI / 180;
  
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    const lat1 = toRad(coordinates[i].lat);
    const lng1 = toRad(coordinates[i].lng);
    const lat2 = toRad(coordinates[j].lat);
    const lng2 = toRad(coordinates[j].lng);

    total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  return Math.abs(total * R * R / 2);
}

// Calculate polygon perimeter
export function calculatePerimeter(coordinates: Coordinate[]): number {
  let perimeter = 0;
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    perimeter += calculateDistance(coordinates[i], coordinates[j]);
  }
  return perimeter;
}

// Calculate centroid of polygon
export function calculateCentroid(coordinates: Coordinate[]): Coordinate {
  if (coordinates.length === 0) return { lat: 0, lng: 0 };

  let latSum = 0;
  let lngSum = 0;

  for (const coord of coordinates) {
    latSum += coord.lat;
    lngSum += coord.lng;
  }

  return {
    lat: latSum / coordinates.length,
    lng: lngSum / coordinates.length,
  };
}

// Format area for display - ARDHISASA STANDARD: Always show in Hectares with 4 decimal places
export function formatArea(areaSqm: number): string {
  const hectares = areaSqm / 10000;
  return `${hectares.toFixed(4)} Ha`;
}

// Legacy format for non-official displays
export function formatAreaLegacy(areaSqm: number): string {
  if (areaSqm >= 10000) {
    return `${(areaSqm / 10000).toFixed(2)} ha`;
  } else if (areaSqm >= 1) {
    return `${areaSqm.toFixed(1)} m²`;
  }
  return `${(areaSqm * 10000).toFixed(0)} cm²`;
}

// Convert sqm to hectares
export function sqmToHectares(areaSqm: number): number {
  return areaSqm / 10000;
}

// Format distance for display
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(1)} m`;
}

// Format coordinates for display (single number version)
export function formatCoordinate(value: number, precision: number = 6): string {
  return value.toFixed(precision);
}

// Format coordinate pair for display
export function formatCoordinatePair(coord: Coordinate, precision: number = 6): string {
  return `${coord.lat.toFixed(precision)}, ${coord.lng.toFixed(precision)}`;
}

// Alias for calculatePolygonArea for convenience
export const calculateArea = calculatePolygonArea;

// Parse coordinates from various formats (CSV, TSV, total station exports)
export function parseCSVCoordinates(csvText: string): Coordinate[] {
  const coordinates: Coordinate[] = [];
  
  // Handle various line separators
  const lines = csvText.split(/[\n\r;]+/).filter(line => line.trim());
  
  // Skip header row if detected
  const firstLine = lines[0]?.toLowerCase() || '';
  const hasHeader = firstLine.includes('lat') || firstLine.includes('north') || 
                    firstLine.includes('easting') || firstLine.includes('point') ||
                    firstLine.includes('x') || firstLine.includes('y');
  
  const startIndex = hasHeader ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle multiple delimiters: comma, tab, semicolon, space
    const parts = line.split(/[,\t\s]+/).map(p => p.trim()).filter(p => p);
    
    if (parts.length >= 2) {
      // Try different column arrangements
      // Format 1: lat, lng (WGS84)
      // Format 2: point_id, lat, lng
      // Format 3: point_id, easting, northing (UTM - needs conversion hint)
      // Format 4: easting, northing (UTM)
      
      let lat: number | null = null;
      let lng: number | null = null;
      
      // Check if first column is a point ID (non-numeric or integer)
      const firstIsId = isNaN(parseFloat(parts[0])) || 
                        (Number.isInteger(parseFloat(parts[0])) && parts.length > 2);
      
      const numericParts = firstIsId ? parts.slice(1) : parts;
      
      if (numericParts.length >= 2) {
        const val1 = parseFloat(numericParts[0]);
        const val2 = parseFloat(numericParts[1]);
        
        if (!isNaN(val1) && !isNaN(val2)) {
          // Determine if values are lat/lng or UTM based on magnitude
          // Lat: -90 to 90, Lng: -180 to 180
          // UTM Easting: typically 100,000 to 900,000
          // UTM Northing: typically 0 to 10,000,000
          
          if (Math.abs(val1) <= 90 && Math.abs(val2) <= 180) {
            // Likely lat, lng
            lat = val1;
            lng = val2;
          } else if (Math.abs(val2) <= 90 && Math.abs(val1) <= 180) {
            // Likely lng, lat (some systems use this order)
            lat = val2;
            lng = val1;
          } else if (val1 > 100000 && val2 > 100000) {
            // Likely UTM coordinates - store as-is and flag for conversion
            // For now, we'll try to detect Kenya's UTM zone (36N/37N)
            // This is a simplified conversion - full solution would need zone info
            lat = val2;
            lng = val1;
            console.warn('Large coordinates detected - may need UTM conversion');
          }
          
          if (lat !== null && lng !== null) {
            coordinates.push({ lat, lng });
          }
        }
      }
    }
  }
  
  return coordinates;
}

// Parse GeoJSON format
export function parseGeoJSON(jsonText: string): Coordinate[] {
  try {
    const geojson = JSON.parse(jsonText);
    const coordinates: Coordinate[] = [];
    
    const extractCoords = (geometry: any) => {
      if (!geometry) return;
      
      if (geometry.type === 'Point') {
        coordinates.push({ lat: geometry.coordinates[1], lng: geometry.coordinates[0] });
      } else if (geometry.type === 'Polygon') {
        // Take the outer ring
        const ring = geometry.coordinates[0];
        for (const coord of ring) {
          coordinates.push({ lat: coord[1], lng: coord[0] });
        }
      } else if (geometry.type === 'MultiPolygon') {
        // Take first polygon's outer ring
        const ring = geometry.coordinates[0][0];
        for (const coord of ring) {
          coordinates.push({ lat: coord[1], lng: coord[0] });
        }
      } else if (geometry.type === 'LineString') {
        for (const coord of geometry.coordinates) {
          coordinates.push({ lat: coord[1], lng: coord[0] });
        }
      }
    };
    
    if (geojson.type === 'FeatureCollection') {
      for (const feature of geojson.features) {
        extractCoords(feature.geometry);
      }
    } else if (geojson.type === 'Feature') {
      extractCoords(geojson.geometry);
    } else {
      extractCoords(geojson);
    }
    
    return coordinates;
  } catch {
    throw new Error('Invalid GeoJSON format');
  }
}

// Main parser that detects format automatically
export function parseCoordinateFile(text: string, fileName?: string): Coordinate[] {
  const trimmed = text.trim();
  
  // Detect JSON/GeoJSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseGeoJSON(trimmed);
  }
  
  // Default to CSV/text parsing
  return parseCSVCoordinates(trimmed);
}

// Generate sample parcel for demo
export function generateSampleParcel(): Coordinate[] {
  // Sample rectangular parcel (approximately 100m x 200m)
  const baseLat = -1.2921; // Nairobi area
  const baseLng = 36.8219;
  const latOffset = 0.001; // ~111m
  const lngOffset = 0.002; // ~222m

  return [
    { lat: baseLat, lng: baseLng },
    { lat: baseLat, lng: baseLng + lngOffset },
    { lat: baseLat + latOffset, lng: baseLng + lngOffset },
    { lat: baseLat + latOffset, lng: baseLng },
  ];
}

// Subdivide a rectangular parcel into plots
export function subdivideParcel(
  coordinates: Coordinate[],
  plotWidth: number,
  plotDepth: number,
  roadSetback: number = 0,
  sideSetback: number = 0
): Coordinate[][] {
  if (coordinates.length < 4) return [];

  // This is a simplified subdivision for rectangular parcels
  // AI will handle complex shapes
  const minLat = Math.min(...coordinates.map(c => c.lat));
  const maxLat = Math.max(...coordinates.map(c => c.lat));
  const minLng = Math.min(...coordinates.map(c => c.lng));
  const maxLng = Math.max(...coordinates.map(c => c.lng));

  const parcelWidth = calculateDistance(
    { lat: minLat, lng: minLng },
    { lat: minLat, lng: maxLng }
  );
  const parcelDepth = calculateDistance(
    { lat: minLat, lng: minLng },
    { lat: maxLat, lng: minLng }
  );

  // Calculate how many plots fit
  const effectiveWidth = parcelWidth - (2 * sideSetback);
  const effectiveDepth = parcelDepth - roadSetback;

  const plotsPerRow = Math.floor(effectiveWidth / plotWidth);
  const rows = Math.floor(effectiveDepth / plotDepth);

  if (plotsPerRow <= 0 || rows <= 0) return [];

  const plots: Coordinate[][] = [];
  const latPerMeter = (maxLat - minLat) / parcelDepth;
  const lngPerMeter = (maxLng - minLng) / parcelWidth;

  const startLng = minLng + (sideSetback * lngPerMeter);
  const startLat = minLat + (roadSetback * latPerMeter);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < plotsPerRow; col++) {
      const plotMinLat = startLat + (row * plotDepth * latPerMeter);
      const plotMaxLat = plotMinLat + (plotDepth * latPerMeter);
      const plotMinLng = startLng + (col * plotWidth * lngPerMeter);
      const plotMaxLng = plotMinLng + (plotWidth * lngPerMeter);

      plots.push([
        { lat: plotMinLat, lng: plotMinLng },
        { lat: plotMinLat, lng: plotMaxLng },
        { lat: plotMaxLat, lng: plotMaxLng },
        { lat: plotMaxLat, lng: plotMinLng },
      ]);
    }
  }

  return plots;
}
