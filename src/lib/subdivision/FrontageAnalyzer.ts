/**
 * FrontageAnalyzer - "The Eyes"
 * Analyzes parcel boundaries to detect existing road frontage,
 * calculate alignment angles, and identify access points.
 * 
 * NEW: Supports constraint features (roads, buildings) and
 * calculates net developable area using boolean difference.
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, LineString, Position, MultiPolygon } from 'geojson';

export interface ExistingRoad {
  id?: string;
  name?: string;
  geometry: Feature<LineString>;
  width?: number;
}

export interface ConstraintFeature {
  id: string;
  type: 'road' | 'building' | 'river' | 'easement' | 'reserved';
  name?: string;
  geometry: Feature<Polygon | LineString>;
  bufferWidth?: number; // Buffer distance in meters for line features
}

export interface ParcelEdge {
  id: string;
  coordinates: [Position, Position];
  length: number;
  bearing: number;
  midpoint: Position;
  geometry: Feature<LineString>;
}

export interface FrontageResult {
  status: 'PRIMARY_ACCESS' | 'LANDLOCKED';
  primaryEdge: ParcelEdge | null;
  allEdges: ParcelEdge[];
  frontageEdges: ParcelEdge[];
  
  // Access classification
  accessType: 'existing_road' | 'forced_corridor' | 'longest_edge' | 'corner' | 'through';
  
  // Alignment data
  alignmentAngle: number; // Degrees from North (aligned to longest constraint or frontage)
  tangentAngle: number; // Tangent of longest constraint feature
  
  // Net developable area (after obstacle subtraction)
  netDevelopableArea: Feature<Polygon | MultiPolygon> | null;
  originalArea: number;
  netArea: number;
  lostArea: number; // Area lost to constraints
  
  // Constraint analysis
  constraintsApplied: ConstraintFeature[];
  
  savedArea: number; // Area saved by using existing frontage
  recommendations: string[];
}

/**
 * Breaks a polygon into individual edge segments
 */
export function extractParcelEdges(parcel: Feature<Polygon>): ParcelEdge[] {
  const coords = parcel.geometry.coordinates[0];
  const edges: ParcelEdge[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    
    const startPoint = turf.point(start);
    const endPoint = turf.point(end);
    
    const length = turf.distance(startPoint, endPoint, { units: 'meters' });
    const bearing = turf.bearing(startPoint, endPoint);
    const midpoint = turf.midpoint(startPoint, endPoint).geometry.coordinates;
    const geometry = turf.lineString([start, end]);

    edges.push({
      id: `edge-${i}`,
      coordinates: [start as Position, end as Position],
      length,
      bearing,
      midpoint: midpoint as Position,
      geometry
    });
  }

  return edges;
}

/**
 * Calculates the tangent angle of a constraint feature (road curve, building edge)
 * For curved roads, finds the weighted average tangent
 */
function calculateTangentAngle(feature: Feature<LineString | Polygon>): number {
  let line: Feature<LineString>;
  
  if (feature.geometry.type === 'Polygon') {
    // Use the longest edge of the polygon
    const coords = feature.geometry.coordinates[0];
    let longestEdge: [Position, Position] = [coords[0], coords[1]];
    let maxLength = 0;
    
    for (let i = 0; i < coords.length - 1; i++) {
      const segLength = turf.distance(
        turf.point(coords[i]),
        turf.point(coords[i + 1]),
        { units: 'meters' }
      );
      if (segLength > maxLength) {
        maxLength = segLength;
        longestEdge = [coords[i], coords[i + 1]];
      }
    }
    
    line = turf.lineString(longestEdge);
  } else {
    line = feature as Feature<LineString>;
  }
  
  const coords = line.geometry.coordinates;
  if (coords.length < 2) return 0;
  
  // For curved lines, calculate weighted average bearing
  const bearings: { bearing: number; weight: number }[] = [];
  
  for (let i = 0; i < coords.length - 1; i++) {
    const segLength = turf.distance(
      turf.point(coords[i]),
      turf.point(coords[i + 1]),
      { units: 'meters' }
    );
    const bearing = turf.bearing(
      turf.point(coords[i]),
      turf.point(coords[i + 1])
    );
    bearings.push({ bearing, weight: segLength });
  }
  
  // Weighted circular mean
  const totalWeight = bearings.reduce((sum, b) => sum + b.weight, 0);
  const sinSum = bearings.reduce((sum, b) => sum + b.weight * Math.sin(b.bearing * Math.PI / 180), 0);
  const cosSum = bearings.reduce((sum, b) => sum + b.weight * Math.cos(b.bearing * Math.PI / 180), 0);
  const avgBearing = Math.atan2(sinSum / totalWeight, cosSum / totalWeight) * 180 / Math.PI;
  
  return normalizeAngle(avgBearing);
}

/**
 * Checks if an edge is within proximity of an existing road
 */
