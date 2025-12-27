import { checkPlotRiparianOverlap, calculateOverlapPercentage } from '@/lib/riparian';
import { Coordinate } from '@/types/survey';

// Mock project data for Kenya
export const mockProjects = [
  {
    id: "1",
    name: "Juja Farm Block 4",
    client_name: "Juja Estates Ltd",
    status: "in_progress" as const,
    lat: -1.115,
    lng: 37.117,
    acres: 42,
    plots: 128,
    created_at: "2024-01-15",
  },
  {
    id: "2",
    name: "Kitengela Heights",
    client_name: "Savanna Developers",
    status: "draft" as const,
    lat: -1.469,
    lng: 36.961,
    acres: 35,
    plots: 0,
    created_at: "2024-01-20",
  },
  {
    id: "3",
    name: "Ruiru Gateway",
    client_name: "Metro Housing",
    status: "completed" as const,
    lat: -1.145,
    lng: 36.959,
    acres: 28,
    plots: 86,
    created_at: "2024-01-10",
  },
  {
    id: "4",
    name: "Athi River Industrial",
    client_name: "Industrial Parks Kenya",
    status: "in_progress" as const,
    lat: -1.458,
    lng: 36.982,
    acres: 65,
    plots: 45,
    created_at: "2024-01-18",
  },
  {
    id: "5",
    name: "Thika Greens",
    client_name: "Greenfields Dev",
    status: "draft" as const,
    lat: -1.033,
    lng: 37.069,
    acres: 22,
    plots: 0,
    created_at: "2024-01-22",
  },
];

// 40-acre parcel in Juja for workspace demo
export const mockParcelCoordinates = [
  { lat: -1.1120, lng: 37.1140 },
  { lat: -1.1120, lng: 37.1220 },
  { lat: -1.1180, lng: 37.1220 },
  { lat: -1.1180, lng: 37.1140 },
];

export interface GeneratedPlot {
  coordinates: Coordinate[];
  isValid: boolean;
  overlapPercent: number;
}

export interface SubdivisionStats {
  validCount: number;
  invalidCount: number;
  totalPlotAreaSqm: number;
  roadAreaSqm: number;
  unusedAreaSqm: number;
  efficiency: number;
  plotAreaSqm: number;
}

export interface AccessEdgeConfig {
  edgeIndex: number;
  roadWidth: number;
}

/**
 * Generate plot grid with proper road width subtraction and riparian collision detection
 * 
 * Road Layout Strategy:
 * - Access roads run perpendicular to plot depth (between rows of back-to-back plots)
 * - Plots are arranged in pairs (back-to-back) with road access from front
 * - Full road width is subtracted between every 2 rows of plots
 * - If accessEdges are provided, plots on those edges are placed directly against the boundary
 */
