/**
 * FrontageAnalyzer - "The Eyes"
 * Detects existing road frontage and classifies parcel access
 * 
 * Logic Flow:
 * 1. Break parcel into edges
 * 2. Check each edge proximity to known roads (15m threshold)
 * 3. Mark ACCESS_SIDE or NEIGHBOR_LAND
 * 4. Calculate net developable area after constraint subtraction
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, LineString, MultiPolygon, Position } from 'geojson';

export interface ExistingRoad {
  geometry: Feature<LineString | Polygon>;
  name?: string;
  type?: string; // 'highway', 'track', 'path', etc.
}

export interface ConstraintFeature {
  geometry: Feature<Polygon>;
  type: 'road' | 'building' | 'river' | 'buffer' | 'other';
  name?: string;
  bufferWidth?: number;
}

export interface ParcelEdge {
  index: number;
  start: Position;
  end: Position;
  lineString: Feature<LineString>;
  length: number;
  bearing: number;
  midpoint: Position;
  // Access classification
  isAccessSide: boolean;
  roadName?: string;
  distanceToRoad?: number;
}

export type FrontageStatus = 'PRIMARY_ACCESS' | 'MULTI_ACCESS' | 'LANDLOCKED';
export type AccessType = 'existing_road' | 'corner_access' | 'forced_corridor';

export interface FrontageResult {
  status: FrontageStatus;
  accessType: AccessType;
  edges: ParcelEdge[];
  frontageEdges: ParcelEdge[];
  neighborEdges: ParcelEdge[];
  
  // Primary edge for layout generation
  primaryEdge: ParcelEdge | null;
  
  // Alignment info
  alignmentAngle: number; // Degrees from North
  tangentAngle: number;   // Tangent of primary road
  
  // Net developable area after subtracting constraints
  netDevelopableArea: Feature<Polygon | MultiPolygon> | null;
  appliedConstraints: ConstraintFeature[];
  lostArea: number; // sqm lost to constraints
  
  // Saved area calculation
  savedArea: number; // sqm saved by using existing road
  
  // Co-Pilot hook data
  isLandlocked: boolean;
  landlockedWarning?: string;
  suggestedAccessDirection?: 'north' | 'south' | 'east' | 'west';
  
  // Recommendations
  recommendations: string[];
}

/**
 * Extracts individual edges from a parcel polygon
 */
export function extractParcelEdges(parcel: Feature<Polygon>): ParcelEdge[] {
  const coords = parcel.geometry.coordinates[0];
  const edges: ParcelEdge[] = [];
  
  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    const lineString = turf.lineString([start, end]);
    const length = turf.length(lineString, { units: 'meters' });
    const bearing = turf.bearing(turf.point(start), turf.point(end));
    const midpoint = turf.midpoint(turf.point(start), turf.point(end)).geometry.coordinates;
    
    edges.push({
      index: i,
      start,
      end,
      lineString,
      length,
      bearing,
      midpoint,
      isAccessSide: false
    });
  }
  
  return edges;
}

/**
 * Calculates the tangent angle of a road feature (weighted average bearing)
 */
export function calculateTangentAngle(feature: Feature<LineString | Polygon>): number {
  let coords: Position[];
  
  if (feature.geometry.type === 'LineString') {
    coords = feature.geometry.coordinates;
  } else {
    coords = feature.geometry.coordinates[0];
  }
  
  if (coords.length < 2) return 0;
  
  // Calculate weighted average bearing based on segment lengths
  let totalWeight = 0;
  let weightedBearing = 0;
  
  for (let i = 0; i < coords.length - 1; i++) {
    const segment = turf.lineString([coords[i], coords[i + 1]]);
    const length = turf.length(segment, { units: 'meters' });
    const bearing = turf.bearing(turf.point(coords[i]), turf.point(coords[i + 1]));
    
    weightedBearing += bearing * length;
    totalWeight += length;
  }
  
  return totalWeight > 0 ? weightedBearing / totalWeight : 0;
}

/**
 * Checks if an edge is within proximity of any existing road
 */
export function isEdgeNearRoad(
  edge: ParcelEdge,
  roads: ExistingRoad[],
  proximityThreshold: number = 15 // 15m threshold
): { isNear: boolean; distance: number; roadName?: string } {
  let minDistance = Infinity;
  let nearestRoadName: string | undefined;
  
  for (const road of roads) {
    // Check distance from edge midpoint to road
    const midpointPt = turf.point(edge.midpoint);
    
    let distance: number;
    if (road.geometry.geometry.type === 'LineString') {
      distance = turf.pointToLineDistance(midpointPt, road.geometry as Feature<LineString>, { units: 'meters' });
    } else {
      // For polygon roads, use nearest point on boundary
      const roadLine = turf.polygonToLine(road.geometry as Feature<Polygon>);
      if (roadLine.type === 'Feature' && roadLine.geometry.type === 'LineString') {
        distance = turf.pointToLineDistance(midpointPt, roadLine as Feature<LineString>, { units: 'meters' });
      } else if (roadLine.type === 'Feature' && roadLine.geometry.type === 'MultiLineString') {
        // MultiLineString - check each line
        distance = Math.min(
          ...roadLine.geometry.coordinates.map(line => 
            turf.pointToLineDistance(midpointPt, turf.lineString(line), { units: 'meters' })
          )
        );
      } else {
        // FeatureCollection - check first feature
        distance = Infinity;
      }
    }
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestRoadName = road.name;
    }
  }
  
  return {
    isNear: minDistance <= proximityThreshold,
    distance: minDistance,
    roadName: nearestRoadName
  };
}

