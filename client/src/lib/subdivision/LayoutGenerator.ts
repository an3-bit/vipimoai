/**
 * LayoutGenerator - "The Brain"
 * Implements the Smart Mesh algorithm for efficient subdivision:
 * - Double-loaded road layouts (Spine & Ribs)
 * - Residual plot handling (no gaps!)
 * - Constraint-aware mesh slicing
 * - Plot merging for undersized parcels
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, LineString, Position, FeatureCollection, MultiPolygon } from 'geojson';
import type { FrontageResult, ParcelEdge } from './FrontageAnalyzer';

export interface PlotConfig {
  targetWidth: number;      // Target plot width in meters (e.g., 15m)
  targetDepth: number;      // Target plot depth in meters (e.g., 30m)
  minAreaRatio: number;     // Minimum area ratio to keep plot (e.g., 0.8 = 80%)
  minResidualArea: number;  // Minimum area for residual plot before merge (sqm)
  accessRoadWidth: number;  // Internal road width (e.g., 9m)
  spineRoadWidth: number;   // Main spine road width (e.g., 12m)
  truncationSize: number;   // Corner truncation at intersections (e.g., 3m)
  culDeSacRadius: number;   // Turning head radius (e.g., 15m)
}

export interface GeneratedPlot {
  id: string;
  plotNumber: number;
  label: string; // e.g., "Plot 1" or "Residual A"
  geometry: Feature<Polygon>;
  area: number;
  width: number;
  depth: number;
  isPartial: boolean;
  isResidual: boolean;
  isTruncated: boolean;
  truncatedArea: number;
  row: number;
  column: number;
  facingRoad: 'frontage' | 'internal' | 'spine';
  mergedFrom?: string[]; // IDs of plots merged into this one
}

export interface RoadSegment {
  id: string;
  type: 'spine' | 'rib' | 'cul-de-sac';
  geometry: Feature<LineString | Polygon>;
  width: number;
  servesPlots: string[];
}

export interface LayoutResult {
  plots: GeneratedPlot[];
  roads: RoadSegment[];
  spine: Feature<LineString> | null;
  residuals: GeneratedPlot[];
  statistics: {
    totalPlots: number;
    standardPlots: number;
    residualPlots: number;
    mergedPlots: number;
    totalArea: number;
    plotArea: number;
    roadArea: number;
    efficiency: number;
    averagePlotSize: number;
    partialPlots: number;
  };
}

const DEFAULT_CONFIG: PlotConfig = {
  targetWidth: 15,
  targetDepth: 30,
  minAreaRatio: 0.8,
  minResidualArea: 200, // 0.02 Ha = 200 sqm
  accessRoadWidth: 9,
  spineRoadWidth: 12,
  truncationSize: 3,
  culDeSacRadius: 15
};

// 1 acre = 4046.86 sqm
const ONE_ACRE_SQM = 4046.86;

/**
 * Finds the longest straight edge of a polygon for optimal grid alignment
 */
function findLongestEdge(parcel: Feature<Polygon | MultiPolygon>): { bearing: number; length: number; midpoint: Position } {
  let coords: Position[];
  
  if (parcel.geometry.type === 'MultiPolygon') {
    // For MultiPolygon, find the largest polygon and use its edges
    let maxArea = 0;
    coords = parcel.geometry.coordinates[0][0];
    for (const poly of parcel.geometry.coordinates) {
      const polyFeature = turf.polygon(poly);
      const area = turf.area(polyFeature);
      if (area > maxArea) {
        maxArea = area;
        coords = poly[0];
      }
    }
  } else {
    coords = parcel.geometry.coordinates[0];
  }
  
  let longestEdge = { bearing: 0, length: 0, midpoint: [0, 0] as Position };
  
  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    const lineString = turf.lineString([start, end]);
    const length = turf.length(lineString, { units: 'meters' });
    
    if (length > longestEdge.length) {
      longestEdge = {
        bearing: turf.bearing(turf.point(start), turf.point(end)),
        length,
        midpoint: turf.midpoint(turf.point(start), turf.point(end)).geometry.coordinates
      };
    }
  }
  
  return longestEdge;
}

