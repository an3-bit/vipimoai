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

// Format area for display
export function formatArea(areaSqm: number): string {
  if (areaSqm >= 10000) {
    return `${(areaSqm / 10000).toFixed(2)} ha`;
  } else if (areaSqm >= 1) {
    return `${areaSqm.toFixed(1)} m²`;
  }
  return `${(areaSqm * 10000).toFixed(0)} cm²`;
}

// Format distance for display
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(1)} m`;
}

// Format coordinates for display
export function formatCoordinate(coord: Coordinate, precision: number = 6): string {
  return `${coord.lat.toFixed(precision)}, ${coord.lng.toFixed(precision)}`;
}

// Parse CSV coordinates (format: "lat,lng" per line or "lat,lng;lat,lng...")
export function parseCSVCoordinates(csvText: string): Coordinate[] {
  const coordinates: Coordinate[] = [];
  
  // Handle both newline and semicolon separators
  const lines = csvText.split(/[\n;]/).filter(line => line.trim());
  
  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        coordinates.push({ lat, lng });
      }
    }
  }
  
  return coordinates;
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
