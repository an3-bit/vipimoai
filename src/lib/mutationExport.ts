import { Coordinate, Plot, Beacon } from '@/types/survey';
import { wgs84ToUTM } from '@/lib/coordinates';
import { sqmToHectares } from '@/lib/geometry';

export interface MutationExportData {
  surveyor_id: string;
  surveyor_name?: string;
  project_name: string;
  coordinate_system: string;
  drawing_scale: string;
  survey_date: string;
  mutation_block: {
    mother_title: string;
    status: 'CLOSED' | 'OPEN';
    registered_owner: string;
    original_area_ha: number;
    perimeter_m: number;
    abuttals: string[];
    geometry_collection: {
      plot_no: string;
      new_title_number: string;
      area_ha: number;
      area_sqm: number;
      width_m: number | null;
      depth_m: number | null;
      type: 'Full' | 'Partial';
      status: 'OPEN';
      coordinates: {
        corner: number;
        beacon_id: string;
        northing: number;
        easting: number;
        latitude: number;
        longitude: number;
      }[];
    }[];
  };
  boundary_beacons: {
    beacon_id: string;
    northing: number;
    easting: number;
    latitude: number;
    longitude: number;
    description?: string;
  }[];
  metadata: {
    format: string;
    version: string;
    export_date: string;
    generated_by: string;
    crs_epsg: string;
  };
}

export type DrawingScale = '1:500' | '1:1000' | '1:2500' | '1:5000' | '1:10000';

interface ExportParams {
  projectName: string;
  clientName?: string;
  surveyorLicense?: string;
  surveyorName?: string;
  parcelCoordinates: Coordinate[];
  parcelAreaSqm: number;
  perimeterM: number;
  plots: Plot[];
  beacons: Beacon[];
  scale: DrawingScale;
  abuttals?: string[];
}

export function generateMutationJSON(params: ExportParams): MutationExportData {
  const {
    projectName,
    clientName,
    surveyorLicense,
    surveyorName,
    parcelCoordinates,
    parcelAreaSqm,
    perimeterM,
    plots,
    beacons,
    scale,
    abuttals = [],
  } = params;

  const motherTitle = `${projectName.toUpperCase().replace(/\s+/g, '/')}/0000`;
  const areaHa = sqmToHectares(parcelAreaSqm);
  
  // Build geometry collection from plots
  const geometryCollection = plots.map((plot) => {
    const plotAreaHa = sqmToHectares(plot.area_sqm);
    const coordinates = plot.coordinates.map((coord, idx) => {
      const utm = wgs84ToUTM(coord.lat, coord.lng);
      return {
        corner: idx + 1,
        beacon_id: `BK${plot.plot_number}-${idx + 1}`,
        northing: parseFloat(utm.northing.toFixed(3)),
        easting: parseFloat(utm.easting.toFixed(3)),
        latitude: coord.lat,
        longitude: coord.lng,
      };
    });

    return {
      plot_no: String(plot.plot_number),
      new_title_number: `${motherTitle.replace('/0000', '')}/${String(plot.plot_number).padStart(4, '0')}`,
      area_ha: parseFloat(plotAreaHa.toFixed(4)),
      area_sqm: plot.area_sqm,
      width_m: plot.width_m || null,
      depth_m: plot.depth_m || null,
      type: (plot.is_partial ? 'Partial' : 'Full') as 'Full' | 'Partial',
      status: 'OPEN' as const,
      coordinates,
    };
  });

  // Build boundary beacons
  const boundaryBeacons = parcelCoordinates.map((coord, idx) => {
    const utm = wgs84ToUTM(coord.lat, coord.lng);
    return {
      beacon_id: `BK${idx + 1}`,
      northing: parseFloat(utm.northing.toFixed(3)),
      easting: parseFloat(utm.easting.toFixed(3)),
      latitude: coord.lat,
      longitude: coord.lng,
    };
  });

  // Build the export data
  const exportData: MutationExportData = {
    surveyor_id: surveyorLicense || 'LS/2024/XXXX',
    surveyor_name: surveyorName,
    project_name: projectName,
    coordinate_system: 'Arc 1960',
    drawing_scale: scale,
    survey_date: new Date().toISOString().split('T')[0],
    mutation_block: {
      mother_title: motherTitle,
      status: 'CLOSED',
      registered_owner: clientName || 'N/A',
      original_area_ha: parseFloat(areaHa.toFixed(4)),
      perimeter_m: parseFloat(perimeterM.toFixed(2)),
      abuttals: abuttals.length > 0 ? abuttals : detectAbuttals(parcelCoordinates),
      geometry_collection: geometryCollection,
    },
    boundary_beacons: boundaryBeacons,
    metadata: {
      format: 'Survey of Kenya Mutation Schema',
      version: '2.0',
      export_date: new Date().toISOString(),
      generated_by: 'VipimoAI',
      crs_epsg: 'EPSG:21037', // Arc 1960 / UTM zone 37S
    },
  };

  return exportData;
}

// Simple abuttal detection based on boundary orientation
function detectAbuttals(coords: Coordinate[]): string[] {
  if (coords.length < 3) return [];
  
  const abuttals: string[] = [];
  const directions = ['South', 'East', 'North', 'West'];
  
  // Simple approach: one abuttal per side
  for (let i = 0; i < Math.min(4, coords.length); i++) {
    abuttals.push(`${directions[i % 4]} Boundary`);
  }
  
  return abuttals;
}

export function downloadMutationJSON(data: MutationExportData, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