function isEdgeNearRoad(
  edge: ParcelEdge, 
  roads: ExistingRoad[], 
  proximityThreshold: number = 10
): { isNear: boolean; distance: number; roadName?: string } {
  const edgeMidpoint = turf.point(edge.midpoint);
  
  let minDistance = Infinity;
  let nearestRoadName: string | undefined;

  for (const road of roads) {
    const distanceToRoad = turf.pointToLineDistance(edgeMidpoint, road.geometry, { units: 'meters' });
    
    if (distanceToRoad < minDistance) {
      minDistance = distanceToRoad;
      nearestRoadName = road.name;
    }

    // Also check endpoints
    const edgeStart = turf.point(edge.coordinates[0]);
    const edgeEnd = turf.point(edge.coordinates[1]);
    
    const distStart = turf.pointToLineDistance(edgeStart, road.geometry, { units: 'meters' });
    const distEnd = turf.pointToLineDistance(edgeEnd, road.geometry, { units: 'meters' });
    
    const avgDist = (distStart + distEnd + distanceToRoad) / 3;
    if (avgDist < minDistance) {
      minDistance = avgDist;
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
 * Subtracts constraint features from parcel to get Net Developable Area
 * NetDevelopableArea = ParcelPolygon - (RoadPolygons + BuildingPolygons)
 */
function calculateNetDevelopableArea(
  parcel: Feature<Polygon>,
  constraints: ConstraintFeature[]
): { 
  netArea: Feature<Polygon | MultiPolygon> | null; 
  appliedConstraints: ConstraintFeature[];
  lostArea: number;
} {
  let result: Feature<Polygon | MultiPolygon> | null = parcel;
  const appliedConstraints: ConstraintFeature[] = [];
  const originalArea = turf.area(parcel);
  
  for (const constraint of constraints) {
    if (!result) break;
    
    let obstaclePolygon: Feature<Polygon> | null = null;
    
    if (constraint.geometry.geometry.type === 'LineString') {
      // Buffer the line to create a polygon
      const bufferWidth = constraint.bufferWidth || 
        (constraint.type === 'road' ? 6 : 3);
      
      try {
        const buffered = turf.buffer(constraint.geometry, bufferWidth / 2, { units: 'meters' });
        if (buffered) {
          obstaclePolygon = buffered as Feature<Polygon>;
        }
      } catch (e) {
        console.warn(`[FrontageAnalyzer] Failed to buffer constraint ${constraint.id}:`, e);
        continue;
      }
    } else {
      obstaclePolygon = constraint.geometry as Feature<Polygon>;
    }
    
    if (!obstaclePolygon) continue;
    
    // Check if constraint intersects parcel
    try {
      const intersection = turf.intersect(turf.featureCollection([result as Feature<Polygon>, obstaclePolygon]));
      if (!intersection) continue; // Constraint doesn't affect parcel
      
      // Perform boolean difference
      const difference = turf.difference(
        turf.featureCollection([result as Feature<Polygon>, obstaclePolygon])
      );
      
      if (difference) {
        result = difference as Feature<Polygon | MultiPolygon>;
        appliedConstraints.push(constraint);
      }
    } catch (e) {
      console.warn(`[FrontageAnalyzer] Failed to subtract constraint ${constraint.id}:`, e);
    }
  }
  
  const netAreaValue = result ? turf.area(result) : 0;
  
  return { 
    netArea: result, 
    appliedConstraints,
    lostArea: originalArea - netAreaValue
  };
}

/**
 * Normalizes bearing angle to 0-360 range
 */
function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

/**
 * Calculates the area saved by using existing frontage instead of creating a buffer road
 */
function calculateSavedArea(edge: ParcelEdge, roadWidth: number = 9): number {
  return edge.length * roadWidth;
}

/**
 * Main frontage analysis function
 * Runs BEFORE subdivision to determine access strategy and net developable area
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
    proximityThreshold = 10, 
    minFrontageLength = 15,
    constraints = []
  } = options;

  const edges = extractParcelEdges(parcel);
  const recommendations: string[] = [];
  const originalArea = turf.area(parcel);

  // Step 1: Calculate Net Developable Area (subtract obstacles)
  const { netArea, appliedConstraints, lostArea } = calculateNetDevelopableArea(parcel, constraints);
  
  if (appliedConstraints.length > 0) {
    recommendations.push(
      `${appliedConstraints.length} constraint(s) applied`,
      `Area lost to constraints: ${(lostArea / 10000).toFixed(3)} Ha`
    );
  }

  // Step 2: Check each edge for road proximity
  const edgesWithRoadInfo = edges.map(edge => ({
    edge,
    roadInfo: isEdgeNearRoad(edge, existingRoads, proximityThreshold)
  }));

  // Step 3: Find edges that are near existing roads
  const frontageEdges = edgesWithRoadInfo
    .filter(({ edge, roadInfo }) => 
      roadInfo.isNear && edge.length >= minFrontageLength
    )
    .map(({ edge }) => edge)
    .sort((a, b) => b.length - a.length);

  // Step 4: Determine alignment angle from constraints or frontage
  let alignmentAngle = 0;
  let tangentAngle = 0;
  
  // Find longest road constraint for tangent alignment (e.g., Station Road curve)
  const roadConstraints = constraints.filter(c => c.type === 'road');
  let longestConstraint: ConstraintFeature | null = null;
  let maxConstraintLength = 0;
  
  for (const constraint of roadConstraints) {
    let length = 0;
    if (constraint.geometry.geometry.type === 'LineString') {
      length = turf.length(constraint.geometry as Feature<LineString>, { units: 'meters' });
    } else {
      try {
        const line = turf.polygonToLine(constraint.geometry as Feature<Polygon>);
        length = turf.length(line as Feature<LineString>, { units: 'meters' });
      } catch (e) {
        // Skip
      }
    }
    
    if (length > maxConstraintLength) {
      maxConstraintLength = length;
      longestConstraint = constraint;
    }
  }
  
  if (longestConstraint) {
    // Align grid to longest constraint (Station Road fix)
    tangentAngle = calculateTangentAngle(longestConstraint.geometry as Feature<LineString | Polygon>);
    alignmentAngle = tangentAngle;
    recommendations.push(`Grid aligned to ${longestConstraint.name || 'constraint'} tangent (${tangentAngle.toFixed(1)}°)`);
  } else if (frontageEdges.length > 0) {
    // Align to primary frontage
    alignmentAngle = normalizeAngle(frontageEdges[0].bearing);
    tangentAngle = alignmentAngle;
    recommendations.push(`Grid aligned to primary frontage (${alignmentAngle.toFixed(1)}°)`);
  } else {
    // Fallback: align to longest parcel edge
    const longestEdge = edges.reduce((longest, edge) => 
      edge.length > longest.length ? edge : longest
    , edges[0]);
    alignmentAngle = normalizeAngle(longestEdge.bearing);
    tangentAngle = alignmentAngle;
    recommendations.push(`Grid aligned to longest boundary (${alignmentAngle.toFixed(1)}°)`);
  }

  // Step 5: Determine access type
  let accessType: 'existing_road' | 'forced_corridor' | 'longest_edge' | 'corner' | 'through' = 'forced_corridor';
  
  if (frontageEdges.length >= 2) {
    // Check if edges are opposite (through) or adjacent (corner)
    const angle1 = frontageEdges[0].bearing;
    const angle2 = frontageEdges[1].bearing;
    const angleDiff = Math.abs(normalizeAngle(angle1) - normalizeAngle(angle2));
    
    if (angleDiff > 150 && angleDiff < 210) {
      accessType = 'through';
      recommendations.push('Through-access detected: Consider split layout');
    } else {
      accessType = 'corner';
      recommendations.push('Corner-access detected: L-shaped layout recommended');
    }
  } else if (frontageEdges.length === 1) {
    accessType = 'existing_road';
    recommendations.push('Single frontage: Spine road required for depth access');
  } else {
    accessType = 'forced_corridor';
    recommendations.push('LANDLOCKED: 12m access corridor required');
  }

  const primaryEdge = frontageEdges.length > 0 ? frontageEdges[0] : 
    edges.reduce((longest, edge) => edge.length > longest.length ? edge : longest, edges[0]);
  
  const savedArea = frontageEdges.length > 0 ? calculateSavedArea(frontageEdges[0]) : 0;
  
  if (savedArea > 0) {
    recommendations.push(`Saved ${(savedArea / 10000).toFixed(3)} Ha by using existing frontage`);
  }

  return {
    status: frontageEdges.length > 0 ? 'PRIMARY_ACCESS' : 'LANDLOCKED',
    primaryEdge,
    allEdges: edges,
    frontageEdges,
    accessType,
    alignmentAngle,
    tangentAngle,
    netDevelopableArea: netArea,
    originalArea,
    netArea: netArea ? turf.area(netArea) : originalArea,
    lostArea,
    constraintsApplied: appliedConstraints,
    savedArea,
    recommendations
  };
}

/**
 * Creates a visual representation of the frontage edge for map display
 */
export function createFrontageVisualization(
  frontageResult: FrontageResult
): Feature<LineString> | null {
  if (!frontageResult.primaryEdge) return null;

  const edge = frontageResult.primaryEdge;
  
  return turf.lineString(
    [edge.coordinates[0], edge.coordinates[1]],
    {
      type: 'frontage',
      accessType: frontageResult.accessType,
      length: edge.length,
      savedArea: frontageResult.savedArea,
      label: frontageResult.accessType === 'existing_road' 
        ? `Existing Road Detected (Saved ${(frontageResult.savedArea / 10000).toFixed(2)} Ha)`
        : `Access Corridor Required`
    }
  );
}
