import { Coordinate } from '@/types/survey';

export interface DXFParseResult {
  success: boolean;
  coordinates: Coordinate[];
  entityCount: number;
  entityTypes: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Parse DXF file content and extract coordinates
 * Supports POINT, LINE, POLYLINE, LWPOLYLINE entities
 */
export function parseDXF(content: string): DXFParseResult {
  const result: DXFParseResult = {
    success: false,
    coordinates: [],
    entityCount: 0,
    entityTypes: [],
    errors: [],
    warnings: [],
  };

  try {
    const lines = content.split(/\r?\n/);
    const coordinates: Coordinate[] = [];
    const entityTypes = new Set<string>();
    
    let inEntities = false;
    let currentEntity: string | null = null;
    let xCoord: number | null = null;
    let yCoord: number | null = null;
    let polylineVertices: { x: number; y: number }[] = [];
    let inPolyline = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const nextLine = lines[i + 1]?.trim();

      // Check for ENTITIES section
      if (line === 'ENTITIES') {
        inEntities = true;
        continue;
      }

      // Check for end of ENTITIES section
      if (line === 'ENDSEC' && inEntities) {
        inEntities = false;
        // Save any remaining polyline vertices
        if (inPolyline && polylineVertices.length > 0) {
          polylineVertices.forEach(v => {
            coordinates.push(processCoordinate(v.x, v.y));
          });
        }
        continue;
      }

      if (!inEntities) continue;

      // Detect entity types
      if (line === '0' && nextLine) {
        const entityType = nextLine.toUpperCase();
        
        // Save previous polyline vertices
        if (inPolyline && polylineVertices.length > 0 && entityType !== 'VERTEX') {
          polylineVertices.forEach(v => {
            coordinates.push(processCoordinate(v.x, v.y));
          });
          polylineVertices = [];
          inPolyline = false;
        }

        if (['POINT', 'LINE', 'POLYLINE', 'LWPOLYLINE', 'VERTEX'].includes(entityType)) {
          currentEntity = entityType;
          entityTypes.add(entityType);
          result.entityCount++;
          
          if (entityType === 'POLYLINE' || entityType === 'LWPOLYLINE') {
            inPolyline = true;
            polylineVertices = [];
          }
        }
        i++; // Skip the entity name line
        continue;
      }

      // Parse coordinate group codes
      // 10, 20, 30 = X, Y, Z for primary point
      // 11, 21, 31 = X, Y, Z for second point (LINE entities)
      if (line === '10' && nextLine) {
        xCoord = parseFloat(nextLine);
        i++;
      } else if (line === '20' && nextLine) {
        yCoord = parseFloat(nextLine);
        i++;
        
        // We have both X and Y, save the coordinate
        if (xCoord !== null && yCoord !== null) {
          if (inPolyline) {
            polylineVertices.push({ x: xCoord, y: yCoord });
          } else {
            coordinates.push(processCoordinate(xCoord, yCoord));
          }
          xCoord = null;
          yCoord = null;
        }
      } else if (line === '11' && nextLine) {
        // Second point of LINE entity
        xCoord = parseFloat(nextLine);
        i++;
      } else if (line === '21' && nextLine) {
        yCoord = parseFloat(nextLine);
        i++;
        
        if (xCoord !== null && yCoord !== null) {
          coordinates.push(processCoordinate(xCoord, yCoord));
          xCoord = null;
          yCoord = null;
        }
      }
    }

    // Remove duplicate coordinates
    const uniqueCoords = removeDuplicateCoordinates(coordinates);

    result.coordinates = uniqueCoords;
    result.entityTypes = Array.from(entityTypes);
    result.success = uniqueCoords.length > 0;

    if (uniqueCoords.length === 0) {
      result.errors.push('No valid coordinates found in DXF file');
    }

    if (uniqueCoords.length < coordinates.length) {
      result.warnings.push(`Removed ${coordinates.length - uniqueCoords.length} duplicate coordinates`);
    }

  } catch (error) {
    result.errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Process a coordinate - detect if it's UTM or lat/lng
 */
function processCoordinate(x: number, y: number): Coordinate {
  // DXF files typically store X (Easting) and Y (Northing)
  // We'll store them as lat/lng and let the CRS detection handle conversion
  
  // Check if these are likely UTM coordinates (large numbers)
  if (Math.abs(x) > 1000 && Math.abs(y) > 1000) {
    // Store as Easting (x -> lng), Northing (y -> lat) for later UTM conversion
    return { lat: y, lng: x };
  }
  
  // If small numbers, assume lat/lng (though unusual in DXF)
  return { lat: y, lng: x };
}

/**
 * Remove duplicate coordinates (within tolerance)
 */
function removeDuplicateCoordinates(coordinates: Coordinate[], tolerance: number = 0.000001): Coordinate[] {
  const unique: Coordinate[] = [];
  
  for (const coord of coordinates) {
    const isDuplicate = unique.some(existing => 
      Math.abs(existing.lat - coord.lat) < tolerance && 
      Math.abs(existing.lng - coord.lng) < tolerance
    );
    
    if (!isDuplicate) {
      unique.push(coord);
    }
  }
  
  return unique;
}

/**
 * Validate DXF file structure
 */
export function validateDXFFile(content: string): { valid: boolean; message: string } {
  const trimmed = content.trim();
  
  // Check for basic DXF markers
  if (!trimmed.includes('SECTION') && !trimmed.includes('ENTITIES')) {
    return {
      valid: false,
      message: 'File does not appear to be a valid DXF format. Missing SECTION or ENTITIES markers.',
    };
  }

  // Check for coordinate group codes
  if (!trimmed.includes('\n10\n') && !trimmed.includes('\r\n10\r\n')) {
    return {
      valid: false,
      message: 'No coordinate data found in DXF file. Missing group code 10 (X coordinates).',
    };
  }

  return { valid: true, message: 'DXF file structure appears valid' };
}

/**
 * Extract boundary polygon from DXF (first closed polyline or connect points)
 */
export function extractBoundaryFromDXF(content: string): Coordinate[] {
  const result = parseDXF(content);
  
  if (!result.success || result.coordinates.length < 3) {
    return [];
  }

  // If we have a closed polygon (first and last point are same), remove the duplicate
  const coords = result.coordinates;
  const first = coords[0];
  const last = coords[coords.length - 1];
  
  const tolerance = 0.0001;
  if (Math.abs(first.lat - last.lat) < tolerance && Math.abs(first.lng - last.lng) < tolerance) {
    return coords.slice(0, -1);
  }

  return coords;
}
