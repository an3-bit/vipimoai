/**
 * LayoutGenerator - "The Brain"
 * Implements the Spine & Ribs (Comb) algorithm for efficient
 * double-loaded road layouts
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, LineString, Position, FeatureCollection, Point } from 'geojson';
import type { FrontageResult, ParcelEdge } from './FrontageAnalyzer';

export interface PlotConfig {
  targetWidth: number;      // Target plot width in meters (e.g., 15m)
  targetDepth: number;      // Target plot depth in meters (e.g., 30m)
  minAreaRatio: number;     // Minimum area ratio to keep plot (e.g., 0.8 = 80%)
  accessRoadWidth: number;  // Internal road width (e.g., 9m)
  spineRoadWidth: number;   // Main spine road width (e.g., 12m)
  truncationSize: number;   // Corner truncation at intersections (e.g., 3m)
}

export interface GeneratedPlot {
  id: string;
  plotNumber: number;
  geometry: Feature<Polygon>;
  area: number;
  width: number;
  depth: number;
  isPartial: boolean;
  isTruncated: boolean;
  truncatedArea: number;
  row: number;
  column: number;
  facingRoad: 'frontage' | 'internal' | 'spine';
}

export interface RoadSegment {
  id: string;
  type: 'spine' | 'rib' | 'cul-de-sac';
  geometry: Feature<LineString>;
  width: number;
  servesPlots: string[]; // Plot IDs served by this road
}

export interface LayoutResult {
  plots: GeneratedPlot[];
  roads: RoadSegment[];
  spine: Feature<LineString> | null;
  statistics: {
    totalPlots: number;
    totalArea: number;
    plotArea: number;
    roadArea: number;
    efficiency: number; // Plot area / Total area
    averagePlotSize: number;
    partialPlots: number;
  };
}

const DEFAULT_CONFIG: PlotConfig = {
  targetWidth: 15,
  targetDepth: 30,
  minAreaRatio: 0.8,
  accessRoadWidth: 9,
  spineRoadWidth: 12,
  truncationSize: 3
};

/**
 * Rotates coordinates around a center point
 */
function rotateCoordinates(
  coords: Position[],
  angle: number,
  center: Position
): Position[] {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return coords.map(coord => {
    const dx = coord[0] - center[0];
    const dy = coord[1] - center[1];
    return [
      center[0] + dx * cos - dy * sin,
      center[1] + dx * sin + dy * cos
    ];
  });
}

/**
 * Creates a bounding box aligned to a specific angle
 */
function getAlignedBoundingBox(
  parcel: Feature<Polygon>,
  alignmentAngle: number
): { minX: number; maxX: number; minY: number; maxY: number; center: Position } {
  const centroid = turf.centroid(parcel);
  const center = centroid.geometry.coordinates;
  
  // Rotate parcel to align with grid
  const coords = parcel.geometry.coordinates[0];
  const rotated = rotateCoordinates(coords, -alignmentAngle, center);
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const coord of rotated) {
    minX = Math.min(minX, coord[0]);
    maxX = Math.max(maxX, coord[0]);
    minY = Math.min(minY, coord[1]);
    maxY = Math.max(maxY, coord[1]);
  }
  
  return { minX, maxX, minY, maxY, center };
}

/**
 * Converts meters to approximate degrees (for small distances)
 */
function metersToDegrees(meters: number, latitude: number = 0): number {
  return meters / (111320 * Math.cos((latitude * Math.PI) / 180));
}

/**
 * Creates a strip (band) of land
 */
function createStrip(
  startY: number,
  endY: number,
  minX: number,
  maxX: number,
  center: Position,
  alignmentAngle: number
): Feature<Polygon> {
  const coords: Position[] = [
    [minX, startY],
    [maxX, startY],
    [maxX, endY],
    [minX, endY],
    [minX, startY]
  ];
  
  // Rotate back to original orientation
  const rotatedBack = rotateCoordinates(coords, alignmentAngle, center);
  
  return turf.polygon([rotatedBack]);
}

/**
 * Slices a strip into individual plots (Bin Packing)
 */
