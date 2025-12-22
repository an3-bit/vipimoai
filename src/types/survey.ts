export interface Coordinate {
  lat: number;
  lng: number;
}

export interface Beacon {
  id: string;
  beacon_number: number;
  latitude: number;
  longitude: number;
  easting?: number;
  northing?: number;
  description?: string;
}

export interface Plot {
  id: string;
  plot_number: number;
  coordinates: Coordinate[];
  area_sqm: number;
  width_m?: number;
  depth_m?: number;
  is_partial: boolean;
  beacons?: Beacon[];
}

export interface Subdivision {
  id: string;
  parcel_id: string;
  plot_width: number;
  plot_depth: number;
  target_plot_count?: number;
  strategy: 'auto_fit' | 'fixed_count' | 'equal_resize' | 'extract_full';
  orientation_degrees: number;
  road_setback_m: number;
  side_setback_m: number;
  notes?: string;
  ai_suggestions?: AISuggestion[];
  plots?: Plot[];
}

export interface Parcel {
  id: string;
  project_id: string;
  name: string;
  coordinates: Coordinate[];
  crs: string;
  area_sqm?: number;
  perimeter_m?: number;
  centroid?: Coordinate;
  subdivisions?: Subdivision[];
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  client_name?: string;
  client_email?: string;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  parcels?: Parcel[];
}

export interface AISuggestion {
  type: 'resize' | 'extract_full' | 'alternative_layout' | 'warning';
  message: string;
  suggested_width?: number;
  suggested_depth?: number;
  suggested_count?: number;
}

export interface SubdivisionFormData {
  plot_width: number;
  plot_depth: number;
  target_plot_count?: number;
  strategy: 'auto_fit' | 'fixed_count' | 'equal_resize' | 'extract_full';
  orientation_degrees: number;
  road_setback_m: number;
  side_setback_m: number;
  notes?: string;
}

export interface ExportFile {
  id: string;
  project_id: string;
  export_type: 'pdf' | 'csv' | 'dxf' | 'geojson' | 'kml';
  file_url?: string;
  file_name: string;
  created_at: string;
}
