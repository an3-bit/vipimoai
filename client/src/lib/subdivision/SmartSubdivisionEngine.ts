/**
 * ⚠️ DEPRECATED - SmartSubdivisionEngine (LEGACY - Step 1)
 * 
 * This file contains local client-side subdivision logic and is NOW DEPRECATED.
 * 
 * REPLACEMENT: All subdivision logic has been moved to the Django backend.
 * 
 * STEP 2 MIGRATION:
 * - Frontend now calls POST /api/subdivide/ for all subdivision operations
 * - Coordinate area calculation is done by POST /api/rtk/ingest-coordinates/
 * - Multi-target area support is now handled server-side
 * - This file is kept for reference only and should not be imported in new code
 * 
 * SEE ALSO:
 * - client/src/lib/apiClient.ts -> ingestCoordinates(), djangoSubdivide()
 * - client/src/hooks/useSurvey.ts -> useAISubdivision()
 * - client/src/components/subdivision/SubdivisionForm.tsx (Updated for STEP 2)
 */

/**
 * SmartSubdivisionEngine - The Orchestrator
 * Combines FrontageAnalyzer and LayoutGenerator into a complete
 * context-aware subdivision system
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, LineString, FeatureCollection, Position } from 'geojson';
import { 
  analyzeFrontage, 
  createFrontageVisualization,
  type FrontageResult, 
  type ExistingRoad 
} from './FrontageAnalyzer';
import { 
  generateLayout, 
  createRoadVisualization,
  type PlotConfig, 
  type LayoutResult,
  type GeneratedPlot 
} from './LayoutGenerator';

export interface SubdivisionInput {
  parcel: Feature<Polygon>;
  existingRoads?: ExistingRoad[];
  config?: Partial<PlotConfig>;
  options?: {
    proximityThreshold?: number;
    minFrontageLength?: number;
  };
}

export interface SubdivisionOutput {
  plots: GeneratedPlot[];
  layout: LayoutResult;
  frontageAnalysis: FrontageResult;
  visualization: {
    frontage: Feature<LineString> | null;
    spine: Feature<LineString> | null;
    roads: FeatureCollection<LineString | Polygon>;
    plots: FeatureCollection<Polygon>;
  };
  summary: {
    parcelArea: number;
    parcelAreaHa: number;
    totalPlots: number;
    plotArea: number;
    plotAreaHa: number;
    roadArea: number;
    roadAreaHa: number;
    efficiency: number;
    averagePlotSize: number;
    averagePlotSizeHa: number;
    savedArea: number;
    savedAreaHa: number;
    accessType: string;
    recommendations: string[];
  };
}

/**
 * Creates a FeatureCollection of plot polygons for visualization
 */
function createPlotVisualization(
  plots: GeneratedPlot[]
): FeatureCollection<Polygon> {
  return turf.featureCollection(
    plots.map(plot => ({
      ...plot.geometry,
      properties: {
        id: plot.id,
        plotNumber: plot.plotNumber,
        area: plot.area,
        width: plot.width,
        depth: plot.depth,
        isPartial: plot.isPartial,
        isTruncated: plot.isTruncated,
        facingRoad: plot.facingRoad,
        row: plot.row,
        column: plot.column,
        // Color coding based on plot type
        fillColor: plot.facingRoad === 'frontage' 
          ? '#22C55E' // Green for frontage plots
          : plot.isPartial 
            ? '#EAB308' // Yellow for partial plots
            : '#3B82F6' // Blue for standard plots
      }
    }))
  );
}

/**
 * Main subdivision function - the complete smart subdivision pipeline
 */
