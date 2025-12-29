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
  isTruncated?: boolean;
  truncatedArea?: number;
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

export interface RoadSegment {
  type: 'spine' | 'rib' | 'culdesac';
  coordinates: Coordinate[];
  width: number;
}

/**
 * SPINE & RIBS ALGORITHM ("Comb" Layout)
 * 
 * Layout Strategy:
 * 1. Access Edge: Where vehicles enter (user-selected or default South)
 * 2. Spine Road: 12m main road running perpendicular from access edge into land
 * 3. Rib Roads: 9m roads branching off spine every ~60m (2 back-to-back plots)
 * 4. Double-Loaded: Plots face rib roads on both sides (no wasted backs)
 * 5. Cul-de-sacs: Dead-end roads get 15m turning heads (no ring roads)
 * 6. Truncation: 3m corner clips at intersections
 */
export function generatePlotGrid(
  parcel: { lat: number; lng: number }[],
  plotWidth: number = 15.24, // 50ft in meters
  plotDepth: number = 30.48, // 100ft in meters
  roadWidth: number = 9,     // Rib road width
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

  // Road widths
  const spineWidth = 12; // Main access spine
  const ribWidth = roadWidth; // Branch roads
  const truncation = 3; // Corner truncation at intersections

  // Convert dimensions to degrees
  const plotWidthDeg = plotWidth * lngDegPerMeter;
  const plotDepthDeg = plotDepth * latDegPerMeter;
  const spineWidthDeg = spineWidth * lngDegPerMeter;
  const ribWidthDeg = ribWidth * latDegPerMeter;
  const truncationDeg = truncation * lngDegPerMeter;
  
  // Perimeter setback (3m boundary buffer for fencing)
  const perimeterSetback = 3;
  const setbackLat = perimeterSetback * latDegPerMeter;
  const setbackLng = perimeterSetback * lngDegPerMeter;

  // Determine access edge (default: South edge = 0)
  const primaryAccessEdge = accessEdges.length > 0 ? accessEdges[0].edgeIndex : 0;
  
  // Edge definitions: 0=South, 1=East, 2=North, 3=West
  const hasAccessSouth = primaryAccessEdge === 0;
  const hasAccessNorth = primaryAccessEdge === 2;
  const hasAccessWest = primaryAccessEdge === 3;
  const hasAccessEast = primaryAccessEdge === 1;

  // Calculate usable bounds with setbacks (except on access edge)
  const usableMinLat = hasAccessSouth ? minLat : minLat + setbackLat;
  const usableMaxLat = hasAccessNorth ? maxLat : maxLat - setbackLat;
  const usableMinLng = hasAccessWest ? minLng : minLng + setbackLng;
  const usableMaxLng = hasAccessEast ? maxLng : maxLng - setbackLng;
  
  // Parcel dimensions in meters
  const parcelWidthM = (usableMaxLng - usableMinLng) / lngDegPerMeter;
  const parcelDepthM = (usableMaxLat - usableMinLat) / latDegPerMeter;

  // SPINE ROAD: Runs perpendicular from access edge into land
  // For South/North access: Spine runs North-South (vertical), centered horizontally
  // For East/West access: Spine runs East-West (horizontal), centered vertically
  
  const isVerticalSpine = hasAccessSouth || hasAccessNorth;
  
  if (isVerticalSpine) {
    // Spine runs North-South from access edge
    // Position spine at center of parcel width
    const spineCenterLng = usableMinLng + (usableMaxLng - usableMinLng) / 2;
    const spineLeftLng = spineCenterLng - (spineWidthDeg / 2);
    const spineRightLng = spineCenterLng + (spineWidthDeg / 2);
    
    // Calculate rib spacing (every 2 back-to-back plots = ~60m)
    const ribSpacing = (2 * plotDepth) + ribWidth; // Two plots + road
    const ribSpacingDeg = ribSpacing * latDegPerMeter;
    
    // Generate plots on BOTH sides of spine
    const sides: ('left' | 'right')[] = ['left', 'right'];
    
    for (const side of sides) {
      // Calculate available width on this side
      const sideStartLng = side === 'left' ? usableMinLng : spineRightLng;
      const sideEndLng = side === 'left' ? spineLeftLng : usableMaxLng;
      const sideWidthDeg = sideEndLng - sideStartLng;
      const sideWidthM = sideWidthDeg / lngDegPerMeter;
      
      // How many plots fit across this side?
      const plotsAcross = Math.floor(sideWidthM / plotWidth);
      if (plotsAcross <= 0) continue;
      
      // Generate rib roads and plots
      let currentLat = hasAccessSouth ? usableMinLat : usableMaxLat;
      const direction = hasAccessSouth ? 1 : -1; // Move up from south, down from north
      
      // First row of plots directly faces the access road (frontage)
      for (let col = 0; col < plotsAcross; col++) {
        const plotLng = side === 'left' 
          ? sideEndLng - ((col + 1) * plotWidthDeg) - (truncationDeg * (col === 0 ? 1 : 0))
          : sideStartLng + (col * plotWidthDeg) + (truncationDeg * (col === 0 ? 1 : 0));
        
        const isTruncated = col === 0; // First plot near spine is truncated
        
        const plotCoords: Coordinate[] = hasAccessSouth ? [
          { lat: currentLat, lng: plotLng },
          { lat: currentLat, lng: plotLng + plotWidthDeg },
          { lat: currentLat + plotDepthDeg, lng: plotLng + plotWidthDeg },
          { lat: currentLat + plotDepthDeg, lng: plotLng },
        ] : [
          { lat: currentLat - plotDepthDeg, lng: plotLng },
          { lat: currentLat - plotDepthDeg, lng: plotLng + plotWidthDeg },
          { lat: currentLat, lng: plotLng + plotWidthDeg },
          { lat: currentLat, lng: plotLng },
        ];
        
        const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
        plots.push({ 
          coordinates: plotCoords, 
          isValid, 
          overlapPercent,
          isTruncated,
          truncatedArea: isTruncated ? truncation * truncation : 0
        });
      }
      
      // Move past first row
      currentLat += direction * plotDepthDeg;
      
      // Generate remaining rows in back-to-back pairs with rib roads
      let rowCount = 1;
      const maxDepth = hasAccessSouth ? usableMaxLat : usableMinLat;
      
      while (hasAccessSouth ? (currentLat < maxDepth - plotDepthDeg) : (currentLat > maxDepth + plotDepthDeg)) {
        const isBackToBackRow = rowCount % 2 === 1;
        
        if (!isBackToBackRow) {
          // Add rib road gap before this row
          currentLat += direction * ribWidthDeg;
        }
        
        // Generate plots in this row
        for (let col = 0; col < plotsAcross; col++) {
          const plotLng = side === 'left' 
            ? sideEndLng - ((col + 1) * plotWidthDeg) - (truncationDeg * (col === 0 && !isBackToBackRow ? 1 : 0))
            : sideStartLng + (col * plotWidthDeg) + (truncationDeg * (col === 0 && !isBackToBackRow ? 1 : 0));
          
          const isTruncated = col === 0 && !isBackToBackRow;
          
          const plotCoords: Coordinate[] = hasAccessSouth ? [
            { lat: currentLat, lng: plotLng },
            { lat: currentLat, lng: plotLng + plotWidthDeg },
            { lat: currentLat + plotDepthDeg, lng: plotLng + plotWidthDeg },
            { lat: currentLat + plotDepthDeg, lng: plotLng },
          ] : [
            { lat: currentLat - plotDepthDeg, lng: plotLng },
            { lat: currentLat - plotDepthDeg, lng: plotLng + plotWidthDeg },
            { lat: currentLat, lng: plotLng + plotWidthDeg },
            { lat: currentLat, lng: plotLng },
          ];
          
          const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
          plots.push({ 
            coordinates: plotCoords, 
            isValid, 
            overlapPercent,
            isTruncated,
            truncatedArea: isTruncated ? truncation * truncation : 0
          });
        }
        
        currentLat += direction * plotDepthDeg;
        rowCount++;
      }
    }
  } else {
    // Spine runs East-West (horizontal access from East or West)
    const spineCenterLat = usableMinLat + (usableMaxLat - usableMinLat) / 2;
    const spineBottomLat = spineCenterLat - (spineWidth * latDegPerMeter / 2);
    const spineTopLat = spineCenterLat + (spineWidth * latDegPerMeter / 2);
    
    // Generate plots above and below spine
    const sides: ('above' | 'below')[] = ['above', 'below'];
    
    for (const side of sides) {
      const sideStartLat = side === 'below' ? usableMinLat : spineTopLat;
      const sideEndLat = side === 'below' ? spineBottomLat : usableMaxLat;
      const sideHeightDeg = Math.abs(sideEndLat - sideStartLat);
      const sideHeightM = sideHeightDeg / latDegPerMeter;
      
      const plotsAcross = Math.floor(sideHeightM / plotDepth);
      if (plotsAcross <= 0) continue;
      
      // Generate from access edge
      let currentLng = hasAccessWest ? usableMinLng : usableMaxLng;
      const direction = hasAccessWest ? 1 : -1;
      
      // First row directly faces access
      for (let row = 0; row < plotsAcross; row++) {
        const plotLat = side === 'below' 
          ? sideEndLat - ((row + 1) * plotDepthDeg)
          : sideStartLat + (row * plotDepthDeg);
        
        const isTruncated = row === 0;
        
        const plotCoords: Coordinate[] = hasAccessWest ? [
          { lat: plotLat, lng: currentLng },
          { lat: plotLat, lng: currentLng + plotWidthDeg },
          { lat: plotLat + plotDepthDeg, lng: currentLng + plotWidthDeg },
          { lat: plotLat + plotDepthDeg, lng: currentLng },
        ] : [
          { lat: plotLat, lng: currentLng - plotWidthDeg },
          { lat: plotLat, lng: currentLng },
          { lat: plotLat + plotDepthDeg, lng: currentLng },
          { lat: plotLat + plotDepthDeg, lng: currentLng - plotWidthDeg },
        ];
        
        const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
        plots.push({ 
          coordinates: plotCoords, 
          isValid, 
          overlapPercent,
          isTruncated,
          truncatedArea: isTruncated ? truncation * truncation : 0
        });
      }
      
      currentLng += direction * plotWidthDeg;
      
      // Remaining columns with rib roads
      let colCount = 1;
      const maxWidth = hasAccessWest ? usableMaxLng : usableMinLng;
      
      while (hasAccessWest ? (currentLng < maxWidth - plotWidthDeg) : (currentLng > maxWidth + plotWidthDeg)) {
        const isBackToBackCol = colCount % 2 === 1;
        
        if (!isBackToBackCol) {
          currentLng += direction * ribWidth * lngDegPerMeter;
        }
        
        for (let row = 0; row < plotsAcross; row++) {
          const plotLat = side === 'below' 
            ? sideEndLat - ((row + 1) * plotDepthDeg)
            : sideStartLat + (row * plotDepthDeg);
          
          const isTruncated = row === 0 && !isBackToBackCol;
          
          const plotCoords: Coordinate[] = hasAccessWest ? [
            { lat: plotLat, lng: currentLng },
            { lat: plotLat, lng: currentLng + plotWidthDeg },
            { lat: plotLat + plotDepthDeg, lng: currentLng + plotWidthDeg },
            { lat: plotLat + plotDepthDeg, lng: currentLng },
          ] : [
            { lat: plotLat, lng: currentLng - plotWidthDeg },
            { lat: plotLat, lng: currentLng },
            { lat: plotLat + plotDepthDeg, lng: currentLng },
            { lat: plotLat + plotDepthDeg, lng: currentLng - plotWidthDeg },
          ];
          
          const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
          plots.push({ 
            coordinates: plotCoords, 
            isValid, 
            overlapPercent,
            isTruncated,
            truncatedArea: isTruncated ? truncation * truncation : 0
          });
        }
        
        currentLng += direction * plotWidthDeg;
        colCount++;
      }
    }
  }

  return plots;
}

