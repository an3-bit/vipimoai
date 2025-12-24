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

export interface PlotGridResult {
  plots: GeneratedPlot[];
  validCount: number;
  invalidCount: number;
  totalAreaSqm: number;
  plotAreaSqm: number;
  roadAreaSqm: number;
  efficiency: number;
}

// Generate plot grid with riparian collision detection
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

  // Convert meters to degrees (approximate)
  const latDegPerMeter = 1 / 111320;
  const lngDegPerMeter = 1 / (111320 * Math.cos(minLat * Math.PI / 180));

  const plotWidthDeg = plotWidth * lngDegPerMeter;
  const plotDepthDeg = plotDepth * latDegPerMeter;
  const roadWidthDegLat = roadWidth * latDegPerMeter;
  const roadWidthDegLng = roadWidth * lngDegPerMeter;

  // Starting with a setback
  const setback = 0.0002;
  let currentLat = minLat + setback;
  let rowCount = 0;

  while (currentLat + plotDepthDeg < maxLat - setback) {
    let currentLng = minLng + setback;
    
    while (currentLng + plotWidthDeg < maxLng - setback) {
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
      
      plots.push({
        coordinates: plotCoords,
        isValid,
        overlapPercent,
      });
      
      // Move to next plot with small gap
      currentLng += plotWidthDeg + (roadWidthDegLng * 0.15);
    }
    
    rowCount++;
    // Add road every 2 rows
    if (rowCount % 2 === 0) {
      currentLat += plotDepthDeg + roadWidthDegLat;
    } else {
      currentLat += plotDepthDeg + (roadWidthDegLat * 0.15);
    }
  }

  return plots;
}

// Calculate subdivision statistics with real math
export function calculateSubdivisionStats(
  parcelAreaSqm: number,
  plots: GeneratedPlot[],
  plotWidth: number,
  plotDepth: number
): { validCount: number; invalidCount: number; efficiency: number; plotAreaSqm: number } {
  const validPlots = plots.filter(p => p.isValid);
  const invalidPlots = plots.filter(p => !p.isValid);
  const plotAreaSqm = plotWidth * plotDepth;
  const totalPlotArea = validPlots.length * plotAreaSqm;
  const efficiency = parcelAreaSqm > 0 ? (totalPlotArea / parcelAreaSqm) * 100 : 0;
  
  return {
    validCount: validPlots.length,
    invalidCount: invalidPlots.length,
    efficiency: Math.min(efficiency, 100), // Cap at 100%
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
