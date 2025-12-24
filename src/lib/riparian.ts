import * as turf from '@turf/turf';
import { Coordinate } from '@/types/survey';

export interface RiparianZone {
  id: string;
  riverLine: Coordinate[];
  bufferPolygon: Coordinate[];
  bufferDistance: number; // in meters
}

/**
 * Create a 30m buffer zone around a river line
 * Returns the buffer polygon coordinates
 */
export function createRiparianBuffer(
  riverLine: Coordinate[], 
  bufferDistance: number = 30
): Coordinate[] {
  if (riverLine.length < 2) {
    console.warn('River line must have at least 2 points');
    return [];
  }

  try {
    // Convert to GeoJSON LineString
    const lineCoords = riverLine.map(c => [c.lng, c.lat]);
    const line = turf.lineString(lineCoords);
    
    // Create buffer (distance in kilometers for turf)
    const bufferKm = bufferDistance / 1000;
    const buffered = turf.buffer(line, bufferKm, { units: 'kilometers' });
    
    if (!buffered || !buffered.geometry) {
      console.warn('Failed to create buffer');
      return [];
    }

    // Extract coordinates from buffer polygon
    const bufferCoords = buffered.geometry.coordinates[0] as number[][];
    
    return bufferCoords.map(([lng, lat]) => ({ lat, lng }));
  } catch (error) {
    console.error('Error creating riparian buffer:', error);
    return [];
  }
}

/**
 * Check if a plot polygon overlaps with the riparian buffer zone
 * Returns true if there is ANY overlap (plot is invalid)
 */
export function checkPlotRiparianOverlap(
  plotCoordinates: Coordinate[],
  riparianBuffer: Coordinate[]
): boolean {
  if (plotCoordinates.length < 3 || riparianBuffer.length < 3) {
    return false;
  }

  try {
    // Convert to GeoJSON Polygons
    const plotCoords = [...plotCoordinates.map(c => [c.lng, c.lat])];
    // Close the polygon if not already closed
    if (plotCoords[0][0] !== plotCoords[plotCoords.length - 1][0] || 
        plotCoords[0][1] !== plotCoords[plotCoords.length - 1][1]) {
      plotCoords.push(plotCoords[0]);
    }
    
    const bufferCoords = [...riparianBuffer.map(c => [c.lng, c.lat])];
    if (bufferCoords[0][0] !== bufferCoords[bufferCoords.length - 1][0] || 
        bufferCoords[0][1] !== bufferCoords[bufferCoords.length - 1][1]) {
      bufferCoords.push(bufferCoords[0]);
    }

    const plotPolygon = turf.polygon([plotCoords]);
    const bufferPolygon = turf.polygon([bufferCoords]);

    // Check for intersection
    const intersection = turf.intersect(
      turf.featureCollection([plotPolygon, bufferPolygon])
    );
    
    return intersection !== null;
  } catch (error) {
    console.error('Error checking riparian overlap:', error);
    return false;
  }
}

/**
 * Check if a plot is completely within the riparian buffer (fully invalid)
 */
export function isPlotFullyInRiparian(
  plotCoordinates: Coordinate[],
  riparianBuffer: Coordinate[]
): boolean {
  if (plotCoordinates.length < 3 || riparianBuffer.length < 3) {
    return false;
  }

  try {
    const plotCoords = [...plotCoordinates.map(c => [c.lng, c.lat]), [plotCoordinates[0].lng, plotCoordinates[0].lat]];
    const bufferCoords = [...riparianBuffer.map(c => [c.lng, c.lat]), [riparianBuffer[0].lng, riparianBuffer[0].lat]];

    const plotPolygon = turf.polygon([plotCoords]);
    const bufferPolygon = turf.polygon([bufferCoords]);

    return turf.booleanWithin(plotPolygon, bufferPolygon);
  } catch (error) {
    console.error('Error checking if plot is within riparian:', error);
    return false;
  }
}

/**
 * Calculate the percentage of plot area that overlaps with riparian zone
 */
export function calculateOverlapPercentage(
  plotCoordinates: Coordinate[],
  riparianBuffer: Coordinate[]
): number {
  if (plotCoordinates.length < 3 || riparianBuffer.length < 3) {
    return 0;
  }

  try {
    const plotCoords = [...plotCoordinates.map(c => [c.lng, c.lat]), [plotCoordinates[0].lng, plotCoordinates[0].lat]];
    const bufferCoords = [...riparianBuffer.map(c => [c.lng, c.lat]), [riparianBuffer[0].lng, riparianBuffer[0].lat]];

    const plotPolygon = turf.polygon([plotCoords]);
    const bufferPolygon = turf.polygon([bufferCoords]);

    const intersection = turf.intersect(
      turf.featureCollection([plotPolygon, bufferPolygon])
    );

    if (!intersection) {
      return 0;
    }

    const plotArea = turf.area(plotPolygon);
    const overlapArea = turf.area(intersection);

    return (overlapArea / plotArea) * 100;
  } catch (error) {
    console.error('Error calculating overlap percentage:', error);
    return 0;
  }
}

/**
 * Filter plots to exclude those that overlap with riparian zone
 * Returns: { validPlots, invalidPlots }
 */
export function filterPlotsByRiparian(
  plots: Coordinate[][],
  riparianBuffer: Coordinate[]
): {
  validPlots: { coordinates: Coordinate[]; index: number }[];
  invalidPlots: { coordinates: Coordinate[]; index: number; overlapPercent: number }[];
} {
  const validPlots: { coordinates: Coordinate[]; index: number }[] = [];
  const invalidPlots: { coordinates: Coordinate[]; index: number; overlapPercent: number }[] = [];

  if (riparianBuffer.length < 3) {
    // No riparian zone defined, all plots are valid
    return {
      validPlots: plots.map((coords, index) => ({ coordinates: coords, index })),
      invalidPlots: [],
    };
  }

  plots.forEach((plotCoords, index) => {
    const overlaps = checkPlotRiparianOverlap(plotCoords, riparianBuffer);
    
    if (overlaps) {
      const overlapPercent = calculateOverlapPercentage(plotCoords, riparianBuffer);
      invalidPlots.push({ coordinates: plotCoords, index, overlapPercent });
    } else {
      validPlots.push({ coordinates: plotCoords, index });
    }
  });

  return { validPlots, invalidPlots };
}

/**
 * Calculate area of a polygon using Turf.js
 */
export function calculatePolygonAreaTurf(coordinates: Coordinate[]): number {
  if (coordinates.length < 3) return 0;

  try {
    const coords = [...coordinates.map(c => [c.lng, c.lat]), [coordinates[0].lng, coordinates[0].lat]];
    const polygon = turf.polygon([coords]);
    return turf.area(polygon); // Returns area in square meters
  } catch (error) {
    console.error('Error calculating polygon area:', error);
    return 0;
  }
}