/**
 * Converts meters to approximate degrees at given latitude
 */
function metersToDegrees(meters: number, latitude: number = 0): number {
  return meters / (111320 * Math.cos((latitude * Math.PI) / 180));
}

/**
 * Converts degrees to meters at given latitude
 */
function degreesToMeters(degrees: number, latitude: number = 0): number {
  return degrees * 111320 * Math.cos((latitude * Math.PI) / 180);
}

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
  parcel: Feature<Polygon | MultiPolygon>,
  alignmentAngle: number
): { minX: number; maxX: number; minY: number; maxY: number; center: Position } {
  const centroid = turf.centroid(parcel);
  const center = centroid.geometry.coordinates;
  
  // Get all coordinates from polygon or multipolygon
  let coords: Position[];
  if (parcel.geometry.type === 'MultiPolygon') {
    coords = parcel.geometry.coordinates.flat(2);
  } else {
    coords = parcel.geometry.coordinates[0];
  }
  
  // Rotate coordinates to align with grid
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
 * Creates a rectangular strip of land
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
  
  const rotatedBack = rotateCoordinates(coords, alignmentAngle, center);
  return turf.polygon([rotatedBack]);
}

/**
 * Creates a single plot rectangle
 */
function createPlotRectangle(
  startX: number,
  endX: number,
  startY: number,
  endY: number,
  center: Position,
  alignmentAngle: number
): Feature<Polygon> {
  const coords: Position[] = [
    [startX, startY],
    [endX, startY],
    [endX, endY],
    [startX, endY],
    [startX, startY]
  ];
  
  const rotatedBack = rotateCoordinates(coords, alignmentAngle, center);
  return turf.polygon([rotatedBack]);
}

/**
 * Clips a plot polygon against the developable area boundary
 * Returns null if the result is invalid or too small
 */
function clipPlotToBoundary(
  plot: Feature<Polygon>,
  boundary: Feature<Polygon | MultiPolygon>
): Feature<Polygon> | null {
  try {
    const intersection = turf.intersect(turf.featureCollection([plot, boundary as Feature<Polygon>]));
    
    if (!intersection) return null;
    
    // Handle multipolygon results - take largest piece
    if (intersection.geometry.type === 'MultiPolygon') {
      const polygons = intersection.geometry.coordinates.map(coords => 
        turf.polygon(coords)
      );
      const largest = polygons.reduce((max, p) => 
        turf.area(p) > turf.area(max) ? p : max
      );
      return largest;
    }
    
    return intersection as Feature<Polygon>;
  } catch (e) {
    return null;
  }
}

/**
 * Generates a residual plot label (A, B, C, ...)
 */
function getResidualLabel(index: number): string {
  return String.fromCharCode(65 + (index % 26)); // A, B, C, ...
}

/**
 * Merges a small plot into its neighbor
 */
function mergePlots(
  smallPlot: GeneratedPlot,
  neighborPlot: GeneratedPlot
): GeneratedPlot {
  try {
    const merged = turf.union(turf.featureCollection([smallPlot.geometry, neighborPlot.geometry]));
    
    if (merged && merged.geometry.type === 'Polygon') {
      return {
        ...neighborPlot,
        geometry: merged as Feature<Polygon>,
        area: turf.area(merged),
        isPartial: true,
        mergedFrom: [smallPlot.id, ...(neighborPlot.mergedFrom || [])]
      };
    }
  } catch (e) {
    // Return neighbor unchanged
  }
  
  return neighborPlot;
}

/**
 * Applies corner truncation to a plot at road intersections
 */