/**
 * Determines the cardinal direction of an edge based on its bearing
 */
function getEdgeDirection(bearing: number): 'north' | 'south' | 'east' | 'west' {
  // Normalize bearing to 0-360
  const normalized = ((bearing % 360) + 360) % 360;
  
  if (normalized >= 315 || normalized < 45) return 'north';
  if (normalized >= 45 && normalized < 135) return 'east';
  if (normalized >= 135 && normalized < 225) return 'south';
  return 'west';
}

/**
 * Suggests the best direction for forced access based on edge lengths
 */
function suggestAccessDirection(edges: ParcelEdge[]): 'north' | 'south' | 'east' | 'west' {
  const directionLengths: Record<string, number> = { north: 0, south: 0, east: 0, west: 0 };
  
  for (const edge of edges) {
    const dir = getEdgeDirection(edge.bearing);
    directionLengths[dir] += edge.length;
  }
  
  // Return direction with longest edge (best for access)
  return Object.entries(directionLengths)
    .sort((a, b) => b[1] - a[1])[0][0] as 'north' | 'south' | 'east' | 'west';
}

/**
 * Calculates net developable area by subtracting constraints
 * Uses Boolean Difference: NetArea = Parcel - (Roads + Buildings + Buffers)
 */
export function calculateNetDevelopableArea(
  parcel: Feature<Polygon>,
  constraints: ConstraintFeature[]
): { 
  netArea: Feature<Polygon | MultiPolygon> | null; 
  appliedConstraints: ConstraintFeature[]; 
  lostArea: number;
} {
  if (constraints.length === 0) {
    return { 
      netArea: parcel, 
      appliedConstraints: [], 
      lostArea: 0 
    };
  }
  
  const originalArea = turf.area(parcel);
  let currentArea: Feature<Polygon | MultiPolygon> = parcel;
  const appliedConstraints: ConstraintFeature[] = [];
  
  for (const constraint of constraints) {
    try {
      // Buffer the constraint if needed
      let constraintPolygon = constraint.geometry;
      if (constraint.bufferWidth && constraint.bufferWidth > 0) {
        const buffered = turf.buffer(constraint.geometry, constraint.bufferWidth, { units: 'meters' });
        if (buffered) {
          constraintPolygon = buffered as Feature<Polygon>;
        }
      }
      
      // Subtract constraint from current area
      const difference = turf.difference(
        turf.featureCollection([currentArea, constraintPolygon])
      );
      
      if (difference) {
        currentArea = difference as Feature<Polygon | MultiPolygon>;
        appliedConstraints.push(constraint);
      }
    } catch (e) {
      console.warn('[FrontageAnalyzer] Failed to subtract constraint:', constraint.name, e);
    }
  }
  
  const remainingArea = turf.area(currentArea);
  const lostArea = originalArea - remainingArea;
  
  return {
    netArea: currentArea,
    appliedConstraints,
    lostArea
  };
}

/**
 * Main frontage analysis function
 * The "Eyes" of the subdivision engine
 */
