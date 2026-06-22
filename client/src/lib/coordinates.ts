import proj4 from 'proj4';
import { Coordinate } from '@/types/survey';

// Define coordinate reference systems
// Arc 1960 / UTM zone 37N (Kenya)
const ARC1960_UTM37N = '+proj=utm +zone=37 +a=6378249.145 +rf=293.465 +towgs84=-160,-6,-302,0,0,0,0 +units=m +no_defs';
// WGS84 (Standard GPS/Leaflet)
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

// Register the projections
proj4.defs('ARC1960_UTM37N', ARC1960_UTM37N);
proj4.defs('WGS84', WGS84);

export interface UTMCoordinate {
  easting: number;
  northing: number;
  zone?: number;
}

export interface CRSDetectionResult {
  detectedCRS: 'WGS84' | 'UTM' | 'UNKNOWN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  suggestedConversion: boolean;
}

/**
 * Detect the coordinate reference system based on coordinate values
 */
export function detectCRS(coordinates: Coordinate[]): CRSDetectionResult {
  if (coordinates.length === 0) {
    return {
      detectedCRS: 'UNKNOWN',
      confidence: 'LOW',
      message: 'No coordinates provided',
      suggestedConversion: false,
    };
  }

  const firstCoord = coordinates[0];
  const { lat, lng } = firstCoord;

  // Check for WGS84 range
  if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    // Check if it's specifically in Kenya region
    if (lat >= -5 && lat <= 5 && lng >= 33 && lng <= 42) {
      return {
        detectedCRS: 'WGS84',
        confidence: 'HIGH',
        message: 'Coordinates appear to be WGS84 (Kenya region)',
        suggestedConversion: false,
      };
    }
    return {
      detectedCRS: 'WGS84',
      confidence: 'MEDIUM',
      message: 'Coordinates appear to be WGS84',
      suggestedConversion: false,
    };
  }

  // Check for UTM range (Kenya is in zones 36-37)
  // Easting: typically 100,000 to 900,000
  // Northing for Kenya: around 9,800,000 to 10,200,000 (near equator, southern hemisphere uses 10,000,000 false northing)
  if (
    (lng >= 100000 && lng <= 900000) && 
    (lat >= 9500000 && lat <= 10500000)
  ) {
    return {
      detectedCRS: 'UTM',
      confidence: 'HIGH',
      message: 'Coordinates detected as UTM/Arc 1960 (Kenya Zone 37N). Conversion recommended.',
      suggestedConversion: true,
    };
  }

  // Large numbers suggest UTM
  if (Math.abs(lat) > 1000 || Math.abs(lng) > 1000) {
    return {
      detectedCRS: 'UTM',
      confidence: 'MEDIUM',
      message: 'Large coordinate values suggest UTM projection. Conversion may be needed.',
      suggestedConversion: true,
    };
  }

  return {
    detectedCRS: 'UNKNOWN',
    confidence: 'LOW',
    message: 'Unable to determine coordinate system',
    suggestedConversion: false,
  };
}

/**
 * Convert UTM coordinates to WGS84 (lat/lng)
 * Assumes Kenya UTM Zone 37N with Arc 1960 datum
 */
export function utmToWGS84(easting: number, northing: number, zone: number = 37): Coordinate {
  try {
    // Define the UTM zone projection dynamically
    const utmProj = `+proj=utm +zone=${zone} +a=6378249.145 +rf=293.465 +towgs84=-160,-6,-302,0,0,0,0 +units=m +no_defs`;
    
    const [lng, lat] = proj4(utmProj, WGS84, [easting, northing]);
    
    return { lat, lng };
  } catch (error) {
    console.error('UTM to WGS84 conversion error:', error);
    // Fallback: simple approximate conversion for Kenya
    return approximateUTMToWGS84(easting, northing);
  }
}

/**
 * Convert WGS84 coordinates to UTM (Easting/Northing)
 * Returns Kenya Arc 1960 UTM Zone 37N format
 */
export function wgs84ToUTM(lat: number, lng: number, zone: number = 37): UTMCoordinate {
  try {
    const utmProj = `+proj=utm +zone=${zone} +a=6378249.145 +rf=293.465 +towgs84=-160,-6,-302,0,0,0,0 +units=m +no_defs`;
    
    const [easting, northing] = proj4(WGS84, utmProj, [lng, lat]);
    
    return { easting, northing, zone };
  } catch (error) {
    console.error('WGS84 to UTM conversion error:', error);
    // Fallback: simple approximate conversion
    return approximateWGS84ToUTM(lat, lng);
  }
}

/**
 * Approximate UTM to WGS84 conversion (fallback)
 * Uses simplified math for Kenya region
 */
function approximateUTMToWGS84(easting: number, northing: number): Coordinate {
  // Kenya Zone 37N parameters
  const falseEasting = 500000;
  const falseNorthing = 0; // Northern hemisphere
  const centralMeridian = 39; // Zone 37 central meridian
  
  // Simplified conversion (approximate for Kenya)
  const k0 = 0.9996;
  const a = 6378249.145; // Arc 1960 semi-major axis
  
  const x = easting - falseEasting;
  const y = northing - falseNorthing;
  
  // Very simplified - for accurate results use proj4
  const lat = y / 111320;
  const lng = centralMeridian + (x / (111320 * Math.cos(lat * Math.PI / 180)));
  
  return { lat, lng };
}

/**
 * Approximate WGS84 to UTM conversion (fallback)
 */
function approximateWGS84ToUTM(lat: number, lng: number): UTMCoordinate {
  const centralMeridian = 39; // Zone 37
  const falseEasting = 500000;
  
  const easting = falseEasting + ((lng - centralMeridian) * 111320 * Math.cos(lat * Math.PI / 180));
  const northing = lat * 111320;
  
  return { easting, northing, zone: 37 };
}

/**
 * Convert an array of coordinates from UTM to WGS84
 */
export function convertCoordinatesFromUTM(
  coordinates: { lat: number; lng: number }[], 
  zone: number = 37
): Coordinate[] {
  return coordinates.map(coord => {
    // In UTM input, lat field contains Northing, lng field contains Easting
    return utmToWGS84(coord.lng, coord.lat, zone);
  });
}

/**
 * Format coordinate for Ardhisasa export with Northing/Easting
 */
export function formatForArdhisasa(coord: Coordinate, beaconNumber: number): {
  Beacon_ID: string;
  Northing: string;
  Easting: string;
  Latitude: string;
  Longitude: string;
} {
  const utm = wgs84ToUTM(coord.lat, coord.lng);
  
  return {
    Beacon_ID: `BK${beaconNumber}`,
    Northing: utm.northing.toFixed(3),
    Easting: utm.easting.toFixed(3),
    Latitude: coord.lat.toFixed(8),
    Longitude: coord.lng.toFixed(8),
  };
}

/**
 * Format area to Hectares with 4 decimal places (Ardhisasa standard)
 */
export function formatAreaHa(areaSqm: number): string {
  const hectares = areaSqm / 10000;
  return `${hectares.toFixed(4)} Ha`;
}

/**
 * Convert square meters to hectares
 */
export function sqmToHa(areaSqm: number): number {
  return areaSqm / 10000;
}
