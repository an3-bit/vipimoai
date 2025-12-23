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

// Simulated river/riparian zone
export const mockRiparianZone = [
  { lat: -1.1135, lng: 37.1140 },
  { lat: -1.1140, lng: 37.1165 },
  { lat: -1.1150, lng: 37.1190 },
  { lat: -1.1145, lng: 37.1220 },
  { lat: -1.1155, lng: 37.1220 },
  { lat: -1.1160, lng: 37.1185 },
  { lat: -1.1150, lng: 37.1160 },
  { lat: -1.1145, lng: 37.1140 },
];

// Generate plot grid
export function generatePlotGrid(
  parcel: { lat: number; lng: number }[],
  plotWidth: number = 15.24, // 50ft in meters
  plotDepth: number = 30.48, // 100ft in meters
  roadWidth: number = 9
) {
  const plots: { lat: number; lng: number }[][] = [];
  
  const minLat = Math.min(...parcel.map(p => p.lat));
  const maxLat = Math.max(...parcel.map(p => p.lat));
  const minLng = Math.min(...parcel.map(p => p.lng));
  const maxLng = Math.max(...parcel.map(p => p.lng));

  // Convert meters to degrees (approximate)
  const latDegPerMeter = 1 / 111320;
  const lngDegPerMeter = 1 / (111320 * Math.cos(minLat * Math.PI / 180));

  const plotWidthDeg = plotWidth * lngDegPerMeter;
  const plotDepthDeg = plotDepth * latDegPerMeter;
  const roadWidthDeg = roadWidth * latDegPerMeter;

  let currentLat = minLat + 0.0002; // Small setback
  let rowCount = 0;

  while (currentLat + plotDepthDeg < maxLat - 0.0002) {
    let currentLng = minLng + 0.0002;
    
    while (currentLng + plotWidthDeg < maxLng - 0.0002) {
      const plot = [
        { lat: currentLat, lng: currentLng },
        { lat: currentLat, lng: currentLng + plotWidthDeg },
        { lat: currentLat + plotDepthDeg, lng: currentLng + plotWidthDeg },
        { lat: currentLat + plotDepthDeg, lng: currentLng },
      ];
      plots.push(plot);
      currentLng += plotWidthDeg + (roadWidthDeg * 0.1); // Small gap between plots
    }
    
    rowCount++;
    // Add road every 2 rows
    if (rowCount % 2 === 0) {
      currentLat += plotDepthDeg + roadWidthDeg * latDegPerMeter;
    } else {
      currentLat += plotDepthDeg + (roadWidthDeg * 0.1 * latDegPerMeter);
    }
  }

  return plots;
}

// Chat messages for simulation
export const mockChatMessages = [
  {
    role: "ai" as const,
    content: "Welcome to Vipimo Co-Pilot! I'm ready to help you with your subdivision. What would you like to do?",
    timestamp: new Date(Date.now() - 60000),
  },
];