function applyTruncation(
  plot: GeneratedPlot,
  truncationSize: number
): GeneratedPlot {
  try {
    // Create truncation by buffering inward
    const buffered = turf.buffer(plot.geometry, -truncationSize / 2, { units: 'meters' });
    
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
    // Return original
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
  const center = turf.destination(turf.point(roadEnd), radius / 2000, bearing);
  return turf.circle(center.geometry.coordinates, radius / 1000, { units: 'kilometers', steps: 32 });
}

/**
 * Creates the spine road perpendicular from access edge
 */
function createSpineRoad(
  frontage: FrontageResult,
  developableArea: Feature<Polygon | MultiPolygon>,
  config: PlotConfig
): { road: RoadSegment | null; spine: Feature<LineString> | null } {
  if (!frontage.primaryEdge) return { road: null, spine: null };
  
  const edge = frontage.primaryEdge;
  const midpoint = edge.midpoint;
  
  // Perpendicular bearing into the parcel
  const spineBearing = edge.bearing + 90;
  
  // Find max distance across parcel
  const bbox = turf.bbox(developableArea);
  const maxDistance = turf.distance(
    turf.point([bbox[0], bbox[1]]),
    turf.point([bbox[2], bbox[3]]),
    { units: 'meters' }
  ) * 1.5;
  
  // Create spine line
  const spineEnd = turf.destination(
    turf.point(midpoint),
    maxDistance / 1000,
    spineBearing
  );
  
  let spineLine = turf.lineString([midpoint, spineEnd.geometry.coordinates]);
  
  // Clip to parcel boundary
  try {
    const parcelLine = turf.polygonToLine(developableArea);
    const intersections = turf.lineIntersect(spineLine, parcelLine as Feature<LineString>);
    
    if (intersections.features.length > 0) {
      // Find furthest intersection point
      let maxDist = 0;
      let furthestPoint = spineEnd.geometry.coordinates;
      
      for (const pt of intersections.features) {
        const dist = turf.distance(turf.point(midpoint), pt, { units: 'meters' });
        if (dist > maxDist) {
          maxDist = dist;
          furthestPoint = pt.geometry.coordinates;
        }
      }
      
      spineLine = turf.lineString([midpoint, furthestPoint]);
    }
  } catch (e) {
    // Use original
  }
  
  const road: RoadSegment = {
    id: 'spine-main',
    type: 'spine',
    geometry: spineLine,
    width: config.spineRoadWidth,
    servesPlots: []
  };
  
  return { road, spine: spineLine };
}

/**
 * SUPER-GRID STRATEGY: Generate plots over expanded bounding box, then filter
 * This ensures maximum coverage rather than grid floating inside polygon
 */
function generateSuperGrid(
  developableArea: Feature<Polygon | MultiPolygon>,
  bbox: { minX: number; maxX: number; minY: number; maxY: number; center: Position },
  startY: number,
  endY: number,
  plotWidth: number,
  row: number,
  config: PlotConfig,
  facingRoad: 'frontage' | 'internal' | 'spine',
  alignmentAngle: number,
  centerLat: number
): GeneratedPlot[] {
  const plots: GeneratedPlot[] = [];
  const plotWidthDeg = metersToDegrees(plotWidth, centerLat);
  
  // SUPER-GRID: Pad bounding box by 20% to ensure full coverage
  const paddingX = (bbox.maxX - bbox.minX) * 0.2;
  const expandedMinX = bbox.minX - paddingX;
  const expandedMaxX = bbox.maxX + paddingX;
  
  let currentX = expandedMinX;
  let column = 0;
  
  while (currentX < expandedMaxX) {
    const nextX = currentX + plotWidthDeg;
    
    // Create plot rectangle
    const plotRect = createPlotRectangle(
      currentX,
      Math.min(nextX, expandedMaxX),
      startY,
      endY,
      bbox.center,
      alignmentAngle
    );
    
    // Step 1: Check if fully contained (best case)
    let clippedPlot: Feature<Polygon> | null = null;
    let isFullyContained = false;
    
    try {
      isFullyContained = turf.booleanContains(developableArea, plotRect);
      if (isFullyContained) {
        clippedPlot = plotRect;
      }
    } catch (e) {
      // Fall through to intersection check
    }
    
    // Step 2: If not fully contained, try intersection
    if (!clippedPlot) {
      clippedPlot = clipPlotToBoundary(plotRect, developableArea);
    }
    
    if (clippedPlot) {
      const area = turf.area(clippedPlot);
      const targetArea = plotWidth * config.targetDepth;
      const areaRatio = area / targetArea;
      
      // Calculate actual dimensions
      const plotBbox = turf.bbox(clippedPlot);
      const actualWidth = degreesToMeters(plotBbox[2] - plotBbox[0], centerLat);
      const actualDepth = degreesToMeters(plotBbox[3] - plotBbox[1], centerLat);
      
      // CRITICAL UPDATE: Keep if area >= 80% of target OR if it's a valid residual
      const isResidual = areaRatio < config.minAreaRatio;
      const keepPlot = areaRatio >= config.minAreaRatio || (isResidual && area >= config.minResidualArea);
      
      if (keepPlot) {
        plots.push({
          id: `plot-${row}-${column}`,
          plotNumber: 0, // Will be assigned later
          label: isResidual ? `Residual ${getResidualLabel(column)}` : `Plot ${column + 1}`,
          geometry: clippedPlot,
          area,
          width: actualWidth,
          depth: actualDepth,
          isPartial: areaRatio < 1,
          isResidual,
          isTruncated: false,
          truncatedArea: 0,
          row,
          column,
          facingRoad
        });
      }
    }
    
    currentX = nextX;
    column++;
  }
  
  return plots;
}

/**
 * Merges undersized residual plots with neighbors
 */
function mergeResidualPlots(
  plots: GeneratedPlot[],
  minArea: number
): GeneratedPlot[] {
  const result: GeneratedPlot[] = [];
  const toMerge: GeneratedPlot[] = [];
  
  // Separate standard plots from tiny residuals
  for (const plot of plots) {
    if (plot.area < minArea && !plot.isResidual) {
      toMerge.push(plot);
    } else {
      result.push(plot);
    }
  }
  
  // Merge tiny plots into neighbors
  for (const small of toMerge) {
    // Find adjacent neighbor in same row
    const neighbor = result.find(p => 
      p.row === small.row && 
      Math.abs(p.column - small.column) === 1
    );
    
    if (neighbor) {
      const idx = result.indexOf(neighbor);
      result[idx] = mergePlots(small, neighbor);
    } else {
      // Keep as residual if no neighbor
      result.push({
        ...small,
        isResidual: true,
        label: `Residual ${getResidualLabel(small.column)}`
      });
    }
  }
  
  return result;
}

/**
 * Main layout generation function - Smart Mesh Algorithm with Force-Fill
 */
export function generateLayout(
  parcel: Feature<Polygon>,
  frontage: FrontageResult,
  config: Partial<PlotConfig> = {}
): LayoutResult {
  const cfg: PlotConfig = { ...DEFAULT_CONFIG, ...config };
  
  let plots: GeneratedPlot[] = [];
  const roads: RoadSegment[] = [];
  const residuals: GeneratedPlot[] = [];
  
  // Use net developable area if available (after constraint subtraction)
  const developableArea = frontage.netDevelopableArea || parcel;
  const parcelArea = turf.area(parcel);
  const netArea = turf.area(developableArea);
  
  // SMALL PARCEL PROTECTION: Disable automatic road buffers for parcels < 1 acre
  const isSmallParcel = parcelArea < ONE_ACRE_SQM;
  
  // FORCE-FILL LOGIC: Determine alignment angle
  let alignmentAngle: number;
  let primaryEdge: { midpoint: Position; bearing: number } | null = null;
  
  if (frontage.primaryEdge) {
    // Use frontage edge if available
    alignmentAngle = frontage.alignmentAngle;
    primaryEdge = {
      midpoint: frontage.primaryEdge.midpoint,
      bearing: frontage.primaryEdge.bearing
    };
    console.log('[LayoutGenerator] Using frontage alignment:', alignmentAngle);
  } else {
    // FALLBACK: Find longest edge of polygon for optimal alignment
    const longestEdge = findLongestEdge(developableArea);
    alignmentAngle = longestEdge.bearing;
    primaryEdge = {
      midpoint: longestEdge.midpoint,
      bearing: longestEdge.bearing
    };
    console.log('[LayoutGenerator] No frontage - using longest edge alignment:', alignmentAngle);
  }
  
  // Get aligned bounding box
  const bbox = getAlignedBoundingBox(developableArea, alignmentAngle);
  
  const centroid = turf.centroid(developableArea);
  const centerLat = centroid.geometry.coordinates[1];
  
  // Convert dimensions to degrees
  const plotDepthDeg = metersToDegrees(cfg.targetDepth, centerLat);
  const roadWidthDeg = metersToDegrees(cfg.accessRoadWidth, centerLat);
  const spineWidthDeg = metersToDegrees(cfg.spineRoadWidth, centerLat);
  
  let spine: Feature<LineString> | null = null;
  let currentY = bbox.minY;
  let rowNumber = 0;
  let ribNumber = 0;
  
  // Step 1: Handle access based on frontage analysis
  if (frontage.status === 'PRIMARY_ACCESS' || frontage.status === 'MULTI_ACCESS') {
    // Frontage row - plots face directly onto existing road (no buffer/surrender)
    const stripPlots = generateSuperGrid(
      developableArea,
      bbox,
      currentY,
      currentY + plotDepthDeg,
      cfg.targetWidth,
      rowNumber,
      cfg,
      'frontage',
      alignmentAngle,
      centerLat
    );
    
    plots.push(...stripPlots);
    rowNumber++;
    currentY += plotDepthDeg;
  } else if (!isSmallParcel) {
    // LANDLOCKED and NOT SMALL: create spine road
    // (Small parcels skip spine road to maximize yield)
    const { road, spine: spineGeom } = createSpineRoad(frontage, developableArea, cfg);
    if (road) {
      roads.push(road);
      spine = spineGeom;
    }
    currentY += spineWidthDeg / 2;
  }
  // For small landlocked parcels, we skip the spine road entirely
  
  // Step 2: Generate double-loaded strips (Plot -> Plot -> Road pattern)
  // Pattern: 2 rows of back-to-back plots, then 1 road
  
  while (currentY + plotDepthDeg < bbox.maxY) {
    // Row A: plots facing one direction
    const stripA = generateSuperGrid(
      developableArea,
      bbox,
      currentY,
      currentY + plotDepthDeg,
      cfg.targetWidth,
      rowNumber,
      cfg,
      'internal',
      alignmentAngle,
      centerLat
    );
    plots.push(...stripA);
    rowNumber++;
    currentY += plotDepthDeg;
    
    // Row B: plots backing Row A (double-loaded)
    if (currentY + plotDepthDeg < bbox.maxY) {
      const stripB = generateSuperGrid(
        developableArea,
        bbox,
        currentY,
        currentY + plotDepthDeg,
        cfg.targetWidth,
        rowNumber,
        cfg,
        'internal',
        alignmentAngle,
        centerLat
      );
      plots.push(...stripB);
      rowNumber++;
      currentY += plotDepthDeg;
    }
    
    // Road (rib) after every 2 plot rows
    if (currentY + roadWidthDeg < bbox.maxY) {
      const roadCenterY = currentY + roadWidthDeg / 2;
      
      // Create rib road geometry
      const ribStart = rotateCoordinates([[bbox.minX, roadCenterY]], alignmentAngle, bbox.center)[0];
      const ribEnd = rotateCoordinates([[bbox.maxX, roadCenterY]], alignmentAngle, bbox.center)[0];
      
      const ribGeometry = turf.lineString([ribStart, ribEnd]);
      
      roads.push({
        id: `rib-${ribNumber}`,
        type: 'rib',
        geometry: ribGeometry,
        width: cfg.accessRoadWidth,
        servesPlots: plots.filter(p => p.row === rowNumber - 1 || p.row === rowNumber - 2).map(p => p.id)
      });
      
      // Add cul-de-sac at road end if it hits boundary
      try {
        const parcelLine = turf.polygonToLine(developableArea);
        const intersections = turf.lineIntersect(ribGeometry, parcelLine as Feature<LineString>);
        
        if (intersections.features.length > 0) {
          for (const pt of intersections.features) {
            const bearing = turf.bearing(turf.point(ribStart), turf.point(ribEnd));
            const culDeSac = createCulDeSac(pt.geometry.coordinates, bearing, cfg.culDeSacRadius);
            
            roads.push({
              id: `cul-de-sac-${ribNumber}`,
              type: 'cul-de-sac',
              geometry: culDeSac,
              width: cfg.culDeSacRadius * 2,
              servesPlots: []
            });
          }
        }
      } catch (e) {
        // Skip cul-de-sac
      }
      
      ribNumber++;
      currentY += roadWidthDeg;
    }
  }
  
  // Step 3: Handle remaining space as residual plots
  if (currentY < bbox.maxY) {
    const remainingDepth = bbox.maxY - currentY;
    const remainingMeters = degreesToMeters(remainingDepth, centerLat);
    
    if (remainingMeters >= 5) { // At least 5m remaining
      const residualStrip = generateSuperGrid(
        developableArea,
        bbox,
        currentY,
        bbox.maxY,
        cfg.targetWidth,
        rowNumber,
        cfg,
        'internal',
        alignmentAngle,
        centerLat
      );
      
      for (const plot of residualStrip) {
        plots.push({
          ...plot,
          isResidual: true,
          label: `Residual ${getResidualLabel(residuals.length)}`
        });
      }
    }
  }
  
  // Step 4: Merge undersized plots with neighbors
  plots = mergeResidualPlots(plots, cfg.minResidualArea);
  
  // Step 5: Apply truncation to corner plots at intersections
  plots = plots.map((plot, idx) => {
    // Apply truncation to first and last plot of each row
    const isCorner = plots.filter(p => p.row === plot.row)[0] === plot ||
                     plots.filter(p => p.row === plot.row).slice(-1)[0] === plot;
    
    if (isCorner && plot.facingRoad === 'internal') {
      return applyTruncation(plot, cfg.truncationSize);
    }
    return plot;
  });
  
  // Step 6: Renumber and categorize plots
  let plotNumber = 1;
  let residualIndex = 0;
  
  plots.forEach(plot => {
    if (plot.isResidual) {
      plot.label = `Residual ${getResidualLabel(residualIndex)}`;
      plot.plotNumber = 0;
      residualIndex++;
      residuals.push(plot);
    } else {
      plot.plotNumber = plotNumber;
      plot.label = `Plot ${plotNumber}`;
      plot.id = `plot-${plotNumber}`;
      plotNumber++;
    }
  });
  
  // Calculate statistics
  const standardPlots = plots.filter(p => !p.isResidual);
  const totalPlotArea = plots.reduce((sum, p) => sum + p.area, 0);
  const totalRoadArea = roads.reduce((sum, r) => {
    if (r.type === 'cul-de-sac') {
      return sum + turf.area(r.geometry as Feature<Polygon>);
    }
    const length = turf.length(r.geometry as Feature<LineString>, { units: 'meters' });
    return sum + (length * r.width);
  }, 0);
  
  return {
    plots,
    roads,
    spine,
    residuals,
    statistics: {
      totalPlots: plots.length,
      standardPlots: standardPlots.length,
      residualPlots: residuals.length,
      mergedPlots: plots.filter(p => p.mergedFrom && p.mergedFrom.length > 0).length,
      totalArea: parcelArea,
      plotArea: totalPlotArea,
      roadArea: totalRoadArea,
      efficiency: (totalPlotArea / netArea) * 100,
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
): FeatureCollection<LineString | Polygon> {
  return turf.featureCollection(
    roads.map(road => ({
      ...road.geometry,
      properties: {
        ...road.geometry.properties,
        id: road.id,
        type: road.type,
        width: road.width,
        color: road.type === 'spine' ? '#3B82F6' : 
               road.type === 'cul-de-sac' ? '#8B5CF6' : '#6B7280'
      }
    }))
  ) as FeatureCollection<LineString | Polygon>;
}