export function subdivideParcel(input: SubdivisionInput): SubdivisionOutput {
  const { parcel, existingRoads = [], config = {}, options = {} } = input;

  // Step 1: Analyze frontage (The Eyes)
  console.log('[SmartSubdivision] Analyzing frontage...');
  const frontageAnalysis = analyzeFrontage(parcel, existingRoads, options);
  console.log('[SmartSubdivision] Frontage status:', frontageAnalysis.status);
  console.log('[SmartSubdivision] Access type:', frontageAnalysis.accessType);

  // Step 2: Generate layout (The Brain)
  console.log('[SmartSubdivision] Generating layout...');
  const layout = generateLayout(parcel, frontageAnalysis, config);
  console.log('[SmartSubdivision] Generated', layout.plots.length, 'plots');

  // Step 3: Create visualizations
  const frontageViz = createFrontageVisualization(frontageAnalysis);
  const roadsViz = createRoadVisualization(layout.roads);
  const plotsViz = createPlotVisualization(layout.plots);

  // Calculate summary statistics
  const parcelArea = turf.area(parcel);
  
  return {
    plots: layout.plots,
    layout,
    frontageAnalysis,
    visualization: {
      frontage: frontageViz,
      spine: layout.spine,
      roads: roadsViz,
      plots: plotsViz
    },
    summary: {
      parcelArea,
      parcelAreaHa: parcelArea / 10000,
      totalPlots: layout.plots.length,
      plotArea: layout.statistics.plotArea,
      plotAreaHa: layout.statistics.plotArea / 10000,
      roadArea: layout.statistics.roadArea,
      roadAreaHa: layout.statistics.roadArea / 10000,
      efficiency: layout.statistics.efficiency,
      averagePlotSize: layout.statistics.averagePlotSize,
      averagePlotSizeHa: layout.statistics.averagePlotSize / 10000,
      savedArea: frontageAnalysis.savedArea,
      savedAreaHa: frontageAnalysis.savedArea / 10000,
      accessType: frontageAnalysis.accessType,
      recommendations: frontageAnalysis.recommendations
    }
  };
}

/**
 * Quick subdivision for simple rectangular parcels
 * Simplified version without full frontage analysis
 */
export function quickSubdivide(
  coordinates: Position[],
  plotWidth: number = 15,
  plotDepth: number = 30,
  accessRoadWidth: number = 9
): SubdivisionOutput {
  // Create parcel polygon
  const parcel = turf.polygon([[...coordinates, coordinates[0]]]);
  
  return subdivideParcel({
    parcel,
    config: {
      targetWidth: plotWidth,
      targetDepth: plotDepth,
      accessRoadWidth
    }
  });
}

/**
 * Validates parcel geometry before subdivision
 */
export function validateParcel(parcel: Feature<Polygon>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if polygon is valid
  try {
    const area = turf.area(parcel);
    
    if (area < 100) {
      errors.push('Parcel area is too small (minimum 100 sqm)');
    }
    
    if (area < 500) {
      warnings.push('Parcel is very small, may not fit standard plots');
    }
    
    // Check for self-intersection
    const simplified = turf.simplify(parcel, { tolerance: 0.00001 });
    if (!simplified) {
      warnings.push('Parcel geometry may have issues');
    }
    
    // Check number of vertices
    const vertices = parcel.geometry.coordinates[0].length;
    if (vertices < 4) {
      errors.push('Parcel must have at least 3 vertices');
    }
    
    if (vertices > 100) {
      warnings.push('Complex parcel boundary may affect performance');
    }
    
  } catch (e) {
    errors.push(`Invalid parcel geometry: ${e}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Estimates plot count before full subdivision
 */
export function estimatePlotCount(
  parcel: Feature<Polygon>,
  plotWidth: number = 15,
  plotDepth: number = 30,
  roadAllowance: number = 0.15 // 15% for roads
): number {
  const area = turf.area(parcel);
  const usableArea = area * (1 - roadAllowance);
  const plotArea = plotWidth * plotDepth;
  
  return Math.floor(usableArea / plotArea);
}

// Re-export types and functions from sub-modules
export type { FrontageResult, ExistingRoad } from './FrontageAnalyzer';
export type { PlotConfig, GeneratedPlot, RoadSegment, LayoutResult } from './LayoutGenerator';
export { analyzeFrontage, extractParcelEdges } from './FrontageAnalyzer';
export { generateLayout } from './LayoutGenerator';
