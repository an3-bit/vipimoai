/**
 * FrontageAnalyzer - "The Eyes"
 * Analyzes parcel edges to detect existing road frontage
 * and determine optimal access points for subdivision
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, LineString, Position } from 'geojson';

export interface ParcelEdge {
  id: string;
  coordinates: [Position, Position];
  length: number;
  bearing: number;
  midpoint: Position;
}

export interface FrontageResult {
  status: 'PRIMARY_ACCESS' | 'LANDLOCKED';
  primaryEdge: ParcelEdge | null;
  allEdges: ParcelEdge[];
  accessType: 'existing_road' | 'forced_corridor' | 'longest_edge';
  savedArea: number; // Area saved by using existing frontage (sqm)
  alignmentAngle: number; // Degrees from north
  recommendations: string[];
}

export interface ExistingRoad {
  geometry: Feature<LineString>;
  name?: string;
  width?: number;
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

    edges.push({
      id: `edge-${i}`,
      coordinates: [start as Position, end as Position],
      length,
      bearing,
      midpoint: midpoint as Position
    });
  }

  return edges;
}

/**
 * Checks if an edge is within proximity of an existing road
 */
function isEdgeNearRoad(
  edge: ParcelEdge, 
  roads: ExistingRoad[], 
  proximityThreshold: number = 10
): { isNear: boolean; distance: number; roadName?: string } {
  const edgeLine = turf.lineString([edge.coordinates[0], edge.coordinates[1]]);
  const edgeMidpoint = turf.point(edge.midpoint);
  
  let minDistance = Infinity;
  let nearestRoadName: string | undefined;

  for (const road of roads) {
    // Check distance from edge midpoint to road
    const distanceToRoad = turf.pointToLineDistance(edgeMidpoint, road.geometry, { units: 'meters' });
    
    if (distanceToRoad < minDistance) {
      minDistance = distanceToRoad;
      nearestRoadName = road.name;
    }

    // Also check if edge runs parallel to road (within threshold)
    const edgeStart = turf.point(edge.coordinates[0]);
    const edgeEnd = turf.point(edge.coordinates[1]);
    
    const distStart = turf.pointToLineDistance(edgeStart, road.geometry, { units: 'meters' });
    const distEnd = turf.pointToLineDistance(edgeEnd, road.geometry, { units: 'meters' });
    
    const avgDist = (distStart + distEnd) / 2;
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
 * Finds the longest edge (fallback for landlocked parcels)
 */
function findLongestEdge(edges: ParcelEdge[]): ParcelEdge {
  return edges.reduce((longest, edge) => 
    edge.length > longest.length ? edge : longest
  , edges[0]);
}

/**
 * Calculates the area saved by using existing frontage instead of creating a buffer road
 */
function calculateSavedArea(edge: ParcelEdge, roadWidth: number = 9): number {
  return edge.length * roadWidth;
}

/**
 * Main frontage analysis function
 * Runs BEFORE subdivision to determine access strategy
 */
export function analyzeFrontage(
  parcel: Feature<Polygon>,
  existingRoads: ExistingRoad[] = [],
  options: {
    proximityThreshold?: number;
    minFrontageLength?: number;
  } = {}
): FrontageResult {
  const { 
    proximityThreshold = 10, 
    minFrontageLength = 15 
  } = options;

  const edges = extractParcelEdges(parcel);
  const recommendations: string[] = [];

  // Check each edge for road proximity
  const edgesWithRoadInfo = edges.map(edge => ({
    edge,
    roadInfo: isEdgeNearRoad(edge, existingRoads, proximityThreshold)
  }));

  // Find edges that are near existing roads
  const frontageEdges = edgesWithRoadInfo
    .filter(({ edge, roadInfo }) => 
      roadInfo.isNear && edge.length >= minFrontageLength
    )
    .sort((a, b) => b.edge.length - a.edge.length);

  // Determine access strategy
  if (frontageEdges.length > 0) {
    const primaryEdge = frontageEdges[0].edge;
    const roadInfo = frontageEdges[0].roadInfo;
    const savedArea = calculateSavedArea(primaryEdge);
    
    recommendations.push(
      `Existing road detected: ${roadInfo.roadName || 'Unnamed Road'}`,
      `Frontage length: ${primaryEdge.length.toFixed(1)}m`,
      `Area saved by using existing frontage: ${(savedArea / 10000).toFixed(3)} Ha`
    );

    if (frontageEdges.length > 1) {
      recommendations.push(
        `${frontageEdges.length - 1} additional road frontage(s) available for future connectivity`
      );
    }

    return {
      status: 'PRIMARY_ACCESS',
      primaryEdge,
      allEdges: edges,
      accessType: 'existing_road',
      savedArea,
      alignmentAngle: normalizeAngle(primaryEdge.bearing),
      recommendations
    };
  }

  // Landlocked case - use longest edge as alignment
  const longestEdge = findLongestEdge(edges);
  
  recommendations.push(
    'No existing road frontage detected - parcel is LANDLOCKED',
    'A 12m access corridor will be required',
    `Alignment will follow longest boundary: ${longestEdge.length.toFixed(1)}m`
  );

  return {
    status: 'LANDLOCKED',
    primaryEdge: longestEdge,
    allEdges: edges,
    accessType: 'forced_corridor',
    savedArea: 0,
    alignmentAngle: normalizeAngle(longestEdge.bearing),
    recommendations
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