export function analyzeFrontage(
  parcel: Feature<Polygon>,
  existingRoads: ExistingRoad[] = [],
  options: {
    proximityThreshold?: number;
    minFrontageLength?: number;
    constraints?: ConstraintFeature[];
  } = {}
): FrontageResult {
  const {
    proximityThreshold = 15, // 15m threshold per spec
    minFrontageLength = 20,  // Minimum 20m frontage to be useful
    constraints = []
  } = options;
  
  console.log('[FrontageAnalyzer] Starting analysis...');
  console.log('[FrontageAnalyzer] Roads to check:', existingRoads.length);
  console.log('[FrontageAnalyzer] Proximity threshold:', proximityThreshold, 'm');
  
  // Step 1: Extract parcel edges
  const edges = extractParcelEdges(parcel);
  console.log('[FrontageAnalyzer] Extracted', edges.length, 'edges');
  
  // Step 2: Calculate net developable area (subtract constraints)
  const { netArea, appliedConstraints, lostArea } = calculateNetDevelopableArea(parcel, constraints);
  
  // Step 3: Check each edge for road proximity
  const frontageEdges: ParcelEdge[] = [];
  const neighborEdges: ParcelEdge[] = [];
  
  for (const edge of edges) {
    if (edge.length < minFrontageLength) {
      // Too short to be useful frontage
      neighborEdges.push(edge);
      continue;
    }
    
    const { isNear, distance, roadName } = isEdgeNearRoad(edge, existingRoads, proximityThreshold);
    
    if (isNear) {
      edge.isAccessSide = true;
      edge.roadName = roadName;
      edge.distanceToRoad = distance;
      frontageEdges.push(edge);
      console.log(`[FrontageAnalyzer] Edge ${edge.index} is ACCESS_SIDE (${roadName || 'Unknown Road'}, ${distance.toFixed(1)}m)`);
    } else {
      neighborEdges.push(edge);
    }
  }
  
  // Step 4: Determine status and access type
  let status: FrontageStatus;
  let accessType: AccessType;
  const recommendations: string[] = [];
  
  if (frontageEdges.length >= 2) {
    status = 'MULTI_ACCESS';
    accessType = 'corner_access';
    recommendations.push('Multiple road frontages: Optimizing for corner access');
    recommendations.push('Consider dual-frontage plot layout for premium lots');
  } else if (frontageEdges.length === 1) {
    status = 'PRIMARY_ACCESS';
    accessType = 'existing_road';
    recommendations.push('Single frontage detected: Using existing road');
    recommendations.push('Spine road will extend perpendicular into parcel');
  } else {
    status = 'LANDLOCKED';
    accessType = 'forced_corridor';
    recommendations.push('LANDLOCKED: No existing road frontage detected');
    recommendations.push('12m access corridor required for legal access');
  }
  
  // Step 5: Calculate alignment angle
  let alignmentAngle = 0;
  let tangentAngle = 0;
  let primaryEdge: ParcelEdge | null = null;
  
  if (frontageEdges.length > 0) {
    // Sort by length, use longest frontage edge
    primaryEdge = frontageEdges.sort((a, b) => b.length - a.length)[0];
    alignmentAngle = primaryEdge.bearing;
    
    // If we have the actual road geometry, calculate its tangent
    const matchingRoad = existingRoads.find(r => r.name === primaryEdge?.roadName);
    if (matchingRoad) {
      tangentAngle = calculateTangentAngle(matchingRoad.geometry);
    } else {
      tangentAngle = alignmentAngle;
    }
  } else {
    // Landlocked: align to longest edge
    const longestEdge = edges.sort((a, b) => b.length - a.length)[0];
    alignmentAngle = longestEdge.bearing;
    tangentAngle = alignmentAngle;
    primaryEdge = longestEdge;
  }
  
  // Step 6: Calculate saved area (road not needed if frontage exists)
  // Assume 9m road width * frontage length
  const savedArea = frontageEdges.reduce((sum, edge) => sum + (edge.length * 9), 0);
  
  // Step 7: Prepare landlocked warning and Co-Pilot suggestion
  const isLandlocked = status === 'LANDLOCKED';
  let landlockedWarning: string | undefined;
  let suggestedAccessDirection: 'north' | 'south' | 'east' | 'west' | undefined;
  
  if (isLandlocked) {
    suggestedAccessDirection = suggestAccessDirection(edges);
    landlockedWarning = `Parcel has no road access. Suggest creating access on ${suggestedAccessDirection} boundary. Use command: "Set ${suggestedAccessDirection} boundary as existing road"`;
    console.log('[FrontageAnalyzer] LANDLOCKED WARNING:', landlockedWarning);
  }
  
  console.log('[FrontageAnalyzer] Analysis complete:', status);
  
  return {
    status,
    accessType,
    edges,
    frontageEdges,
    neighborEdges,
    primaryEdge,
    alignmentAngle,
    tangentAngle,
    netDevelopableArea: netArea,
    appliedConstraints,
    lostArea,
    savedArea,
    isLandlocked,
    landlockedWarning,
    suggestedAccessDirection,
    recommendations
  };
}

/**
 * Creates a GeoJSON LineString feature for visualizing the primary frontage
 */
export function createFrontageVisualization(
  frontageResult: FrontageResult
): Feature<LineString> | null {
  if (frontageResult.frontageEdges.length === 0) {
    return null;
  }
  
  // Use the primary (longest) frontage edge
  const primaryEdge = frontageResult.frontageEdges.sort((a, b) => b.length - a.length)[0];
  
  // Calculate saved area in acres
  const savedAreaAcres = (frontageResult.savedArea / 4047).toFixed(2);
  
  return {
    type: 'Feature',
    properties: {
      type: 'frontage',
      roadName: primaryEdge.roadName || 'Existing Road',
      length: primaryEdge.length,
      savedArea: frontageResult.savedArea,
      label: `Using: ${primaryEdge.roadName || 'Existing Road'} (Saved ${savedAreaAcres} Acres)`
    },
    geometry: {
      type: 'LineString',
      coordinates: [primaryEdge.start, primaryEdge.end]
    }
  };
}