/**
 * Helper: Check riparian buffer validity
 */
function checkRiparianValidity(
  plotCoords: Coordinate[], 
  riparianBuffer: Coordinate[]
): { isValid: boolean; overlapPercent: number } {
  if (riparianBuffer.length < 3) {
    return { isValid: true, overlapPercent: 0 };
  }
  
  const overlaps = checkPlotRiparianOverlap(plotCoords, riparianBuffer);
  if (overlaps) {
    return { 
      isValid: false, 
      overlapPercent: calculateOverlapPercentage(plotCoords, riparianBuffer) 
    };
  }
  return { isValid: true, overlapPercent: 0 };
}

/**
 * Generate road network for visualization
 */
export function generateRoadNetwork(
  parcel: { lat: number; lng: number }[],
  plotDepth: number = 30.48,
  roadWidth: number = 9,
  accessEdges: AccessEdgeConfig[] = []
): RoadSegment[] {
  const roads: RoadSegment[] = [];
  
  const minLat = Math.min(...parcel.map(p => p.lat));
  const maxLat = Math.max(...parcel.map(p => p.lat));
  const minLng = Math.min(...parcel.map(p => p.lng));
  const maxLng = Math.max(...parcel.map(p => p.lng));

  const latDegPerMeter = 1 / 111320;
  const lngDegPerMeter = 1 / (111320 * Math.cos(minLat * Math.PI / 180));

  const spineWidth = 12;
  const perimeterSetback = 3;
  const setbackLat = perimeterSetback * latDegPerMeter;
  const setbackLng = perimeterSetback * lngDegPerMeter;

  const primaryAccessEdge = accessEdges.length > 0 ? accessEdges[0].edgeIndex : 0;
  const isVerticalSpine = primaryAccessEdge === 0 || primaryAccessEdge === 2;

  const usableMinLat = minLat + setbackLat;
  const usableMaxLat = maxLat - setbackLat;
  const usableMinLng = minLng + setbackLng;
  const usableMaxLng = maxLng - setbackLng;

  if (isVerticalSpine) {
    // Vertical spine road
    const spineCenterLng = usableMinLng + (usableMaxLng - usableMinLng) / 2;
    const spineHalfWidth = (spineWidth * lngDegPerMeter) / 2;
    
    roads.push({
      type: 'spine',
      width: spineWidth,
      coordinates: [
        { lat: usableMinLat, lng: spineCenterLng - spineHalfWidth },
        { lat: usableMinLat, lng: spineCenterLng + spineHalfWidth },
        { lat: usableMaxLat, lng: spineCenterLng + spineHalfWidth },
        { lat: usableMaxLat, lng: spineCenterLng - spineHalfWidth },
      ]
    });

    // Rib roads
    const ribSpacing = (2 * plotDepth) + roadWidth;
    let currentLat = usableMinLat + (ribSpacing * latDegPerMeter);
    const ribHalfWidth = (roadWidth * latDegPerMeter) / 2;

    while (currentLat < usableMaxLat - (plotDepth * latDegPerMeter)) {
      // Left rib
      roads.push({
        type: 'rib',
        width: roadWidth,
        coordinates: [
          { lat: currentLat - ribHalfWidth, lng: usableMinLng },
          { lat: currentLat - ribHalfWidth, lng: spineCenterLng - spineHalfWidth },
          { lat: currentLat + ribHalfWidth, lng: spineCenterLng - spineHalfWidth },
          { lat: currentLat + ribHalfWidth, lng: usableMinLng },
        ]
      });

      // Right rib
      roads.push({
        type: 'rib',
        width: roadWidth,
        coordinates: [
          { lat: currentLat - ribHalfWidth, lng: spineCenterLng + spineHalfWidth },
          { lat: currentLat - ribHalfWidth, lng: usableMaxLng },
          { lat: currentLat + ribHalfWidth, lng: usableMaxLng },
          { lat: currentLat + ribHalfWidth, lng: spineCenterLng + spineHalfWidth },
        ]
      });

      // Cul-de-sacs at rib ends
      const culdesacRadius = 15 * lngDegPerMeter;
      roads.push({
        type: 'culdesac',
        width: 15,
        coordinates: generateCircleCoords(
          { lat: currentLat, lng: usableMinLng },
          culdesacRadius / 2,
          latDegPerMeter
        )
      });

      roads.push({
        type: 'culdesac',
        width: 15,
        coordinates: generateCircleCoords(
          { lat: currentLat, lng: usableMaxLng },
          culdesacRadius / 2,
          latDegPerMeter
        )
      });

      currentLat += ribSpacing * latDegPerMeter;
    }
  }

  return roads;
}

