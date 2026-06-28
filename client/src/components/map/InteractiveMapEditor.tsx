import { useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinate, Plot } from '@/types/survey';
import { calculatePolygonArea, formatCoordinate } from '@/lib/geometry';
import { toast } from 'sonner';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface InteractiveMapEditorProps {
  parcelCoordinates: Coordinate[];
  plots: Plot[];
  onPlotsUpdate: (plots: Plot[]) => void;
  className?: string;
  showSatellite?: boolean;
}

// Draggable corner marker icon
const createCornerIcon = (isActive: boolean) => new L.DivIcon({
  className: 'corner-marker',
  html: `<div style="
    width: ${isActive ? '18px' : '14px'}; 
    height: ${isActive ? '18px' : '14px'}; 
    background: ${isActive ? '#f59e0b' : '#00d4aa'}; 
    border: 2px solid #0a0f1a; 
    border-radius: 50%; 
    box-shadow: 0 0 ${isActive ? '12px' : '8px'} ${isActive ? 'rgba(245,158,11,0.7)' : 'rgba(0,212,170,0.5)'};
    cursor: grab;
    transition: all 0.15s ease;
  "></div>`,
  iconSize: [isActive ? 18 : 14, isActive ? 18 : 14],
  iconAnchor: [isActive ? 9 : 7, isActive ? 9 : 7],
});

function MapController({ coordinates }: { coordinates?: Coordinate[] }) {
  const map = useMap();

  useMemo(() => {
    if (coordinates && coordinates.length > 0) {
      const bounds = L.latLngBounds(
        coordinates.map(c => [c.lat, c.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coordinates, map]);

  return null;
}

interface DraggableCornerProps {
  position: Coordinate;
  plotIndex: number;
  cornerIndex: number;
  isActive: boolean;
  onDragStart: () => void;
  onDragEnd: (plotIndex: number, cornerIndex: number, newPos: Coordinate) => void;
  plotNumber: number;
}

function DraggableCorner({
  position,
  plotIndex,
  cornerIndex,
  isActive,
  onDragStart,
  onDragEnd,
  plotNumber,
}: DraggableCornerProps) {
  const icon = useMemo(() => createCornerIcon(isActive), [isActive]);

  const eventHandlers = useMemo(() => ({
    dragstart: () => {
      onDragStart();
    },
    dragend: (e: L.DragEndEvent) => {
      const marker = e.target;
      const pos = marker.getLatLng();
      onDragEnd(plotIndex, cornerIndex, { lat: pos.lat, lng: pos.lng });
    },
  }), [plotIndex, cornerIndex, onDragStart, onDragEnd]);

  return (
    <Marker
      position={[position.lat, position.lng]}
      icon={icon}
      draggable
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div className="text-xs font-mono">
          <p className="font-semibold">Plot {plotNumber} - Corner {cornerIndex + 1}</p>
          <p>Lat: {formatCoordinate(position.lat)}</p>
          <p>Lng: {formatCoordinate(position.lng)}</p>
          <p className="text-muted-foreground mt-1 italic">Drag to adjust</p>
        </div>
      </Popup>
    </Marker>
  );
}

export function InteractiveMapEditor({
  parcelCoordinates,
  plots,
  onPlotsUpdate,
  className = '',
  showSatellite = false,
}: InteractiveMapEditorProps) {
  const [activeCorner, setActiveCorner] = useState<{ plotIndex: number; cornerIndex: number } | null>(null);

  const defaultCenter: [number, number] = parcelCoordinates.length > 0
    ? [parcelCoordinates[0].lat, parcelCoordinates[0].lng]
    : [0, 0];

  const parcelPositions = useMemo(() =>
    parcelCoordinates.map(c => [c.lat, c.lng] as [number, number]),
    [parcelCoordinates]
  );

  const plotColors = [
    '#00D4AA', '#00B4D8', '#7C3AED', '#F59E0B', '#EF4444',
    '#10B981', '#6366F1', '#EC4899', '#14B8A6', '#F97316',
  ];

  const handleDragStart = useCallback(() => {
    // Visual feedback handled by activeCorner state
  }, []);

  const handleDragEnd = useCallback((plotIndex: number, cornerIndex: number, newPos: Coordinate) => {
    const updatedPlots = plots.map((plot, pIdx) => {
      if (pIdx !== plotIndex) return plot;

      const newCoordinates = plot.coordinates.map((coord, cIdx) =>
        cIdx === cornerIndex ? newPos : coord
      );

      // Recalculate area
      const newArea = calculatePolygonArea(newCoordinates);

      return {
        ...plot,
        coordinates: newCoordinates,
        area_sqm: newArea,
      };
    });

    onPlotsUpdate(updatedPlots);
    setActiveCorner(null);
    toast.success(`Plot ${plots[plotIndex].plot_number} boundary updated`);
  }, [plots, onPlotsUpdate]);

  const handleCornerMouseDown = useCallback((plotIndex: number, cornerIndex: number) => {
    setActiveCorner({ plotIndex, cornerIndex });
  }, []);

  return (
    <div className={`relative rounded-lg overflow-hidden border border-border ${className}`}>
      <MapContainer
        center={defaultCenter}
        zoom={15}
        maxZoom={22}
        className="h-full w-full min-h-[400px]"
        style={{ background: '#0a0f1a' }}
      >
        {showSatellite ? (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={22}
            maxNativeZoom={17}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={22}
            maxNativeZoom={19}
          />
        )}

        <MapController coordinates={parcelCoordinates} />

        {/* Parent Parcel Polygon */}
        {parcelPositions.length > 2 && (
          <Polygon
            positions={parcelPositions}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: '#ffffff',
              fillOpacity: 0.05,
              dashArray: '8, 4',
            }}
          />
        )}

        {/* Editable Plot Polygons */}
        {plots.map((plot, plotIndex) => {
          const plotPositions = plot.coordinates.map(c => [c.lat, c.lng] as [number, number]);
          const color = plotColors[plotIndex % plotColors.length];

          return (
            <Polygon
              key={plot.id}
              positions={plotPositions}
              pathOptions={{
                color: color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.25,
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

        {/* Draggable Corner Markers */}
        {plots.map((plot, plotIndex) =>
          plot.coordinates.map((coord, cornerIndex) => (
            <DraggableCorner
              key={`${plot.id}-corner-${cornerIndex}`}
              position={coord}
              plotIndex={plotIndex}
              cornerIndex={cornerIndex}
              plotNumber={plot.plot_number}
              isActive={
                activeCorner?.plotIndex === plotIndex &&
                activeCorner?.cornerIndex === cornerIndex
              }
              onDragStart={() => handleCornerMouseDown(plotIndex, cornerIndex)}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </MapContainer>

      {/* Instructions Overlay */}
      <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm border border-border rounded-md px-3 py-2 text-xs max-w-[200px]">
        <p className="font-medium text-survey-primary mb-1">Interactive Editor</p>
        <p className="text-muted-foreground">
          Drag the corner markers to adjust plot boundaries. Areas update automatically.
        </p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm border border-border rounded-md px-3 py-2 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-survey-primary"></div>
          <span>Draggable Corner</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-warning"></div>
          <span>Active Corner</span>
        </div>
      </div>
    </div>
  );
}
