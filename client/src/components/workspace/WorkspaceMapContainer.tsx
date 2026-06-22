import { MapContainer, TileLayer, Polygon, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoomToFitControl, ZoomToFitRef } from '@/components/map/ZoomToFitControl';
import { RiverDrawingTool } from '@/components/map/RiverDrawingTool';
import { AccessRoadSelector, AccessEdge } from '@/components/map/AccessRoadSelector';
import { FrontageEdgeSelector } from '@/components/workspace/FrontageEdgeSelector';
import { Coordinate } from '@/types/survey';
import { PlotStatus } from '@/components/workspace/PlotStatusCard';

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
  const getTileUrl = () => {
    switch (mapLayer) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'topo':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  return (
    <MapContainer
      center={[-1.115, 37.117]}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        key={mapLayer}
        attribution='&copy; OpenStreetMap contributors'
        url={getTileUrl()}
      />

      {parcelCoordinates.length > 0 && (
        <ZoomToFitControl ref={zoomToFitRef} coordinates={parcelCoordinates} />
      )}

      {/* River Drawing Tool */}
      <RiverDrawingTool
        isDrawing={isDrawingRiver}
        riverPoints={riparian.riverPoints}
        onPointAdd={onRiverPointAdd}
        onDrawingComplete={onDrawingComplete}
      />

      {/* Parent Parcel Boundary */}
      {parcelCoordinates.length > 0 && (
        <Polygon
          positions={parcelCoordinates.map((c) => [c.lat, c.lng] as [number, number])}
          pathOptions={{
            color: 'hsl(160, 84%, 39%)',
            weight: 4,
            fillColor: 'hsl(160, 84%, 39%)',
            fillOpacity: 0.15,
            dashArray: '10, 5',
          }}
        >
          <Popup>
            <div className="text-center">
              <p className="font-semibold text-emerald-600">Parcel Boundary</p>
              <p className="text-xs text-muted-foreground mt-1">
                {parcelCoordinates.length} coordinates
              </p>
              <p className="text-xs text-muted-foreground">
                Click on the map to view details
              </p>
            </div>
          </Popup>
        </Polygon>
      )}

      {/* Access Road Selector */}
      {parcelCoordinates.length > 0 && (
        <AccessRoadSelector
          parcelCoordinates={parcelCoordinates}
          accessEdges={accessEdges}
          onAccessEdgeToggle={onAccessEdgeToggle}
          enabled={accessRoadMode}
        />
      )}

      {/* Frontage Edge Selector */}
      {parcelCoordinates.length > 0 && (
        <FrontageEdgeSelector
          parcelCoordinates={parcelCoordinates}
          onFrontageSelected={onFrontageEdgeSelected}
          isEnabled={frontageEdgeSelectorEnabled}
          onEnabledChange={(enabled) => {
            // This is handled from the parent component
          }}
        />
      )}

      {/* Riparian Buffer Zone */}
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
              <p className="text-sm text-muted-foreground">30m buffer zone - No development</p>
            </div>
          </Popup>
        </Polygon>
      )}

      {/* River Line */}
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

      {/* Plot Grid */}
      {showPlotGrid &&
        savedPlots &&
        savedPlots.map((plot: any) => {
          const plotStatus = plot.status === 'available' || plot.status === 'reserved' || plot.status === 'sold'
            ? plot.status
            : 'available';

          const getPlotColor = (status: string) => {
            switch (status) {
              case 'sold':
                return 'hsl(0, 72%, 51%)';
              case 'reserved':
                return 'hsl(38, 92%, 50%)';
              case 'available':
              default:
                return 'hsl(152, 69%, 40%)';
            }
          };

          const color = getPlotColor(plotStatus);
          const coords = plot.coordinates as { lat: number; lng: number }[];

          return (
            <Polygon
              key={plot.id}
              positions={coords.map((c) => [c.lat, c.lng] as [number, number])}
              pathOptions={{
                color: color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.4,
              }}
              eventHandlers={{
                click: () => onPlotSelect(plot),
              }}
            >
              <Popup>
                <div className="text-center">
                  <p className="font-semibold">Plot {plot.plot_number}</p>
                  <p className="text-xs text-muted-foreground">{plot.area_sqm.toFixed(0)} m²</p>
                  <p
                    className={`text-xs font-medium mt-1 ${
                      plotStatus === 'sold'
                        ? 'text-rose-500'
                        : plotStatus === 'reserved'
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                    }`}
                  >
                    {plotStatus.charAt(0).toUpperCase() + plotStatus.slice(1)}
                  </p>
                </div>
              </Popup>
            </Polygon>
          );
        })}

      {/* Generated Plots (from subdivision) */}
      {showPlotGrid &&
        plotGrid
          .filter((p) => p.isValid && p.coordinates && p.coordinates.length > 0)
          .map((plot, index) => {
            const getGeneratedPlotColor = (facingRoad: any) => {
              if (facingRoad === 'frontage') return 'hsl(120, 73%, 75%)'; // Light green - frontage
              if (facingRoad === 'spine') return 'hsl(217, 91%, 60%)'; // Blue - spine road
              return 'hsl(210, 85%, 70%)'; // Light blue - internal
            };

            const color = getGeneratedPlotColor(plot.facingRoad);
            const coords = plot.coordinates as any[];

            return (
              <Polygon
                key={`generated-${index}`}
                positions={coords.map((c: any) => [c.lat, c.lng] as [number, number])}
                pathOptions={{
                  color: color,
                  weight: 2,
                  fillColor: color,
                  fillOpacity: 0.5,
                }}
                eventHandlers={{
                  click: () => onPlotSelect(plot),
                }}
              >
                <Popup>
                  <div className="w-80 max-h-96 overflow-y-auto">
                    {/* Header */}
                    <div className="mb-3 pb-3 border-b border-border">
                      <p className="font-bold text-base">Plot {plot.plotNumber}</p>
                      <p className={`text-xs font-medium mt-1 px-2 py-1 rounded-full inline-block ${
                        plot.facingRoad === 'frontage' 
                          ? 'bg-green-100 text-green-700' 
                          : plot.facingRoad === 'spine'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {plot.facingRoad === 'frontage' ? '🟢 Frontage Access' : plot.facingRoad === 'spine' ? '🔵 Spine Road' : '⚪ Internal Road'}
                      </p>
                    </div>

                    {/* Area Information */}
                    <div className="mb-3 pb-3 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Plot Area</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-sm font-bold text-foreground">{plot.area?.toFixed(0) || 'N/A'} m²</p>
                          <p className="text-xs text-muted-foreground">{(plot.area ? plot.area / 10000 : 0).toFixed(4)} Ha</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <p className="text-xs font-medium text-foreground">
                            {plot.isPartial ? '📐 Partial' : '✓ Complete'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dimensions */}
                    <div className="mb-3 pb-3 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Dimensions</p>
                      <div className="bg-secondary/20 p-2 rounded">
                        <p className="text-sm font-mono text-foreground">
                          <span className="font-semibold">{plot.width?.toFixed(1)}m</span> (width) × <span className="font-semibold">{plot.depth?.toFixed(1)}m</span> (depth)
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Frontage: {plot.width?.toFixed(1)}m | Depth: {plot.depth?.toFixed(1)}m
                        </p>
                      </div>
                    </div>

                    {/* Road Access Details */}
                    <div className="mb-3 pb-3 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">🛣️ Road Access Details</p>
                      <div className="space-y-2">
                        {plot.facingRoad === 'frontage' && (
                          <div className="bg-green-50 border border-green-200 p-2 rounded">
                            <p className="text-xs font-semibold text-green-700 flex items-center gap-1 mb-1">
                              <span>✓</span> Direct Frontage Access
                            </p>
                            <p className="text-xs text-green-600">
                              This plot has direct access to the parcel boundary road. No need for additional internal roads.
                            </p>
                          </div>
                        )}
                        {plot.facingRoad === 'spine' && (
                          <div className="bg-blue-50 border border-blue-200 p-2 rounded">
                            <p className="text-xs font-semibold text-blue-700 flex items-center gap-1 mb-1">
                              <span>✓</span> Spine Road Access
                            </p>
                            <p className="text-xs text-blue-600">
                              This plot has access to the main spine road running through the subdivision.
                            </p>
                          </div>
                        )}
                        {plot.facingRoad === 'internal' && (
                          <div className="bg-amber-50 border border-amber-200 p-2 rounded">
                            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1 mb-1">
                              <span>✓</span> Internal Road Access
                            </p>
                            <p className="text-xs text-amber-600">
                              This plot has access via internal rib roads perpendicular to the spine road.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Coordinates */}
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">📍 Coordinates ({coords.length})</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {coords.slice(0, 6).map((coord: any, i: number) => (
                          <p key={i} className="text-xs text-foreground font-mono bg-secondary/30 p-1 rounded">
                            <span className="text-muted-foreground">{i + 1}.</span> {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
                          </p>
                        ))}
                        {coords.length > 6 && (
                          <p className="text-xs text-muted-foreground italic pl-1">
                            +{coords.length - 6} more vertices...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Polygon>
            );
          })}

      {/* Invalid Plots */}
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
                  <p className="text-xs text-destructive">Riparian overlap: {plot.overlapPercent.toFixed(1)}%</p>
                </div>
              </Popup>
            </Polygon>
          ))}
    </MapContainer>
  );
}
