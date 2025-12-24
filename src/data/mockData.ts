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

/**
 * Generate plot grid with proper road width subtraction and riparian collision detection
 * 
 * Road Layout Strategy:
 * - Access roads run perpendicular to plot depth (between rows of back-to-back plots)
 * - Plots are arranged in pairs (back-to-back) with road access from front
 * - Full road width is subtracted between every 2 rows of plots
 */
export function generatePlotGrid(
  parcel: { lat: number; lng: number }[],
  plotWidth: number = 15.24, // 50ft in meters
  plotDepth: number = 30.48, // 100ft in meters
  roadWidth: number = 9,
  riparianBuffer: Coordinate[] = []
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

  // Calculate usable area after perimeter setback
  const usableMinLat = minLat + setbackLat;
  const usableMaxLat = maxLat - setbackLat;
  const usableMinLng = minLng + setbackLng;
  const usableMaxLng = maxLng - setbackLng;
  
  // Calculate parcel dimensions in meters
  const parcelWidthM = (maxLng - minLng) / lngDegPerMeter;
  const parcelDepthM = (maxLat - minLat) / latDegPerMeter;
  
  // Calculate how many plots fit with proper road spacing
  // Layout: [ROAD][PLOT][PLOT back-to-back][ROAD][PLOT][PLOT back-to-back]...
  // Each "block" = road + 2 plots depth
  const blockDepth = roadWidth + (2 * plotDepth); // One road serves 2 back-to-back rows
  const usableDepth = parcelDepthM - (2 * perimeterSetback);
  const numBlocks = Math.floor(usableDepth / blockDepth);
  
  // For width: plots side by side with small gap (1m) for fencing/boundary
  const plotSpacing = 1; // 1m gap between plots in a row
  const plotWithSpacing = plotWidth + plotSpacing;
  const usableWidth = parcelWidthM - (2 * perimeterSetback) - roadWidth; // Subtract one vertical road
  const plotsPerRow = Math.floor(usableWidth / plotWithSpacing);
  
  if (numBlocks <= 0 || plotsPerRow <= 0) {
    return plots;
  }

  // Generate plots
  let currentLat = usableMinLat;
  
  for (let block = 0; block < numBlocks; block++) {
    // Add road at start of each block
    currentLat += roadWidthDegLat;
    
    // First row of plots (facing road)
    let currentLng = usableMinLng + roadWidthDegLng; // Start after vertical access road
    
    for (let col = 0; col < plotsPerRow; col++) {
      const plotCoords: Coordinate[] = [
        { lat: currentLat, lng: currentLng },
        { lat: currentLat, lng: currentLng + plotWidthDeg },
        { lat: currentLat + plotDepthDeg, lng: currentLng + plotWidthDeg },
        { lat: currentLat + plotDepthDeg, lng: currentLng },
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
    
    // Move to second row (back-to-back with first row)
    currentLat += plotDepthDeg;
    currentLng = usableMinLng + roadWidthDegLng;
    
    for (let col = 0; col < plotsPerRow; col++) {
      const plotCoords: Coordinate[] = [
        { lat: currentLat, lng: currentLng },
        { lat: currentLat, lng: currentLng + plotWidthDeg },
        { lat: currentLat + plotDepthDeg, lng: currentLng + plotWidthDeg },
        { lat: currentLat + plotDepthDeg, lng: currentLng },
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
    
    currentLat += plotDepthDeg;
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
