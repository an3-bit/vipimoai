/**
 * Subdivision Module Index
 * Exports all subdivision-related functionality
 */

// Main engine
export { 
  subdivideParcel,
  quickSubdivide,
  validateParcel,
  estimatePlotCount 
} from './SmartSubdivisionEngine';

// Frontage analysis
export { 
  analyzeFrontage,
  extractParcelEdges,
  createFrontageVisualization 
} from './FrontageAnalyzer';

// Layout generation
export { 
  generateLayout,
  createRoadVisualization 
} from './LayoutGenerator';

// Types
export type { 
  SubdivisionInput,
  SubdivisionOutput 
} from './SmartSubdivisionEngine';

export type { 
  FrontageResult,
  ExistingRoad,
  ParcelEdge 
} from './FrontageAnalyzer';

export type { 
  PlotConfig,
  GeneratedPlot,
  RoadSegment,
  LayoutResult 
} from './LayoutGenerator';
