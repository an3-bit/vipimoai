import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinate, Beacon, Plot } from '@/types/survey';
import { formatCoordinate } from '@/lib/geometry';

// Fix for default marker icons in Leaflet with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface SurveyMapProps {
  parcelCoordinates?: Coordinate[];
  plots?: Plot[];
  beacons?: Beacon[];
  onCoordinateHover?: (coord: Coordinate | null) => void;
  className?: string;
  showSatellite?: boolean;
}

// Custom beacon icon
const beaconIcon = new L.DivIcon({
  className: 'beacon-marker',
  html: `<div class="w-4 h-4 bg-survey-beacon border-2 border-background rounded-full shadow-lg animate-pulse-glow"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Plot beacon icon
const plotBeaconIcon = new L.DivIcon({
  className: 'plot-beacon-marker',
  html: `<div class="w-3 h-3 bg-survey-accent border border-background rounded-full shadow-md"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function MapController({ coordinates }: { coordinates?: Coordinate[] }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const bounds = L.latLngBounds(
        coordinates.map(c => [c.lat, c.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coordinates, map]);

  return null;
}

function CoordinateTracker({ onHover }: { onHover?: (coord: Coordinate | null) => void }) {
  useMapEvents({
    mousemove: (e) => {
      if (onHover) {
        onHover({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
    mouseout: () => {
      if (onHover) {
        onHover(null);
      }
    },
  });

  return null;
}

export function SurveyMap({
  parcelCoordinates = [],
  plots = [],
  beacons = [],
  onCoordinateHover,
  className = '',
  showSatellite = false,
}: SurveyMapProps) {
  const [hoveredCoord, setHoveredCoord] = useState<Coordinate | null>(null);

  const handleHover = (coord: Coordinate | null) => {
    setHoveredCoord(coord);
    onCoordinateHover?.(coord);
  };

  // Default center (can be overridden by parcel coordinates)
  const defaultCenter: [number, number] = parcelCoordinates.length > 0
    ? [parcelCoordinates[0].lat, parcelCoordinates[0].lng]
    : [0, 0];

  // Convert coordinates for Leaflet
  const parcelPositions = parcelCoordinates.map(c => [c.lat, c.lng] as [number, number]);

  // Plot colors for visualization
  const plotColors = [
    '#00D4AA', '#00B4D8', '#7C3AED', '#F59E0B', '#EF4444',
    '#10B981', '#6366F1', '#EC4899', '#14B8A6', '#F97316',
  ];

  return (
    <div className={`relative rounded-lg overflow-hidden border border-border ${className}`}>
      <MapContainer
        center={defaultCenter}
        zoom={15}
        className="h-full w-full min-h-[400px]"
        style={{ background: 'hsl(var(--survey-dark))' }}
      >
        {/* Tile Layer - OpenStreetMap or Satellite */}
        {showSatellite ? (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        {/* Fit map to parcel bounds */}
        <MapController coordinates={parcelCoordinates} />

        {/* Track mouse coordinates */}
        <CoordinateTracker onHover={handleHover} />

        {/* Parent Parcel Polygon */}
        {parcelPositions.length > 2 && (
          <Polygon
            positions={parcelPositions}
            pathOptions={{
              color: 'hsl(var(--survey-primary))',
              weight: 3,
              fillColor: 'hsl(var(--survey-primary))',
              fillOpacity: 0.15,
              dashArray: '5, 5',
            }}
          />
        )}

        {/* Subdivision Plots */}
        {plots.map((plot, index) => {
          const plotPositions = plot.coordinates.map(c => [c.lat, c.lng] as [number, number]);
          const color = plotColors[index % plotColors.length];

          return (
            <Polygon
              key={plot.id}
              positions={plotPositions}
              pathOptions={{
                color: color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.3,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">Plot {plot.plot_number}</p>
                  <p>Area: {plot.area_sqm.toFixed(2)} m²</p>
                  {plot.width_m && <p>Width: {plot.width_m.toFixed(2)} m</p>}
                  {plot.depth_m && <p>Depth: {plot.depth_m.toFixed(2)} m</p>}
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* Parcel Beacons */}
        {beacons.map((beacon) => (
          <Marker
            key={beacon.id}
            position={[beacon.latitude, beacon.longitude]}
            icon={beaconIcon}
          >
            <Popup>
              <div className="text-sm font-mono">
                <p className="font-semibold">Beacon {beacon.beacon_number}</p>
                <p>Lat: {formatCoordinate(beacon.latitude)}</p>
                <p>Lng: {formatCoordinate(beacon.longitude)}</p>
                {beacon.northing && <p>N: {beacon.northing.toFixed(3)}</p>}
                {beacon.easting && <p>E: {beacon.easting.toFixed(3)}</p>}
                {beacon.description && <p className="mt-1 text-muted-foreground">{beacon.description}</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Plot corner beacons */}
        {plots.flatMap((plot) =>
          plot.coordinates.map((coord, coordIndex) => (
            <Marker
              key={`${plot.id}-${coordIndex}`}
              position={[coord.lat, coord.lng]}
              icon={plotBeaconIcon}
            >
              <Popup>
                <div className="text-sm font-mono">
                  <p className="font-semibold">Plot {plot.plot_number} - Corner {coordIndex + 1}</p>
                  <p>Lat: {formatCoordinate(coord.lat)}</p>
                  <p>Lng: {formatCoordinate(coord.lng)}</p>
                </div>
              </Popup>
            </Marker>
          ))
        )}
      </MapContainer>

      {/* Coordinate Display Overlay */}
      {hoveredCoord && (
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm border border-border rounded-md px-3 py-2 font-mono text-sm">
          <span className="text-muted-foreground">Lat:</span>{' '}
          <span className="text-survey-primary">{formatCoordinate(hoveredCoord.lat)}</span>
          <span className="mx-2 text-border">|</span>
          <span className="text-muted-foreground">Lng:</span>{' '}
          <span className="text-survey-primary">{formatCoordinate(hoveredCoord.lng)}</span>
        </div>
      )}

      {/* Map Controls Legend */}
      <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm border border-border rounded-md px-3 py-2 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-survey-beacon animate-pulse"></div>
          <span>Parcel Beacon</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-survey-accent"></div>
          <span>Plot Corner</span>
        </div>
      </div>
    </div>
  );
}
