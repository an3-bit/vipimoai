import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Polyline, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoomToFitControl, ZoomToFitRef } from '@/components/map/ZoomToFitControl';
import { RiverDrawingTool } from '@/components/map/RiverDrawingTool';
import { AccessRoadSelector, AccessEdge } from '@/components/map/AccessRoadSelector';
import { FrontageEdgeSelector } from '@/components/workspace/FrontageEdgeSelector';
import { Coordinate } from '@/types/survey';
import { PlotStatus } from '@/components/workspace/PlotStatusCard';

// Fix Leaflet default icon paths for Vite/webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── Tile layer config ────────────────────────────────────────────────────────
const TILE_LAYERS = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN',
    maxZoom: 19,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors',
    maxZoom: 17,
  },
};

// ─── Beacon vertex icon ───────────────────────────────────────────────────────
const createVertexIcon = (label: string) =>
  new L.DivIcon({
    className: '',
    html: `
      <div style="
        position:relative;
        width:24px;
        height:24px;
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <div style="
          width:20px;
          height:20px;
          background:rgba(0,212,170,0.92);
          border:2px solid #0a0f1a;
          border-radius:50%;
          box-shadow:0 0 10px rgba(0,212,170,0.7),0 0 3px #000;
          display:flex;
          align-items:center;
          justify-content:center;
        ">
          <span style="
            color:#0a0f1a;
            font-size:8px;
            font-weight:700;
            font-family:monospace;
            line-height:1;
          ">${label}</span>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });

// ─── Coordinate tracker (live mouse position) ─────────────────────────────────
function CoordinateTracker({
  onMove,
}: {
  onMove: (lat: number | null, lng: number | null) => void;
}) {
  useMapEvents({
    mousemove(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
    mouseout() {
      onMove(null, null);
    },
  });
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDeg(val: number, isLat: boolean): string {
  const abs = Math.abs(val);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(2);
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
  return `${deg}°${min}'${sec}"${dir}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface WorkspaceMapContainerProps {
  mapLayer: 'standard' | 'satellite' | 'topo';
  parcelCoordinates: Coordinate[];
  showHazardZone: boolean;
  riparian: any;
  showPlotGrid: boolean;
  savedPlots: any[];
  plotGrid: any[];
  accessEdges: any[];
  accessRoadMode: boolean;
  isDrawingRiver: boolean;
  frontageEdgeSelectorEnabled: boolean;
  onFrontageEdgeSelected: (startIndex: number, endIndex: number) => void;
  zoomToFitRef: React.RefObject<ZoomToFitRef>;
  onRiverPointAdd: (point: { lat: number; lng: number }) => void;
  onDrawingComplete: () => void;
  onAccessEdgeToggle: (edgeIndex: number, roadWidth?: number, bearing?: number, length?: number) => void;
  onPlotSelect: (plot: any) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function WorkspaceMapContainer({
  mapLayer,
  parcelCoordinates,
  showHazardZone,
  riparian,
  showPlotGrid,
  savedPlots,
  plotGrid,
  accessEdges,
  accessRoadMode,
  isDrawingRiver,
  frontageEdgeSelectorEnabled,
  onFrontageEdgeSelected,
  zoomToFitRef,
  onRiverPointAdd,
  onDrawingComplete,
  onAccessEdgeToggle,
  onPlotSelect,
}: WorkspaceMapContainerProps) {
  const [cursorLat, setCursorLat] = useState<number | null>(null);
  const [cursorLng, setCursorLng] = useState<number | null>(null);
  const [showDMS, setShowDMS] = useState(false);

  const handleCursorMove = useCallback((lat: number | null, lng: number | null) => {
    setCursorLat(lat);
    setCursorLng(lng);
  }, []);

  const tile = TILE_LAYERS[mapLayer] ?? TILE_LAYERS.standard;

  // Default map center: first parcel coordinate if available, else Nairobi
  const defaultCenter: [number, number] =
    parcelCoordinates.length > 0
      ? [parcelCoordinates[0].lat, parcelCoordinates[0].lng]
      : [-1.2921, 36.8219];

  const getPlotColor = (status: string) => {
    switch (status) {
      case 'sold':     return 'hsl(0, 72%, 51%)';
      case 'reserved': return 'hsl(38, 92%, 50%)';
      default:         return 'hsl(152, 69%, 40%)';
    }
  };

  const getGeneratedPlotColor = (facingRoad: string) => {
    if (facingRoad === 'frontage') return 'hsl(120, 73%, 75%)';
    if (facingRoad === 'spine')    return 'hsl(217, 91%, 60%)';
    return 'hsl(210, 85%, 70%)';
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={defaultCenter}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* ── Tile Layer ─────────────────────────────────────────────────── */}
        <TileLayer
          key={mapLayer}
          url={tile.url}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom}
        />

        {/* ── Cursor tracker ─────────────────────────────────────────────── */}
        <CoordinateTracker onMove={handleCursorMove} />

        {/* ── Auto-fit to parcel on load ──────────────────────────────────── */}
        {parcelCoordinates.length > 0 && (
          <ZoomToFitControl ref={zoomToFitRef} coordinates={parcelCoordinates} />
        )}

        {/* ── River Drawing Tool ─────────────────────────────────────────── */}
        <RiverDrawingTool
          isDrawing={isDrawingRiver}
          riverPoints={riparian.riverPoints}
          onPointAdd={onRiverPointAdd}
          onDrawingComplete={onDrawingComplete}
        />

        {/* ── Parent Parcel Boundary ─────────────────────────────────────── */}
        {parcelCoordinates.length > 0 && (
          <Polygon
            positions={parcelCoordinates.map((c) => [c.lat, c.lng] as [number, number])}
            pathOptions={{
              color: 'hsl(160, 84%, 39%)',
              weight: 4,
              fillColor: 'hsl(160, 84%, 39%)',
              fillOpacity: 0.12,
              dashArray: '10, 5',
            }}
          >
            <Popup>
              <div className="text-center min-w-[160px]">
                <p className="font-semibold text-emerald-600 mb-1">Parcel Boundary</p>
                <p className="text-xs text-muted-foreground">{parcelCoordinates.length} vertices</p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* ── Parcel Corner Beacon Markers ───────────────────────────────── */}
        {parcelCoordinates.map((coord, idx) => (
          <Marker
            key={`beacon-${idx}`}
            position={[coord.lat, coord.lng]}
            icon={createVertexIcon(String(idx + 1))}
          >
            <Popup>
              <div className="font-mono text-xs min-w-[200px]">
                <p className="font-bold text-emerald-700 mb-1">📍 Beacon {idx + 1}</p>
                <div className="space-y-0.5">
                  <p>
                    <span className="text-muted-foreground">Lat: </span>
                    <span className="font-semibold">{coord.lat.toFixed(7)}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Lng: </span>
                    <span className="font-semibold">{coord.lng.toFixed(7)}</span>
                  </p>
                  <p className="text-muted-foreground text-[10px] pt-1">
                    {fmtDeg(coord.lat, true)}, {fmtDeg(coord.lng, false)}
                  </p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ── Access Road Selector ───────────────────────────────────────── */}
        {parcelCoordinates.length > 0 && (
          <AccessRoadSelector
            parcelCoordinates={parcelCoordinates}
            accessEdges={accessEdges}
            onAccessEdgeToggle={onAccessEdgeToggle}
            enabled={accessRoadMode}
          />
        )}

        {/* ── Frontage Edge Selector ─────────────────────────────────────── */}
        {parcelCoordinates.length > 0 && (
          <FrontageEdgeSelector
            parcelCoordinates={parcelCoordinates}
            onFrontageSelected={onFrontageEdgeSelected}
            isEnabled={frontageEdgeSelectorEnabled}
            onEnabledChange={() => {}}
          />
        )}

        {/* ── Riparian Buffer Zone ───────────────────────────────────────── */}
        {showHazardZone && riparian.bufferPolygon.length > 0 && (
          <Polygon
            positions={riparian.bufferPolygon.map((c: any) => [c.lat, c.lng] as [number, number])}
            pathOptions={{
              color: 'hsl(0, 72%, 51%)',
              weight: 2,
              fillColor: 'hsl(0, 72%, 51%)',
              fillOpacity: 0.35,
              dashArray: '8, 4',
            }}
          >
            <Popup>
              <div className="text-center">
                <p className="font-semibold text-destructive">Riparian Reserve</p>
                <p className="text-sm text-muted-foreground">30m buffer zone — No development</p>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* ── River Line ─────────────────────────────────────────────────── */}
        {!isDrawingRiver && riparian.riverPoints.length >= 2 && (
          <Polyline
            positions={riparian.riverPoints.map((p: any) => [p.lat, p.lng] as [number, number])}
            pathOptions={{
              color: 'hsl(210, 100%, 50%)',
              weight: 4,
              opacity: 0.9,
            }}
          />
        )}

        {/* ── Saved Plots ────────────────────────────────────────────────── */}
        {showPlotGrid &&
          savedPlots.map((plot: any) => {
            const status =
              plot.status === 'available' || plot.status === 'reserved' || plot.status === 'sold'
                ? plot.status
                : 'available';
            const color = getPlotColor(status);
            const coords = plot.coordinates as { lat: number; lng: number }[];

            return (
              <Polygon
                key={plot.id}
                positions={coords.map((c) => [c.lat, c.lng] as [number, number])}
                pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.4 }}
                eventHandlers={{ click: () => onPlotSelect(plot) }}
              >
                <Popup>
                  <div className="text-center">
                    <p className="font-semibold">Plot {plot.plot_number}</p>
                    <p className="text-xs text-muted-foreground">{plot.area_sqm.toFixed(0)} m²</p>
                    <p
                      className={`text-xs font-medium mt-1 ${
                        status === 'sold'
                          ? 'text-rose-500'
                          : status === 'reserved'
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </p>
                  </div>
                </Popup>
              </Polygon>
            );
          })}

        {/* ── Generated Plots (valid) ────────────────────────────────────── */}
        {showPlotGrid &&
          plotGrid
            .filter((p) => p.isValid && p.coordinates?.length > 0)
            .map((plot, index) => {
              const color = getGeneratedPlotColor(plot.facingRoad);
              const coords = plot.coordinates as any[];

              return (
                <Polygon
                  key={`generated-${index}`}
                  positions={coords.map((c: any) => [c.lat, c.lng] as [number, number])}
                  pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.5 }}
                  eventHandlers={{ click: () => onPlotSelect(plot) }}
                >
                  <Popup>
                    <div className="w-80 max-h-96 overflow-y-auto">
                      {/* Header */}
                      <div className="mb-3 pb-3 border-b border-border">
                        <p className="font-bold text-base">Plot {plot.plotNumber}</p>
                        <p
                          className={`text-xs font-medium mt-1 px-2 py-1 rounded-full inline-block ${
                            plot.facingRoad === 'frontage'
                              ? 'bg-green-100 text-green-700'
                              : plot.facingRoad === 'spine'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {plot.facingRoad === 'frontage'
                            ? '🟢 Frontage Access'
                            : plot.facingRoad === 'spine'
                            ? '🔵 Spine Road'
                            : '⚪ Internal Road'}
                        </p>
                      </div>

                      {/* Area */}
                      <div className="mb-3 pb-3 border-b border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Plot Area</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-sm font-bold">{plot.area?.toFixed(0) ?? 'N/A'} m²</p>
                            <p className="text-xs text-muted-foreground">
                              {(plot.area ? plot.area / 10000 : 0).toFixed(4)} Ha
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <p className="text-xs font-medium">
                              {plot.isPartial ? '📐 Partial' : '✓ Complete'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Dimensions */}
                      <div className="mb-3 pb-3 border-b border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Dimensions</p>
                        <p className="text-sm font-mono">
                          <span className="font-semibold">{plot.width?.toFixed(1)}m</span> ×{' '}
                          <span className="font-semibold">{plot.depth?.toFixed(1)}m</span>
                        </p>
                      </div>

                      {/* Coordinates */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          📍 Corners ({coords.length})
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {coords.slice(0, 6).map((coord: any, i: number) => (
                            <p key={i} className="text-xs font-mono bg-secondary/30 p-1 rounded">
                              <span className="text-muted-foreground">{i + 1}.</span>{' '}
                              {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
                            </p>
                          ))}
                          {coords.length > 6 && (
                            <p className="text-xs text-muted-foreground italic pl-1">
                              +{coords.length - 6} more…
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}

        {/* ── Invalid Plots ──────────────────────────────────────────────── */}
        {showPlotGrid &&
          plotGrid
            .filter((p) => !p.isValid)
            .map((plot, index) => (
              <Polygon
                key={`invalid-${index}`}
                positions={plot.coordinates.map((c: any) => [c.lat, c.lng] as [number, number])}
                pathOptions={{
                  color: 'hsl(0, 72%, 51%)',
                  weight: 1.5,
                  fillColor: 'hsl(0, 72%, 51%)',
                  fillOpacity: 0.5,
                  dashArray: '4, 4',
                }}
              >
                <Popup>
                  <div className="text-center">
                    <p className="font-semibold text-destructive">INVALID</p>
                    <p className="text-xs text-destructive">
                      Riparian overlap: {plot.overlapPercent.toFixed(1)}%
                    </p>
                  </div>
                </Popup>
              </Polygon>
            ))}
      </MapContainer>

      {/* ── Live Coordinate HUD ──────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: 12,
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        {cursorLat !== null && cursorLng !== null ? (
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
            {/* Crosshair icon */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="5.5" stroke="#00d4aa" strokeWidth="1.4" />
              <line x1="7" y1="0" x2="7" y2="4" stroke="#00d4aa" strokeWidth="1.4" />
              <line x1="7" y1="10" x2="7" y2="14" stroke="#00d4aa" strokeWidth="1.4" />
              <line x1="0" y1="7" x2="4" y2="7" stroke="#00d4aa" strokeWidth="1.4" />
              <line x1="10" y1="7" x2="14" y2="7" stroke="#00d4aa" strokeWidth="1.4" />
              <circle cx="7" cy="7" r="1.2" fill="#00d4aa" />
            </svg>

            {showDMS ? (
              <span>
                <span style={{ color: '#94a3b8' }}>  </span>
                {fmtDeg(cursorLat, true)}&nbsp;&nbsp;
                {fmtDeg(cursorLng, false)}
              </span>
            ) : (
              <span>
                <span style={{ color: '#00d4aa' }}>LAT</span>{' '}
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
                  {cursorLat.toFixed(6)}
                </span>
                <span style={{ color: '#475569', margin: '0 6px' }}>|</span>
                <span style={{ color: '#00d4aa' }}>LNG</span>{' '}
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
                  {cursorLng.toFixed(6)}
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
            Move cursor over map for coordinates
          </div>
        )}
      </div>

      {/* ── Map Legend ───────────────────────────────────────────────────────── */}
      {parcelCoordinates.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1000,
            background: 'rgba(10,15,26,0.88)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '10px 14px',
            color: '#e2e8f0',
            fontSize: 11,
            minWidth: 140,
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}
        >
          <p
            style={{
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '0.08em',
              color: '#00d4aa',
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            Map Legend
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#00d4aa', border: '2px solid #0a0f1a', boxShadow: '0 0 6px rgba(0,212,170,0.6)' }} />
              <span>Boundary Beacon</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 12, height: 3, background: 'hsl(160,84%,39%)', borderRadius: 2 }} />
              <span>Parcel Boundary</span>
            </div>
            {showHazardZone && riparian.bufferPolygon.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 12, height: 3, background: 'hsl(0,72%,51%)', borderRadius: 2, opacity: 0.8 }} />
                <span>Riparian Zone</span>
              </div>
            )}
            {showPlotGrid && plotGrid.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 12, height: 10, borderRadius: 2, background: 'hsl(120,73%,75%)', opacity: 0.8 }} />
                  <span>Frontage Plot</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 12, height: 10, borderRadius: 2, background: 'hsl(217,91%,60%)', opacity: 0.8 }} />
                  <span>Spine Plot</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 12, height: 10, borderRadius: 2, background: 'hsl(210,85%,70%)', opacity: 0.8 }} />
                  <span>Internal Plot</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