function sliceStripIntoPlots(
  strip: Feature<Polygon>,
  parcel: Feature<Polygon>,
  plotWidth: number,
  row: number,
  config: PlotConfig,
  facingRoad: 'frontage' | 'internal' | 'spine'
): GeneratedPlot[] {
  const plots: GeneratedPlot[] = [];
  
  // Get strip bounds
  const bbox = turf.bbox(strip);
  const stripWidth = turf.distance(
    turf.point([bbox[0], bbox[1]]),
    turf.point([bbox[2], bbox[1]]),
    { units: 'meters' }
  );
  
  const numPlots = Math.floor(stripWidth / plotWidth);
  const remainder = stripWidth - (numPlots * plotWidth);
  
  // Calculate centroid for rotation reference
  const centroid = turf.centroid(strip);
  const stripCoords = strip.geometry.coordinates[0];
  
  // Get the bearing of the strip's first edge
  const bearing = turf.bearing(
    turf.point(stripCoords[0]),
    turf.point(stripCoords[1])
  );
  
  for (let i = 0; i < numPlots; i++) {
    try {
      // Create plot rectangle along the strip
      const plotStart = turf.along(
        turf.lineString([stripCoords[0], stripCoords[1]]),
        i * plotWidth,
        { units: 'meters' }
      );
      
      const plotEnd = turf.along(
        turf.lineString([stripCoords[0], stripCoords[1]]),
        (i + 1) * plotWidth,
        { units: 'meters' }
      );
      
      // Calculate perpendicular direction for depth
      const perpBearing = bearing + 90;
      const depth = config.targetDepth;
      
      const corner1 = plotStart.geometry.coordinates;
      const corner2 = plotEnd.geometry.coordinates;
      const corner3 = turf.destination(turf.point(corner2), depth / 1000, perpBearing).geometry.coordinates;
      const corner4 = turf.destination(turf.point(corner1), depth / 1000, perpBearing).geometry.coordinates;
      
      let plotPolygon = turf.polygon([[corner1, corner2, corner3, corner4, corner1]]);
      
      // Clip plot against parcel boundary
      const clipped = turf.intersect(turf.featureCollection([plotPolygon, parcel]));
      
      if (clipped && clipped.geometry.type === 'Polygon') {
        plotPolygon = clipped as Feature<Polygon>;
        const area = turf.area(plotPolygon);
        const targetArea = plotWidth * depth;
        const areaRatio = area / targetArea;
        
        // Only keep if meets minimum area threshold
        if (areaRatio >= config.minAreaRatio) {
          plots.push({
            id: `plot-${row}-${i}`,
            plotNumber: plots.length + 1,
            geometry: plotPolygon,
            area,
            width: plotWidth,
            depth,
            isPartial: areaRatio < 1,
            isTruncated: false,
            truncatedArea: 0,
            row,
            column: i,
            facingRoad
          });
        }
      }
    } catch (e) {
      // Skip invalid plot geometry
      continue;
    }
  }
  
  return plots;
}

/**
 * Applies truncation to corner plots at intersections
 */
function applyTruncation(
  plot: GeneratedPlot,
  truncationSize: number,
  isCorner: boolean
): GeneratedPlot {
  if (!isCorner) return plot;
  
  try {
    // Simple truncation: buffer inward slightly at corners
    const buffered = turf.buffer(plot.geometry, -truncationSize / 1000, { units: 'kilometers' });
    
    if (buffered && buffered.geometry.type === 'Polygon') {
      const truncatedArea = turf.area(plot.geometry) - turf.area(buffered);
      
      return {
        ...plot,
        geometry: buffered as Feature<Polygon>,
        area: turf.area(buffered),
        isTruncated: true,
        truncatedArea
      };
    }
  } catch (e) {
    // Return original if truncation fails
  }
  
  return plot;
}

/**
 * Creates a cul-de-sac (turning head) at road end
 */
function createCulDeSac(
  roadEnd: Position,
  bearing: number,
  radius: number = 15
): Feature<Polygon> {
  const center = turf.destination(turf.point(roadEnd), radius / 1000, bearing);
  return turf.circle(center.geometry.coordinates, radius / 1000, { units: 'kilometers' });
}

/**
 * Creates the spine road running perpendicular from access edge
 */
