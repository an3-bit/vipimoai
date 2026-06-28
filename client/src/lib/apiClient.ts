/**
 * VipimoAI Django Backend API Client
 * 
 * Provides typed access to the Django REST API at VITE_API_BASE_URL.
 * JWT tokens are read from localStorage (set by login flow).
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  return localStorage.getItem('vipimo_access_token');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('vipimo_refresh_token');
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('vipimo_access_token', access);
  localStorage.setItem('vipimo_refresh_token', refresh);
}

export function clearTokens() {
  localStorage.removeItem('vipimo_access_token');
  localStorage.removeItem('vipimo_refresh_token');
}

export function isDjangoAuthenticated(): boolean {
  return !!getAccessToken();
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${API_BASE}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const data = await res.json();
  if (data.access) {
    localStorage.setItem('vipimo_access_token', data.access);
    return data.access;
  }
  return null;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip auth header (e.g. login, register) */
  anonymous?: boolean;
}

async function apiFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!anonymous) {
    let token = getAccessToken();
    if (!token) throw new Error('Not authenticated with Django backend');
    headers['Authorization'] = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  let response = await fetch(`${API_BASE}${path}`, init);

  // Auto-refresh on 401
  if (response.status === 401 && !anonymous) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    }
  }

  if (!response.ok) {
    let errorMsg = `API Error ${response.status}`;
    try {
      const errBody = await response.json();
      errorMsg = errBody.detail || errBody.error || JSON.stringify(errBody);
    } catch {
      // ignore parse error
    }
    throw new Error(errorMsg);
  }

  // Handle 204 No Content
  if (response.status === 204) return undefined as unknown as T;

  return response.json() as Promise<T>;
}

// ─── Auth endpoints ───────────────────────────────────────────────────────────

export interface LoginResponse {
  access: string;
  refresh: string;
}

export async function djangoLogin(username: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/token/', {
    method: 'POST',
    body: { username, password },
    anonymous: true,
  });
  setTokens(data.access, data.refresh);
  return data;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export async function djangoRegister(payload: RegisterPayload) {
  return apiFetch('/register/', { method: 'POST', body: payload, anonymous: true });
}

// ─── AI Subdivision endpoint ──────────────────────────────────────────────────

export interface TargetAreaEntry {
  value: number;
  unit: 'SQM' | 'HECTARES' | 'HA' | 'ACRES' | 'AC';
}

export interface SubdivideRequest {
  parcelCoordinates: { lat: number; lng: number }[];
  strategy: 'auto_fit' | 'fixed_count' | 'equal_resize' | 'succession';
  /** Required for rectangular strategies */
  plot_width?: number;
  plot_depth?: number;
  target_plot_count?: number;
  road_setback_m?: number;
  side_setback_m?: number;
  orientation_degrees?: number;
  notes?: string;
  /** Required for succession strategy */
  target_areas?: TargetAreaEntry[];
  /** CRS name, e.g. "EPSG:21037" for Kenya East Arc 1960 Zone 37S */
  crs_name?: string;
}

export interface SubdividePlot {
  plot_number: number;
  coordinates: { lat: number; lng: number }[];
  area_sqm: number;
  width_m: number;
  depth_m: number;
  centroid?: { lat: number; lng: number };
  is_partial: boolean;
  status: string;
}

export interface SubdivideBeacon {
  beacon_number: number;
  latitude: number;
  longitude: number;
  easting?: number;
  northing?: number;
  description: string;
}

export interface SubdivideResponse {
  success: boolean;
  parcel: {
    area_sqm: number;
    width_m: number;
    depth_m: number;
    coordinates: { lat: number; lng: number }[];
  };
  subdivision: {
    strategy: string;
    crs_name: string;
    plot_width?: number;
    plot_depth?: number;
    road_setback_m?: number;
    side_setback_m?: number;
    orientation_degrees?: number;
    target_plot_count?: number;
  };
  results: {
    total_plots: number;
    plots: SubdividePlot[];
    beacons: SubdivideBeacon[];
    efficiency_percent: number;
  };
  suggestions: { type: string; message: string; [key: string]: unknown }[];
  ai_analysis: unknown | null;
}

