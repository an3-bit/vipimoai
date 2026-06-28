import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Coordinate {
  lat: number;
  lng: number;
}

interface Parcel {
  id: string;
  coordinates?: Coordinate[];
  centroid?: { lat: number; lng: number };
  area_sqm?: number;
}

interface Project {
  id: string;
  name: string;
  client_name: string;
  status: string;
  lat: number;
  lng: number;
  acres: number;
  plots: number;
  parcels?: Parcel[];
}

interface MapViewProps {
  projects: Project[];
  mapLayer: 'standard' | 'satellite';
}

const createProjectIcon = (status: string) => {
  const colors = {
    draft: '#6b7280',
    in_progress: '#f59e0b',
    completed: '#10b981',
    archived: '#64748b',
  };
  const color = colors[status as keyof typeof colors] || colors.draft;
  
  return L.divIcon({
    className: 'project-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: ${color};
        border: 3px solid rgba(255,255,255,0.9);
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

function MapBoundsAdjuster({ projects }: { projects: Project[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (projects.length > 0) {
      const bounds = L.latLngBounds([]);
      
      projects.forEach(project => {
        // Add centroid for bounds
        if (project.lat && project.lng) {
          bounds.extend([project.lat, project.lng]);
        }
        
        // Add parcel coordinates for bounds
        if (project.parcels && project.parcels.length > 0) {
          project.parcels.forEach(parcel => {
            if (parcel.coordinates && parcel.coordinates.length > 0) {
              parcel.coordinates.forEach(coord => {
                bounds.extend([coord.lat, coord.lng]);
              });
            }
          });
        }
      });
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 11 });
      }
    }
  }, [projects, map]);
  
  return null;
}

const getPolygonColor = (status: string) => {
  const colors = {
    draft: '#9ca3af',
    in_progress: '#fbbf24',
    completed: '#34d399',
    archived: '#94a3b8',
  };
  return colors[status as keyof typeof colors] || colors.draft;
};

export function MapView({ projects, mapLayer }: MapViewProps) {
  const navigate = useNavigate();

  return (
    <MapContainer
      center={[-1.2, 37.0]}
      zoom={10}
      maxZoom={22}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={mapLayer === 'satellite' 
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        }
        maxZoom={22}
        maxNativeZoom={mapLayer === 'satellite' ? 17 : 19}
      />
      <MapBoundsAdjuster projects={projects} />
      
      {/* Parcel Polygons */}
      {projects.map((project) => 
        project.parcels?.map((parcel) => {
          if (!parcel.coordinates || parcel.coordinates.length < 3) return null;
          
          const positions = parcel.coordinates.map(coord => [coord.lat, coord.lng] as [number, number]);
          const color = getPolygonColor(project.status);
          
          return (
            <Polygon
              key={`${project.id}-${parcel.id}`}
              positions={positions}
              pathOptions={{
                color: color,
                weight: 2,
                opacity: 0.7,
                fillOpacity: 0.2,
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-semibold text-base mb-1">{project.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{project.client_name}</p>
                  <div className="flex items-center gap-3 text-sm mb-3">
                    <span>{project.acres} acres</span>
                    <span>•</span>
                    <span>{project.plots} plots</span>
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => navigate(`/workspace/${project.id}`)}
                  >
                    Open Workspace
                  </Button>
                </div>
              </Popup>
            </Polygon>
          );
        })
      )}
      
      {/* Project Markers (centroids) */}
      {projects.map((project) => (
        <Marker
          key={project.id}
          position={[project.lat, project.lng]}
          icon={createProjectIcon(project.status)}
        >
          <Popup>
            <div className="min-w-[200px]">
              <h3 className="font-semibold text-base mb-1">{project.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">{project.client_name}</p>
              <div className="flex items-center gap-3 text-sm mb-3">
                <span>{project.acres} acres</span>
                <span>•</span>
                <span>{project.plots} plots</span>
              </div>
              <Button 
                size="sm" 
                className="w-full"
                onClick={() => navigate(`/workspace/${project.id}`)}
              >
                Open Workspace
              </Button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
