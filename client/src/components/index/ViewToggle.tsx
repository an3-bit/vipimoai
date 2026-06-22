import { Map, Layers, LandPlot } from 'lucide-react';

interface ViewToggleProps {
  viewMode: 'map' | 'cards';
  mapLayer: 'standard' | 'satellite';
  onViewModeChange: (mode: 'map' | 'cards') => void;
  onMapLayerChange: (layer: 'standard' | 'satellite') => void;
}

export function ViewToggle({
  viewMode,
  mapLayer,
  onViewModeChange,
  onMapLayerChange,
}: ViewToggleProps) {
  return (
    <div className="floating-control flex flex-col gap-1">
      <button
        onClick={() => onViewModeChange('cards')}
        className={`p-2 rounded transition-colors ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
        title="Cards View"
      >
        <LandPlot className="h-4 w-4" />
      </button>
      <button
        onClick={() => onViewModeChange('map')}
        className={`p-2 rounded transition-colors ${viewMode === 'map' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
        title="Map View"
      >
        <Map className="h-4 w-4" />
      </button>
      {viewMode === 'map' && (
        <>
          <div className="w-full h-px bg-border my-1" />
          <button
            onClick={() => onMapLayerChange('standard')}
            className={`p-2 rounded transition-colors ${mapLayer === 'standard' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
            title="Standard Map"
          >
            <Map className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMapLayerChange('satellite')}
            className={`p-2 rounded transition-colors ${mapLayer === 'satellite' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
            title="Satellite View"
          >
            <Layers className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
