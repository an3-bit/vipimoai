import proj4 from 'proj4';
import { Coordinate } from '@/types/survey';

// Define coordinate reference systems (Kenya)
// Arc 1960 / UTM zone 37S (Kenya Central/East, including Nairobi)
const ARC1960_UTM37S = '+proj=utm +zone=37 +south +a=6378249.145 +rf=293.465 +towgs84=-160,-6,-302,0,0,0,0 +units=m +no_defs';
// Arc 1960 / UTM zone 36S (Kenya West, including Kisumu)
const ARC1960_UTM36S = '+proj=utm +zone=36 +south +a=6378249.145 +rf=293.465 +towgs84=-160,-6,-302,0,0,0,0 +units=m +no_defs';
// WGS84 (Standard GPS/Leaflet)
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

// Register the projections
proj4.defs('ARC1960_UTM37S', ARC1960_UTM37S);
proj4.defs('ARC1960_UTM36S', ARC1960_UTM36S);
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
 * Returns the appropriate UTM Zone for a given longitude in Kenya (36S for West, 37S for Central/East)
 */
export function getUTMZone(lng: number): number {
  if (lng >= 30 && lng < 36) return 36;
  return 37; // default to zone 37
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
    if (lat >= -5 && lat <= 5 && lng >= 30 && lng <= 42) {
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

  // Check for UTM range (Kenya is in zones 36-37, Southern hemisphere uses false northing of 10,000,000)
  // Easting: typically 100,000 to 900,000
  // Northing for Kenya: around 9,800,000 to 10,000,000 (just south of equator)
  if (
    (lng >= 100000 && lng <= 900000) && 
    (lat >= 9500000 && lat <= 10500000)
  ) {
    return {
      detectedCRS: 'UTM',
      confidence: 'HIGH',
      message: 'Coordinates detected as UTM/Arc 1960 (Kenya Zone 36S/37S). Conversion recommended.',
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
 * Assumes Kenya UTM Zone 36S or 37S with Arc 1960 datum
 */
export function utmToWGS84(easting: number, northing: number, zone: number = 37): Coordinate {
  try {
    // Define the UTM zone projection dynamically with +south
    const utmProj = `+proj=utm +zone=${zone} +south +a=6378249.145 +rf=293.465 +towgs84=-160,-6,-302,0,0,0,0 +units=m +no_defs`;
    
    const [lng, lat] = proj4(utmProj, WGS84, [easting, northing]);
    
    return { lat, lng };
  } catch (error) {
    console.error('UTM to WGS84 conversion error:', error);
    // Fallback: simple approximate conversion for Kenya
    return approximateUTMToWGS84(easting, northing, zone);
  }
}

/**
 * Convert WGS84 coordinates to UTM (Easting/Northing)
 * Returns Kenya Arc 1960 UTM Zone 36S/37S format
 */
export function wgs84ToUTM(lat: number, lng: number, zone?: number): UTMCoordinate {
  const targetZone = zone || getUTMZone(lng);
  try {
    const utmProj = `+proj=utm +zone=${targetZone} +south +a=6378249.145 +rf=293.465 +towgs84=-160,-6,-302,0,0,0,0 +units=m +no_defs`;
    
    const [easting, northing] = proj4(WGS84, utmProj, [lng, lat]);
    
    return { easting, northing, zone: targetZone };
  } catch (error) {
    console.error('WGS84 to UTM conversion error:', error);
    // Fallback: simple approximate conversion
    return approximateWGS84ToUTM(lat, lng, targetZone);
  }
}

/**
 * Approximate UTM to WGS84 conversion (fallback)
 * Uses simplified math for Kenya region
 */
function approximateUTMToWGS84(easting: number, northing: number, zone: number = 37): Coordinate {
  const falseEasting = 500000;
  const falseNorthing = 10000000; // Southern hemisphere
  const centralMeridian = zone === 36 ? 33 : 39; // Zone 36 = 33E, Zone 37 = 39E
  
  const x = easting - falseEasting;
  const y = northing - falseNorthing;
  
  const lat = y / 111320;
  const lng = centralMeridian + (x / (111320 * Math.cos(lat * Math.PI / 180)));
  
  return { lat, lng };
}

/**
 * Approximate WGS84 to UTM conversion (fallback)
 */
function approximateWGS84ToUTM(lat: number, lng: number, zone: number = 37): UTMCoordinate {
  const centralMeridian = zone === 36 ? 33 : 39; // Zone 36 = 33E, Zone 37 = 39E
  const falseEasting = 500000;
  const falseNorthing = 10000000; // Southern hemisphere
  
  const easting = falseEasting + ((lng - centralMeridian) * 111320 * Math.cos(lat * Math.PI / 180));
  const northing = falseNorthing + (lat * 111320);
  
  return { easting, northing, zone };
}

/**
 * Convert an array of coordinates from UTM to WGS84
 */
export function convertCoordinatesFromUTM(
  coordinates: { lat: number; lng: number }[], 
  zone?: number
): Coordinate[] {
  return coordinates.map(coord => {
    // Determine which field is easting vs northing by magnitude
    // Easting: 100k-900k; Southern hemisphere northing: ~9.5M-10.5M
    let easting: number;
    let northing: number;
    if (coord.lat >= 9000000) {
      // lat field holds northing, lng field holds easting
      northing = coord.lat;
      easting = coord.lng;
    } else if (coord.lng >= 9000000) {
      // lng field holds northing, lat field holds easting
      easting = coord.lat;
      northing = coord.lng;
    } else {
      // Fallback: lng = easting, lat = northing (legacy assumption)
      easting = coord.lng;
      northing = coord.lat;
    }
    const detectedZone = zone || getUTMZone(easting < 400000 ? 33.5 : 39);
    return utmToWGS84(easting, northing, detectedZone);
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