function createSpineRoad(
  frontage: FrontageResult,
  parcel: Feature<Polygon>,
  config: PlotConfig
): RoadSegment | null {
  if (!frontage.primaryEdge) return null;
  
  const edge = frontage.primaryEdge;
  const midpoint = edge.midpoint;
  
  // Calculate perpendicular bearing (into the parcel)
  const edgeBearing = edge.bearing;
  const spineBearing = edgeBearing + 90; // Perpendicular
  
  // Find the furthest point in the parcel along the spine direction
  const bbox = turf.bbox(parcel);
  const maxDistance = turf.distance(
    turf.point([bbox[0], bbox[1]]),
    turf.point([bbox[2], bbox[3]]),
    { units: 'meters' }
  );
  
  // Create spine line from frontage midpoint into parcel
  const spineEnd = turf.destination(
    turf.point(midpoint),
    maxDistance / 1000,
    spineBearing
  );
  
  let spineLine = turf.lineString([midpoint, spineEnd.geometry.coordinates]);
  
  // Clip spine to parcel boundary
  try {
    const clipped = turf.lineIntersect(spineLine, turf.polygonToLine(parcel));
    if (clipped.features.length >= 2) {
      const points = clipped.features.map(f => f.geometry.coordinates);
      spineLine = turf.lineString([midpoint, points[points.length - 1]]);
    }
  } catch (e) {
    // Use original spine line
  }
  
  return {
    id: 'spine-main',
    type: 'spine',
    geometry: spineLine,
    width: config.spineRoadWidth,
    servesPlots: []
  };
}

/**
 * Main layout generation function - implements Spine & Ribs algorithm
 */