export function generatePlotGrid(
  parcel: { lat: number; lng: number }[],
  plotWidth: number = 15.24, // 50ft in meters
  plotDepth: number = 30.48, // 100ft in meters
  roadWidth: number = 9,
  riparianBuffer: Coordinate[] = [],
  accessEdges: AccessEdgeConfig[] = []
): GeneratedPlot[] {
  const plots: GeneratedPlot[] = [];
  
  const minLat = Math.min(...parcel.map(p => p.lat));
  const maxLat = Math.max(...parcel.map(p => p.lat));
  const minLng = Math.min(...parcel.map(p => p.lng));
  const maxLng = Math.max(...parcel.map(p => p.lng));

  // Convert meters to degrees (approximate for Kenya's latitude ~1°S)
  const latDegPerMeter = 1 / 111320;
  const lngDegPerMeter = 1 / (111320 * Math.cos(minLat * Math.PI / 180));

  // Convert dimensions to degrees
  const plotWidthDeg = plotWidth * lngDegPerMeter;
  const plotDepthDeg = plotDepth * latDegPerMeter;
  const roadWidthDegLat = roadWidth * latDegPerMeter; // Road runs East-West
  const roadWidthDegLng = roadWidth * lngDegPerMeter; // Road runs North-South
  
  // Perimeter setback (typically 3m in Kenya for boundary)
  const perimeterSetback = 3; // meters
  const setbackLat = perimeterSetback * latDegPerMeter;
  const setbackLng = perimeterSetback * lngDegPerMeter;

  // Determine which edges have existing access roads
  // Edge 0: South (minLat), Edge 1: East (maxLng), Edge 2: North (maxLat), Edge 3: West (minLng)
  const hasAccessSouth = accessEdges.some(e => e.edgeIndex === 0);
  const hasAccessEast = accessEdges.some(e => e.edgeIndex === 1);
  const hasAccessNorth = accessEdges.some(e => e.edgeIndex === 2);
  const hasAccessWest = accessEdges.some(e => e.edgeIndex === 3);

  // Calculate usable area - no setback on access road edges
  const usableMinLat = hasAccessSouth ? minLat : minLat + setbackLat;
  const usableMaxLat = hasAccessNorth ? maxLat : maxLat - setbackLat;
  const usableMinLng = hasAccessWest ? minLng : minLng + setbackLng;
  const usableMaxLng = hasAccessEast ? maxLng : maxLng - setbackLng;
  
  // Calculate parcel dimensions in meters
  const parcelWidthM = (maxLng - minLng) / lngDegPerMeter;
  const parcelDepthM = (maxLat - minLat) / latDegPerMeter;
  
  // Calculate effective setbacks for calculations
  const effectiveSouthSetback = hasAccessSouth ? 0 : perimeterSetback;
  const effectiveNorthSetback = hasAccessNorth ? 0 : perimeterSetback;
  const effectiveWestSetback = hasAccessWest ? 0 : perimeterSetback;
  const effectiveEastSetback = hasAccessEast ? 0 : perimeterSetback;
  
  // Calculate usable dimensions
  const usableDepth = parcelDepthM - effectiveSouthSetback - effectiveNorthSetback;
  const usableWidth = parcelWidthM - effectiveWestSetback - effectiveEastSetback;
  
  // Determine if we need internal vertical road (only if no west/east access)
  const needsVerticalRoad = !hasAccessWest && !hasAccessEast;
  const verticalRoadWidth = needsVerticalRoad ? roadWidth : 0;
  
  // For width: plots side by side with small gap (1m) for fencing/boundary
  const plotSpacing = 1; // 1m gap between plots in a row
  const plotWithSpacing = plotWidth + plotSpacing;
  const effectiveWidth = usableWidth - verticalRoadWidth;
  const plotsPerRow = Math.floor(effectiveWidth / plotWithSpacing);
  
  // Determine if first row needs road (only if no south access)
  const firstRowNeedsRoad = !hasAccessSouth;
  
  // Calculate how many plots fit with proper road spacing
  // If south edge has access, first row of plots goes directly to boundary
  // Layout with access: [PLOT-frontage][PLOT back-to-back][ROAD][PLOT][PLOT back-to-back]...
  // Layout without access: [ROAD][PLOT][PLOT back-to-back][ROAD]...
  
  let availableDepth = usableDepth;
  let plotRows: { startLat: number; isFrontRow: boolean }[] = [];
  
  // First: Handle the front row if there's access on south edge
  if (hasAccessSouth) {
    // Front row placed directly against south boundary (no road surrender)
    plotRows.push({ startLat: usableMinLat, isFrontRow: true });
    // Second row back-to-back with front row
    plotRows.push({ startLat: usableMinLat + plotDepth * latDegPerMeter, isFrontRow: false });
    availableDepth -= (2 * plotDepth);
  }
  
  // Calculate remaining blocks (each block = road + 2 back-to-back plots)
  const blockDepth = roadWidth + (2 * plotDepth);
  const remainingBlocks = Math.floor(availableDepth / blockDepth);
  
  // Starting position for remaining blocks
  let currentDepthPosition = hasAccessSouth ? (2 * plotDepth) : 0;
  
  for (let block = 0; block < remainingBlocks; block++) {
    // Add road at start of block
    currentDepthPosition += roadWidth;
    
    // First row of block
    plotRows.push({ 
      startLat: usableMinLat + (currentDepthPosition * latDegPerMeter), 
      isFrontRow: false 
    });
    currentDepthPosition += plotDepth;
    
    // Second row (back-to-back)
    plotRows.push({ 
      startLat: usableMinLat + (currentDepthPosition * latDegPerMeter), 
      isFrontRow: false 
    });
    currentDepthPosition += plotDepth;
  }
  
  if (plotsPerRow <= 0 || plotRows.length === 0) {
    return plots;
  }

  // Generate plots for each row
  for (const row of plotRows) {
    // Start position for this row
    let currentLng = usableMinLng + (verticalRoadWidth * lngDegPerMeter);
    
    for (let col = 0; col < plotsPerRow; col++) {
      const plotCoords: Coordinate[] = [
        { lat: row.startLat, lng: currentLng },
        { lat: row.startLat, lng: currentLng + plotWidthDeg },
        { lat: row.startLat + plotDepthDeg, lng: currentLng + plotWidthDeg },
        { lat: row.startLat + plotDepthDeg, lng: currentLng },
      ];
      
      // Check for riparian overlap
      let isValid = true;
      let overlapPercent = 0;
      
      if (riparianBuffer.length >= 3) {
        const overlaps = checkPlotRiparianOverlap(plotCoords, riparianBuffer);
        if (overlaps) {
          isValid = false;
          overlapPercent = calculateOverlapPercentage(plotCoords, riparianBuffer);
        }
      }
      
      plots.push({ coordinates: plotCoords, isValid, overlapPercent });
      currentLng += plotWidthDeg + (plotSpacing * lngDegPerMeter);
    }
  }

  return plots;
}