/**
 * Helper: Generate circle coordinates for cul-de-sac
 */
function generateCircleCoords(
  center: Coordinate, 
  radius: number, 
  latDegPerMeter: number
): Coordinate[] {
  const coords: Coordinate[] = [];
  const segments = 12;
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    coords.push({
      lat: center.lat + (Math.sin(angle) * radius * latDegPerMeter * 111320),
      lng: center.lng + (Math.cos(angle) * radius)
    });
  }
  return coords;
}

/**
 * Calculate subdivision statistics with truncation accounting
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
  
  // Account for truncated areas
  const truncatedArea = plots.reduce((sum, p) => sum + (p.truncatedArea || 0), 0);
  const totalPlotAreaSqm = (validPlots.length * plotAreaSqm) - truncatedArea;
  
  // Road area: Spine (12m) + Ribs (9m) - more efficient than ring roads
  const numRows = Math.ceil(plots.length / Math.max(1, Math.floor(Math.sqrt(plots.length))));
  const numRibs = Math.floor(numRows / 2);
  const plotsPerRow = plots.length > 0 ? Math.ceil(plots.length / Math.max(1, numRows)) : 0;
  
  // Spine road length (full depth)
  const spineLength = numRows * plotDepth;
  const spineArea = 12 * spineLength;
  
  // Rib roads (half width each side)
  const ribLength = (plotsPerRow * plotWidth) / 2;
  const ribArea = numRibs * 2 * roadWidth * ribLength;
  
  const roadAreaSqm = spineArea + ribArea;
  
  // Efficiency: sellable area / total area
  const efficiency = parcelAreaSqm > 0 ? (totalPlotAreaSqm / parcelAreaSqm) * 100 : 0;
  
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
