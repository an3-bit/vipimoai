import { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinate, Beacon, Plot } from '@/types/survey';
import { formatCoordinate } from '@/lib/geometry';

// Fix for default marker icons in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── Tile configs (all free, no API key required) ────────────────────────────
const TILE_LAYERS = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 22,
    maxNativeZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, GeoEye, Earthstar Geographics',
    maxZoom: 22,
    maxNativeZoom: 17,
  },
};

// ─── Icon factories ───────────────────────────────────────────────────────────
const createBeaconIcon = (label: string) =>
  new L.DivIcon({
    className: '',
    html: `
      <div style="
        width:22px;height:22px;
        background:rgba(239,68,68,0.92);
        border:2px solid #0a0f1a;
        border-radius:50%;
        box-shadow:0 0 10px rgba(239,68,68,0.65),0 0 3px #000;
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="color:#fff;font-size:8px;font-weight:700;font-family:monospace;">${label}</span>
      </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -13],
  });

const createPlotBeaconIcon = () =>
  new L.DivIcon({
    className: '',
    html: `<div style="
      width:12px;height:12px;
      background:#00d4aa;
      border:1.5px solid #0a0f1a;
      border-radius:50%;
      box-shadow:0 0 6px rgba(0,212,170,0.55);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDMS(val: number, isLat: boolean): string {
  const abs = Math.abs(val);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(2);
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
  return `${deg}°${min}'${sec}"${dir}`;
}

// ─── Internal sub-components ──────────────────────────────────────────────────
function MapController({ coordinates }: { coordinates?: Coordinate[] }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates.map((c) => [c.lat, c.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coordinates, map]);
  return null;
}

function CoordinateTracker({
  onMove,
}: {
  onMove: (coord: Coordinate | null) => void;
}) {
  useMapEvents({
    mousemove: (e) => onMove({ lat: e.latlng.lat, lng: e.latlng.lng }),
    mouseout: () => onMove(null),
  });
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface SurveyMapProps {
  parcelCoordinates?: Coordinate[];
  plots?: Plot[];
  beacons?: Beacon[];
  onCoordinateHover?: (coord: Coordinate | null) => void;
  className?: string;
  showSatellite?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SurveyMap({
  parcelCoordinates = [],
  plots = [],
  beacons = [],
  onCoordinateHover,
  className = '',
  showSatellite = false,
}: SurveyMapProps) {
  const [hoveredCoord, setHoveredCoord] = useState<Coordinate | null>(null);
  const [showDMS, setShowDMS] = useState(false);

  const plotBeaconIcon = useMemo(() => createPlotBeaconIcon(), []);

  const handleHover = useCallback(
    (coord: Coordinate | null) => {
      setHoveredCoord(coord);
      onCoordinateHover?.(coord);
    },
    [onCoordinateHover]
  );

  const defaultCenter: [number, number] =
    parcelCoordinates.length > 0
      ? [parcelCoordinates[0].lat, parcelCoordinates[0].lng]
      : [-1.2921, 36.8219]; // Nairobi default

  const parcelPositions = useMemo(
    () => parcelCoordinates.map((c) => [c.lat, c.lng] as [number, number]),
    [parcelCoordinates]
  );

  const plotColors = [
    '#00D4AA', '#00B4D8', '#7C3AED', '#F59E0B', '#EF4444',
    '#10B981', '#6366F1', '#EC4899', '#14B8A6', '#F97316',
  ];

  const tile = showSatellite ? TILE_LAYERS.satellite : TILE_LAYERS.standard;

  return (
    <div className={`relative rounded-lg overflow-hidden border border-border ${className}`}>
      <MapContainer
        center={defaultCenter}
        zoom={15}
        maxZoom={22}
        className="h-full w-full min-h-[400px]"
        style={{ background: '#0a0f1a' }}
      >
        {/* Tile Layer */}
        <TileLayer
          url={tile.url}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom}
          maxNativeZoom={tile.maxNativeZoom}
        />

        {/* Fit to parcel on load */}
        <MapController coordinates={parcelCoordinates} />

        {/* Track cursor */}
        <CoordinateTracker onMove={handleHover} />

        {/* Parent Parcel Polygon */}
        {parcelPositions.length > 2 && (
          <Polygon
            positions={parcelPositions}
            pathOptions={{
              color: '#00d4aa',
              weight: 3,
              fillColor: '#00d4aa',
              fillOpacity: 0.15,
              dashArray: '5, 5',
            }}
          />
        )}

        {/* Subdivision Plots */}
        {plots.map((plot, index) => {
          const plotPositions = plot.coordinates.map((c) => [c.lat, c.lng] as [number, number]);
          const color = plotColors[index % plotColors.length];
          return (
            <Polygon
              key={plot.id}
              positions={plotPositions}
              pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.3 }}
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

        {/* Parcel Beacons (numbered) */}
        {beacons.map((beacon) => (
          <Marker
            key={beacon.id}
            position={[beacon.latitude, beacon.longitude]}
            icon={createBeaconIcon(String(beacon.beacon_number))}
          >
            <Popup>
              <div className="text-sm font-mono min-w-[180px]">
                <p className="font-bold text-red-600 mb-1">📍 Beacon {beacon.beacon_number}</p>
                <p>
                  <span className="text-muted-foreground">Lat: </span>
                  {formatCoordinate(beacon.latitude)}
                </p>
                <p>
                  <span className="text-muted-foreground">Lng: </span>
                  {formatCoordinate(beacon.longitude)}
                </p>
                {beacon.northing && (
                  <p>
                    <span className="text-muted-foreground">N: </span>
                    {beacon.northing.toFixed(3)}
                  </p>
                )}
                {beacon.easting && (
                  <p>
                    <span className="text-muted-foreground">E: </span>
                    {beacon.easting.toFixed(3)}
                  </p>
                )}
                {beacon.description && (
                  <p className="mt-1 text-gray-500 text-xs">{beacon.description}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Plot corner dots */}
        {plots.flatMap((plot) =>
          plot.coordinates.map((coord, coordIndex) => (
            <Marker
              key={`${plot.id}-${coordIndex}`}
              position={[coord.lat, coord.lng]}
              icon={plotBeaconIcon}
            >
              <Popup>
                <div className="text-sm font-mono">
                  <p className="font-semibold">
                    Plot {plot.plot_number} – Corner {coordIndex + 1}
                  </p>
                  <p>Lat: {formatCoordinate(coord.lat)}</p>
                  <p>Lng: {formatCoordinate(coord.lng)}</p>
                </div>
              </Popup>
            </Marker>
          ))
        )}
      </MapContainer>

      {/* ── Live Coordinate HUD ────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: 10,
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        {hoveredCoord ? (
          <button
            onClick={() => setShowDMS((v) => !v)}
            title="Click to toggle DMS / Decimal"
            style={{
              background: 'rgba(10,15,26,0.88)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(0,212,170,0.45)',
              borderRadius: 8,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              color: '#e2e8f0',
              fontFamily: 'monospace',
              fontSize: 12,
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="5.5" stroke="#00d4aa" strokeWidth="1.4" />
              <line x1="7" y1="0" x2="7" y2="4" stroke="#00d4aa" strokeWidth="1.4" />
              <line x1="7" y1="10" x2="7" y2="14" stroke="#00d4aa" strokeWidth="1.4" />
              <line x1="0" y1="7" x2="4" y2="7" stroke="#00d4aa" strokeWidth="1.4" />
              <line x1="10" y1="7" x2="14" y2="7" stroke="#00d4aa" strokeWidth="1.4" />
              <circle cx="7" cy="7" r="1.2" fill="#00d4aa" />
            </svg>

            {showDMS ? (
              <span>
                {fmtDMS(hoveredCoord.lat, true)}&nbsp;&nbsp;
                {fmtDMS(hoveredCoord.lng, false)}
              </span>
            ) : (
              <span>
                <span style={{ color: '#00d4aa' }}>LAT</span>{' '}
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
                  {hoveredCoord.lat.toFixed(6)}
                </span>
                <span style={{ color: '#475569', margin: '0 6px' }}>|</span>
                <span style={{ color: '#00d4aa' }}>LNG</span>{' '}
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
                  {hoveredCoord.lng.toFixed(6)}
                </span>
              </span>
            )}

            <span
              style={{
                fontSize: 9,
                color: '#64748b',
                borderLeft: '1px solid #334155',
                paddingLeft: 6,
              }}
            >
              {showDMS ? 'DEC' : 'DMS'}
            </span>
          </button>
        ) : (
          <div
            style={{
              background: 'rgba(10,15,26,0.72)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '5px 10px',
              color: '#475569',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            Hover map for coordinates
          </div>
        )}
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          background: 'rgba(10,15,26,0.88)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          padding: '8px 12px',
          color: '#e2e8f0',
          fontSize: 11,
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', border: '2px solid #0a0f1a', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />
            <span>Parcel Beacon</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00d4aa', border: '1.5px solid #0a0f1a' }} />
            <span>Plot Corner</span>
          </div>
        </div>
      </div>
    </div>
  );
}
