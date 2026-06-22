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
  bearing?: number;  // NEW: Edge bearing for grid alignment
  length?: number;   // NEW: Edge length in meters
}

export interface RoadSegment {
  type: 'spine' | 'rib' | 'culdesac';
  coordinates: Coordinate[];
  width: number;
}

// Area thresholds
const ONE_ACRE_SQM = 4046.86;
const HALF_HECTARE_SQM = 5000; // 0.5 Ha

/**
 * SUPER-GRID "Cookie Cutter" Algorithm
 * 
 * Strategy:
 * 1. Anchor: Use selected edge bearing for grid rotation (or find longest edge)
 * 2. Expand: Pad bounding box by 50% to ensure full coverage
 * 3. Rotate: Align grid to anchor bearing
 * 4. Generate: Create plots filling the expanded area
 * 5. The Cut: Filter using intersection:
 *    - > 90% of target area = Valid Plot
 *    - 10-90% = Residual Plot (Yellow)
 *    - 0% = Delete
 * 6. Small Plot Protection: For < 0.5 Ha with access, disable internal roads
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

  // Calculate parcel area in sqm
  const parcelWidthM = (maxLng - minLng) / lngDegPerMeter;
  const parcelHeightM = (maxLat - minLat) / latDegPerMeter;
  const parcelAreaSqm = parcelWidthM * parcelHeightM;
  
  // Target plot area
  const targetPlotArea = plotWidth * plotDepth;

  // SMALL PLOT PROTECTION: For parcels < 0.5 Ha with access edges, use front row only
  const isSmallParcel = parcelAreaSqm < HALF_HECTARE_SQM;
  const hasAccessEdge = accessEdges.length > 0;
  const useFrontRowOnly = isSmallParcel && hasAccessEdge;
  
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
  
  // Perimeter setback (3m boundary buffer for fencing - except on access edge)
  const perimeterSetback = 3;
  const setbackLat = perimeterSetback * latDegPerMeter;
  const setbackLng = perimeterSetback * lngDegPerMeter;

  // Determine access edge and get anchor bearing
  const primaryAccessEdge = accessEdges.length > 0 ? accessEdges[0] : null;
  const anchorBearing = primaryAccessEdge?.bearing || 0;
  const accessEdgeIndex = primaryAccessEdge?.edgeIndex ?? -1;
  
  // Edge definitions: 0=South, 1=East, 2=North, 3=West
  const hasAccessSouth = accessEdgeIndex === 0;
  const hasAccessNorth = accessEdgeIndex === 2;
  const hasAccessWest = accessEdgeIndex === 3;
  const hasAccessEast = accessEdgeIndex === 1;
  const hasAnyAccess = accessEdgeIndex >= 0;

  // Calculate usable bounds with setbacks (except on access edge)
  const usableMinLat = hasAccessSouth ? minLat : minLat + setbackLat;
  const usableMaxLat = hasAccessNorth ? maxLat : maxLat - setbackLat;
  const usableMinLng = hasAccessWest ? minLng : minLng + setbackLng;
  const usableMaxLng = hasAccessEast ? maxLng : maxLng - setbackLng;
  
  // SUPER-GRID Strategy:
  // Step 1: Expand bounding box by 50% for coverage
  const expandFactor = 0.5;
  const widthExpansion = (maxLng - minLng) * expandFactor / 2;
  const heightExpansion = (maxLat - minLat) * expandFactor / 2;
  
  const expandedMinLng = minLng - widthExpansion;
  const expandedMaxLng = maxLng + widthExpansion;
  const expandedMinLat = minLat - heightExpansion;
  const expandedMaxLat = maxLat + heightExpansion;

  // Helper to rotate a point around center
  function rotatePoint(
    point: { lat: number; lng: number },
    center: { lat: number; lng: number },
    angleDeg: number
  ): { lat: number; lng: number } {
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    const dx = point.lng - center.lng;
    const dy = point.lat - center.lat;
    
    return {
      lng: center.lng + dx * cos - dy * sin,
      lat: center.lat + dx * sin + dy * cos
    };
  }
  
  // Helper to check if a point is inside the original parcel
  function isPointInParcel(point: { lat: number; lng: number }): boolean {
    let inside = false;
    for (let i = 0, j = parcel.length - 1; i < parcel.length; j = i++) {
      const xi = parcel[i].lng, yi = parcel[i].lat;
      const xj = parcel[j].lng, yj = parcel[j].lat;
      
      if (((yi > point.lat) !== (yj > point.lat)) &&
          (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
  
  // Helper to calculate plot area (simple rectangle approximation for speed)
  function calculatePlotArea(coords: Coordinate[]): number {
    if (coords.length < 3) return 0;
    const latRange = Math.max(...coords.map(c => c.lat)) - Math.min(...coords.map(c => c.lat));
    const lngRange = Math.max(...coords.map(c => c.lng)) - Math.min(...coords.map(c => c.lng));
    return (latRange / latDegPerMeter) * (lngRange / lngDegPerMeter);
  }
  
  // Helper to count corners inside parcel
  function countCornersInside(coords: Coordinate[]): number {
    return coords.filter(c => isPointInParcel(c)).length;
  }
  
  // Calculate grid rotation based on anchor bearing
  // For grid alignment, we want plots parallel to the anchor edge
  const gridRotation = anchorBearing;
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };

  // SMALL PLOT MODE: Just generate front-facing plots without internal roads
  if (useFrontRowOnly) {
    console.log('[SuperGrid] Small parcel mode: Front row only, no internal roads');
    
    // Calculate how many plots fit along the access edge
    let plotsAlongEdge = 0;
    let startLat = usableMinLat;
    let startLng = usableMinLng;
    
    if (hasAccessSouth || hasAccessNorth) {
      // Plots run East-West along access
      const usableWidth = usableMaxLng - usableMinLng;
      plotsAlongEdge = Math.floor(usableWidth / plotWidthDeg);
      startLat = hasAccessSouth ? usableMinLat : usableMaxLat - plotDepthDeg;
      
      // Generate single row of front-facing plots
      for (let col = 0; col < plotsAlongEdge; col++) {
        const plotLng = usableMinLng + (col * plotWidthDeg);
        
        const plotCoords: Coordinate[] = [
          { lat: startLat, lng: plotLng },
          { lat: startLat, lng: plotLng + plotWidthDeg },
          { lat: startLat + plotDepthDeg, lng: plotLng + plotWidthDeg },
          { lat: startLat + plotDepthDeg, lng: plotLng },
        ];
        
        const cornersInside = countCornersInside(plotCoords);
        const areaRatio = cornersInside / 4;
        
        if (areaRatio >= 0.9) {
          const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
          plots.push({ coordinates: plotCoords, isValid, overlapPercent });
        } else if (areaRatio >= 0.1) {
          // Residual plot
          const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
          plots.push({ coordinates: plotCoords, isValid, overlapPercent, isTruncated: true });
        }
      }
      
      // Add remaining rows if they fit
      let currentLat = hasAccessSouth ? startLat + plotDepthDeg : startLat - plotDepthDeg;
      const endLat = hasAccessSouth ? usableMaxLat : usableMinLat;
      
      while (hasAccessSouth ? (currentLat + plotDepthDeg <= endLat) : (currentLat - plotDepthDeg >= endLat)) {
        for (let col = 0; col < plotsAlongEdge; col++) {
          const plotLng = usableMinLng + (col * plotWidthDeg);
          
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
          
          const cornersInside = countCornersInside(plotCoords);
          if (cornersInside >= 3) {
            const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
            plots.push({ coordinates: plotCoords, isValid, overlapPercent });
          }
        }
        currentLat = hasAccessSouth ? currentLat + plotDepthDeg : currentLat - plotDepthDeg;
      }
    } else if (hasAccessEast || hasAccessWest) {
      // Plots run North-South along access
      const usableHeight = usableMaxLat - usableMinLat;
      plotsAlongEdge = Math.floor(usableHeight / plotDepthDeg);
      startLng = hasAccessWest ? usableMinLng : usableMaxLng - plotWidthDeg;
      
      for (let row = 0; row < plotsAlongEdge; row++) {
        const plotLat = usableMinLat + (row * plotDepthDeg);
        
        const plotCoords: Coordinate[] = [
          { lat: plotLat, lng: startLng },
          { lat: plotLat, lng: startLng + plotWidthDeg },
          { lat: plotLat + plotDepthDeg, lng: startLng + plotWidthDeg },
          { lat: plotLat + plotDepthDeg, lng: startLng },
        ];
        
        const cornersInside = countCornersInside(plotCoords);
        const areaRatio = cornersInside / 4;
        
        if (areaRatio >= 0.9) {
          const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
          plots.push({ coordinates: plotCoords, isValid, overlapPercent });
        } else if (areaRatio >= 0.1) {
          const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
          plots.push({ coordinates: plotCoords, isValid, overlapPercent, isTruncated: true });
        }
      }
      
      // Add remaining columns
      let currentLng = hasAccessWest ? startLng + plotWidthDeg : startLng - plotWidthDeg;
      const endLng = hasAccessWest ? usableMaxLng : usableMinLng;
      
      while (hasAccessWest ? (currentLng + plotWidthDeg <= endLng) : (currentLng - plotWidthDeg >= endLng)) {
        for (let row = 0; row < plotsAlongEdge; row++) {
          const plotLat = usableMinLat + (row * plotDepthDeg);
          
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
          
          const cornersInside = countCornersInside(plotCoords);
          if (cornersInside >= 3) {
            const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
            plots.push({ coordinates: plotCoords, isValid, overlapPercent });
          }
        }
        currentLng = hasAccessWest ? currentLng + plotWidthDeg : currentLng - plotWidthDeg;
      }
    }
    
    return plots;
  }

  // STANDARD MODE: Full Super-Grid with Spine & Ribs
  const isVerticalSpine = hasAccessSouth || hasAccessNorth || !hasAnyAccess;
  
  if (isVerticalSpine) {
    // Spine runs North-South from access edge
    const spineCenterLng = usableMinLng + (usableMaxLng - usableMinLng) / 2;
    const spineLeftLng = spineCenterLng - (spineWidthDeg / 2);
    const spineRightLng = spineCenterLng + (spineWidthDeg / 2);
    
    // Generate plots on BOTH sides of spine
    const sides: ('left' | 'right')[] = ['left', 'right'];
    
    for (const side of sides) {
      const sideStartLng = side === 'left' ? usableMinLng : spineRightLng;
      const sideEndLng = side === 'left' ? spineLeftLng : usableMaxLng;
      const sideWidthDeg = Math.abs(sideEndLng - sideStartLng);
      const sideWidthM = sideWidthDeg / lngDegPerMeter;
      
      // Super-Grid: Generate more plots than needed with padding
      const plotsAcross = Math.ceil(sideWidthM / plotWidth) + 2; // +2 for padding
      if (plotsAcross <= 0) continue;
      
      // Start positions
      let currentLat = hasAccessSouth ? usableMinLat : (hasAccessNorth ? usableMaxLat - plotDepthDeg : usableMinLat);
      const maxLimitLat = hasAccessNorth ? usableMinLat : usableMaxLat;
      const direction = hasAccessSouth || !hasAnyAccess ? 1 : -1;
      
      let rowCount = 0;
      
      while (direction > 0 ? (currentLat + plotDepthDeg <= maxLimitLat) : (currentLat >= maxLimitLat)) {
        const isRibRow = rowCount > 0 && rowCount % 2 === 0;
        
        // Add rib road gap every 2 rows
        if (isRibRow && !isSmallParcel) {
          currentLat += direction * ribWidthDeg;
        }
        
        // Generate plots in this row with Super-Grid expansion
        for (let col = 0; col < plotsAcross; col++) {
          const plotLng = side === 'left' 
            ? sideEndLng - ((col + 1) * plotWidthDeg)
            : sideStartLng + (col * plotWidthDeg);
          
          const isTruncated = col === 0 && isRibRow;
          
          const plotCoords: Coordinate[] = direction > 0 ? [
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
          
          // COOKIE CUTTER: Check intersection with parcel boundary
          const cornersInside = countCornersInside(plotCoords);
          const areaRatio = cornersInside / 4;
          
          // > 90% = Valid Plot, 10-90% = Residual, 0% = Delete
          if (areaRatio >= 0.9) {
            const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
            plots.push({ 
              coordinates: plotCoords, 
              isValid, 
              overlapPercent,
              isTruncated,
              truncatedArea: isTruncated ? truncation * truncation : 0
            });
          } else if (areaRatio >= 0.1) {
            // Residual plot (Yellow)
            const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
            plots.push({ 
              coordinates: plotCoords, 
              isValid, 
              overlapPercent,
              isTruncated: true,
              truncatedArea: (1 - areaRatio) * targetPlotArea
            });
          }
          // areaRatio < 0.1 = Delete (don't add)
        }
        
        currentLat += direction * plotDepthDeg;
        rowCount++;
      }
    }
  } else {
    // Horizontal spine (East-West access)
    const spineCenterLat = usableMinLat + (usableMaxLat - usableMinLat) / 2;
    const spineBottomLat = spineCenterLat - (spineWidth * latDegPerMeter / 2);
    const spineTopLat = spineCenterLat + (spineWidth * latDegPerMeter / 2);
    
    const sides: ('above' | 'below')[] = ['above', 'below'];
    
    for (const side of sides) {
      const sideStartLat = side === 'below' ? usableMinLat : spineTopLat;
      const sideEndLat = side === 'below' ? spineBottomLat : usableMaxLat;
      const sideHeightDeg = Math.abs(sideEndLat - sideStartLat);
      const sideHeightM = sideHeightDeg / latDegPerMeter;
      
      const plotsAcross = Math.ceil(sideHeightM / plotDepth) + 2;
      if (plotsAcross <= 0) continue;
      
      let currentLng = hasAccessWest ? usableMinLng : usableMaxLng - plotWidthDeg;
      const maxLimitLng = hasAccessWest ? usableMaxLng : usableMinLng;
      const direction = hasAccessWest ? 1 : -1;
      
      let colCount = 0;
      
      while (direction > 0 ? (currentLng + plotWidthDeg <= maxLimitLng) : (currentLng >= maxLimitLng)) {
        const isRibCol = colCount > 0 && colCount % 2 === 0;
        
        if (isRibCol && !isSmallParcel) {
          currentLng += direction * ribWidth * lngDegPerMeter;
        }
        
        for (let row = 0; row < plotsAcross; row++) {
          const plotLat = side === 'below' 
            ? sideEndLat - ((row + 1) * plotDepthDeg)
            : sideStartLat + (row * plotDepthDeg);
          
          const isTruncated = row === 0 && isRibCol;
          
          const plotCoords: Coordinate[] = direction > 0 ? [
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
          
          const cornersInside = countCornersInside(plotCoords);
          const areaRatio = cornersInside / 4;
          
          if (areaRatio >= 0.9) {
            const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
            plots.push({ 
              coordinates: plotCoords, 
              isValid, 
              overlapPercent,
              isTruncated,
              truncatedArea: isTruncated ? truncation * truncation : 0
            });
          } else if (areaRatio >= 0.1) {
            const { isValid, overlapPercent } = checkRiparianValidity(plotCoords, riparianBuffer);
            plots.push({ 
              coordinates: plotCoords, 
              isValid, 
              overlapPercent,
              isTruncated: true,
              truncatedArea: (1 - areaRatio) * targetPlotArea
            });
          }
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