/**
 * Calculate subdivision statistics with proper road area accounting
 */
export function calculateSubdivisionStats(
  parcelAreaSqm: number,
  plots: GeneratedPlot[],
  plotWidth: number,
  plotDepth: number,
  roadWidth: number = 9
): SubdivisionStats {
  const validPlots = plots.filter(p => p.isValid);
  const invalidPlots = plots.filter(p => !p.isValid);
  const plotAreaSqm = plotWidth * plotDepth;
  const totalPlotAreaSqm = validPlots.length * plotAreaSqm;
  
  // Estimate road area based on layout
  // Horizontal roads: one road per 2 rows of plots
  // Vertical roads: one access road on the side
  const numRows = Math.ceil(plots.length / Math.max(1, Math.floor(Math.sqrt(plots.length))));
  const numHorizontalRoads = Math.ceil(numRows / 2);
  const plotsPerRow = plots.length > 0 ? Math.ceil(plots.length / Math.max(1, numRows)) : 0;
  
  // Approximate road dimensions
  const horizontalRoadLength = plotsPerRow * plotWidth;
  const verticalRoadLength = numRows * plotDepth;
  
  const horizontalRoadArea = numHorizontalRoads * roadWidth * horizontalRoadLength;
  const verticalRoadArea = roadWidth * verticalRoadLength;
  const roadAreaSqm = horizontalRoadArea + verticalRoadArea;
  
  // Calculate efficiency: (sellable plot area) / (total parcel area)
  const efficiency = parcelAreaSqm > 0 ? (totalPlotAreaSqm / parcelAreaSqm) * 100 : 0;
  
  // Unused area = total - plots - roads - riparian losses
  const riparianLoss = invalidPlots.length * plotAreaSqm;
  const unusedAreaSqm = Math.max(0, parcelAreaSqm - totalPlotAreaSqm - roadAreaSqm - riparianLoss);
  
  return {
    validCount: validPlots.length,
    invalidCount: invalidPlots.length,
    totalPlotAreaSqm,
    roadAreaSqm,
    unusedAreaSqm,
    efficiency: Math.min(efficiency, 100),
    plotAreaSqm,
  };
}

// Chat messages for simulation
export const mockChatMessages = [
  {
    role: "ai" as const,
    content: "Welcome to Vipimo Co-Pilot! I'm ready to help you with your subdivision. What would you like to do?",
    timestamp: new Date(Date.now() - 60000),
  },
];