export function generateLayout(
  parcel: Feature<Polygon>,
  frontage: FrontageResult,
  config: Partial<PlotConfig> = {}
): LayoutResult {
  const cfg: PlotConfig = { ...DEFAULT_CONFIG, ...config };
  
  const plots: GeneratedPlot[] = [];
  const roads: RoadSegment[] = [];
  
  // Step A: Determine alignment from frontage analysis
  const alignmentAngle = frontage.alignmentAngle;
  
  // Get aligned bounding box
  const bbox = getAlignedBoundingBox(parcel, alignmentAngle);
  const parcelArea = turf.area(parcel);
  
  // Step B: Generate the "Comb" pattern
  // Pattern: Plot -> Plot -> Road -> Plot -> Plot -> Road ...
  
  const centroid = turf.centroid(parcel);
  const centerLat = centroid.geometry.coordinates[1];
  
  // Convert dimensions to degrees for grid generation
  const plotDepthDeg = metersToDegrees(cfg.targetDepth, centerLat);
  const roadWidthDeg = metersToDegrees(cfg.accessRoadWidth, centerLat);
  const plotWidthDeg = metersToDegrees(cfg.targetWidth, centerLat);
  
  // Calculate strip pattern
  const bandPattern = [
    { type: 'plot' as const, depth: cfg.targetDepth },
    { type: 'plot' as const, depth: cfg.targetDepth },
    { type: 'road' as const, depth: cfg.accessRoadWidth }
  ];
  
  // Calculate total depth available
  const parcelDepth = (bbox.maxY - bbox.minY) * 111320; // Approximate meters
  
  let currentY = bbox.minY;
  let bandIndex = 0;
  let rowNumber = 0;
  let ribNumber = 0;
  
  // Special case: Frontage row (no road buffer if PRIMARY_ACCESS)
  if (frontage.status === 'PRIMARY_ACCESS' && frontage.primaryEdge) {
    // First row of plots faces directly onto existing road
    const frontageDepth = metersToDegrees(cfg.targetDepth, centerLat);
    
    try {
      const frontageStrip = createStrip(
        currentY,
        currentY + frontageDepth,
        bbox.minX,
        bbox.maxX,
        bbox.center,
        alignmentAngle
      );
      
      const frontageClipped = turf.intersect(turf.featureCollection([frontageStrip, parcel]));
      
      if (frontageClipped && frontageClipped.geometry.type === 'Polygon') {
        const frontPlots = sliceStripIntoPlots(
          frontageClipped as Feature<Polygon>,
          parcel,
          cfg.targetWidth,
          rowNumber,
          cfg,
          'frontage'
        );
        plots.push(...frontPlots);
        rowNumber++;
      }
    } catch (e) {
      // Skip frontage strip on error
    }
    
    currentY += frontageDepth;
  } else {
    // Landlocked: Create spine road first
    const spineRoad = createSpineRoad(frontage, parcel, cfg);
    if (spineRoad) {
      roads.push(spineRoad);
    }
    
    // Add spine road buffer
    currentY += metersToDegrees(cfg.spineRoadWidth / 2, centerLat);
  }
  
  // Generate remaining strips using double-loaded pattern
  while (currentY < bbox.maxY) {
    const band = bandPattern[bandIndex % bandPattern.length];
    const bandDepth = metersToDegrees(band.depth, centerLat);
    
    if (currentY + bandDepth > bbox.maxY) break;
    
    if (band.type === 'plot') {
      try {
        const strip = createStrip(
          currentY,
          currentY + bandDepth,
          bbox.minX,
          bbox.maxX,
          bbox.center,
          alignmentAngle
        );
        
        const clipped = turf.intersect(turf.featureCollection([strip, parcel]));
        
        if (clipped && clipped.geometry.type === 'Polygon') {
          const stripPlots = sliceStripIntoPlots(
            clipped as Feature<Polygon>,
            parcel,
            cfg.targetWidth,
            rowNumber,
            cfg,
            'internal'
          );
          
          // Apply truncation to corner plots (first and last in row)
          if (stripPlots.length > 0) {
            stripPlots[0] = applyTruncation(stripPlots[0], cfg.truncationSize, true);
            if (stripPlots.length > 1) {
              stripPlots[stripPlots.length - 1] = applyTruncation(
                stripPlots[stripPlots.length - 1],
                cfg.truncationSize,
                true
              );
            }
          }
          
          plots.push(...stripPlots);
          rowNumber++;
        }
      } catch (e) {
        // Skip strip on error
      }
    } else if (band.type === 'road') {
      // Create rib road
      try {
        const roadMidY = currentY + bandDepth / 2;
        const roadLine = createStrip(
          roadMidY - bandDepth / 200,
          roadMidY + bandDepth / 200,
          bbox.minX,
          bbox.maxX,
          bbox.center,
          alignmentAngle
        );
        
        const roadCoords = roadLine.geometry.coordinates[0];
        const ribRoad = turf.lineString([
          roadCoords[0],
          roadCoords[1]
        ]);
        
        roads.push({
          id: `rib-${ribNumber}`,
          type: 'rib',
          geometry: ribRoad,
          width: cfg.accessRoadWidth,
          servesPlots: plots.filter(p => p.row === rowNumber - 1 || p.row === rowNumber).map(p => p.id)
        });
        
        ribNumber++;
      } catch (e) {
        // Skip road on error
      }
    }
    
    currentY += bandDepth;
    bandIndex++;
  }
  
  // Renumber plots sequentially
  plots.forEach((plot, index) => {
    plot.plotNumber = index + 1;
    plot.id = `plot-${index + 1}`;
  });
  
  // Calculate statistics
  const totalPlotArea = plots.reduce((sum, p) => sum + p.area, 0);
  const totalRoadArea = roads.reduce((sum, r) => {
    const length = turf.length(r.geometry, { units: 'meters' });
    return sum + (length * r.width);
  }, 0);
  
  // Find spine for visualization
  const spine = roads.find(r => r.type === 'spine')?.geometry || null;
  
  return {
    plots,
    roads,
    spine,
    statistics: {
      totalPlots: plots.length,
      totalArea: parcelArea,
      plotArea: totalPlotArea,
      roadArea: totalRoadArea,
      efficiency: (totalPlotArea / parcelArea) * 100,
      averagePlotSize: totalPlotArea / plots.length || 0,
      partialPlots: plots.filter(p => p.isPartial).length
    }
  };
}

/**
 * Creates visual representation of road network
 */
export function createRoadVisualization(
  roads: RoadSegment[]
): FeatureCollection<LineString> {
  return turf.featureCollection(
    roads.map(road => ({
      ...road.geometry,
      properties: {
        ...road.geometry.properties,
        id: road.id,
        type: road.type,
        width: road.width,
        color: road.type === 'spine' ? '#3B82F6' : '#6B7280' // Blue for spine, gray for ribs
      }
    }))
  );
}
