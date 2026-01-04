import { History, HelpCircle, Maximize2, Map, Layers, Mountain, X } from 'lucide-react';
import { ActivityTimeline } from './ActivityTimeline';

interface WorkspaceMapControlsProps {
  mapLayer: 'standard' | 'satellite' | 'topo';
  onMapLayerChange: (layer: 'standard' | 'satellite' | 'topo') => void;
  showTimeline: boolean;
  onShowTimelineChange: (show: boolean) => void;
  onZoomToFit: () => void;
  onShowTour: () => void;
  projectId: string;
}

export function WorkspaceMapControls({
  mapLayer,
  onMapLayerChange,
  showTimeline,
  onShowTimelineChange,
  onZoomToFit,
  onShowTour,
  projectId,
}: WorkspaceMapControlsProps) {
  return (
    <>
      {/* Layer Toggle (Top Right) */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        {/* Activity Timeline Toggle */}
        <button
          onClick={() => onShowTimelineChange(!showTimeline)}
          className={`floating-control p-2 rounded transition-colors ${
            showTimeline ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
          }`}
          title="Activity Timeline"
        >
          <History className="h-4 w-4" />
        </button>

        {/* Help / Tour Button */}
        <button
          onClick={onShowTour}
          className="floating-control p-2 rounded transition-colors hover:bg-secondary"
          title="Show Tour"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Zoom to Fit Button */}
        <button
          onClick={onZoomToFit}
          className="floating-control p-2 rounded transition-colors hover:bg-secondary"
          title="Zoom to Fit"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {/* Map Layer Toggle */}
        <div className="floating-control flex flex-col gap-1">
          <button
            onClick={() => onMapLayerChange('standard')}
            className={`p-2 rounded transition-colors ${
              mapLayer === 'standard' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
            }`}
            title="Standard Map"
          >
            <Map className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMapLayerChange('satellite')}
            className={`p-2 rounded transition-colors ${
              mapLayer === 'satellite' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
            }`}
            title="Satellite View"
          >
            <Layers className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMapLayerChange('topo')}
            className={`p-2 rounded transition-colors ${
              mapLayer === 'topo' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
            }`}
            title="Topographic"
          >
            <Mountain className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Activity Timeline Panel */}
      {showTimeline && (
        <div className="absolute top-16 right-4 z-[1000] w-80">
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Activity Timeline
              </h3>
              <button onClick={() => onShowTimelineChange(false)} className="p-1 hover:bg-secondary rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <ActivityTimeline projectId={projectId || ''} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