export async function djangoSubdivide(payload: SubdivideRequest): Promise<SubdivideResponse> {
  return apiFetch<SubdivideResponse>('/subdivide/', { method: 'POST', body: payload });
}

// ─── Coordinate Ingestion (NEW) ──────────────────────────────────────────────

export interface IngestCoordinatesRequest {
  coordinates: { lat: number; lng: number }[];
  crs_input?: string;
  crs_output?: string;
}

export interface ProjectedCoordinate {
  easting: number;
  northing: number;
}

export interface IngestCoordinatesResponse {
  success: boolean;
  data: {
    wgs84_coordinates: { lat: number; lng: number }[];
    projected_coordinates: ProjectedCoordinate[];
    area: {
      square_meters: number;
      hectares: number;
      acres: number;
    };
    crs_input: string;
    crs_output: string;
  };
}

/**
 * Ingest WGS84 coordinates and get authoritative area calculation.
 * 
 * The backend will:
 * 1. Accept WGS84 coordinates
 * 2. Project to Arc 1960 (SRID 21037)
 * 3. Calculate exact planar area
 * 4. Return both coordinate formats + area in multiple units
 */
export async function ingestCoordinates(payload: IngestCoordinatesRequest): Promise<IngestCoordinatesResponse> {
  return apiFetch<IngestCoordinatesResponse>('/rtk/ingest-coordinates/', { method: 'POST', body: payload });
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface DjangoProject {
  id: string;
  name: string;
  description?: string;
  client_name?: string;
  location_name?: string;
  total_area_ha?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function djangoGetProjects(): Promise<DjangoProject[]> {
  return apiFetch<DjangoProject[]>('/projects/');
}

export async function djangoCreateProject(data: Partial<DjangoProject>): Promise<DjangoProject> {
  return apiFetch<DjangoProject>('/projects/', { method: 'POST', body: data });
}

export async function djangoUpdateProject(id: string, data: Partial<DjangoProject>): Promise<DjangoProject> {
  return apiFetch<DjangoProject>(`/projects/${id}/`, { method: 'PATCH', body: data });
}

// ─── Plots (bulk) ─────────────────────────────────────────────────────────────

export interface DjangoPlotPayload {
  plot_number: number;
  coordinates: { lat: number; lng: number }[];
  area_sqm: number;
  status?: string;
  is_partial?: boolean;
  width_m?: number;
  depth_m?: number;
}

export async function djangoBulkCreatePlots(projectId: string, plots: DjangoPlotPayload[]) {
  return apiFetch('/plots/bulk-create/', {
    method: 'POST',
    body: { project_id: projectId, plots },
  });
}

export async function djangoBulkDeletePlots(projectId: string) {
  return apiFetch(`/plots/bulk-delete/?project_id=${projectId}`, { method: 'DELETE' });
}

// ─── RIM / Vision endpoints ─────────────────────────────────────────────────

export async function djangoCreateRIM(payload: { name?: string; project_id?: string; crs?: string; bbox?: any; metadata?: any }) {
  return apiFetch('/rims/', { method: 'POST', body: payload });
}

export async function djangoUploadRIM(rimId: number, file: File, tie_points?: any) {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const form = new FormData();
  form.append('file', file);
  if (tie_points) form.append('tie_points', JSON.stringify(tie_points));

  const res = await fetch(`${API_BASE}/rims/${rimId}/upload/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upload failed: ${res.status} ${txt}`);
  }

  return res.json();
}

export async function djangoIngestVision(payload: { rim_id?: number; image_path?: string; polygon?: any; crs?: string; options?: any }) {
  return apiFetch('/ingest/', { method: 'POST', body: payload });
}

export function taskWebSocketUrl(taskId: string) {
  // Derive ws URL from API_BASE: e.g. http://host:8000/api -> ws://host:8000/ws/tasks/<id>/
  const apiUrl = API_BASE.replace(/\/api\/?$/, '');
  const wsProto = apiUrl.startsWith('https') ? 'wss' : 'ws';
  return `${wsProto}://${apiUrl.replace(/^https?:\/\//, '')}/ws/tasks/${taskId}/`;
}
