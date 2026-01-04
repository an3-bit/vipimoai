import { Loader2, Route, Waves, X } from 'lucide-react';

interface WorkspaceOverlaysProps {
  isSaving: boolean;
  accessRoadMode: boolean;
  onAccessRoadModeChange: (mode: boolean) => void;
  isDrawingRiver: boolean;
  onFinishDrawRiver: () => void;
}

export function WorkspaceOverlays({
  isSaving,
  accessRoadMode,
  onAccessRoadModeChange,
  isDrawingRiver,
  onFinishDrawRiver,
}: WorkspaceOverlaysProps) {
  return (
    <>
      {/* Access Road Mode Indicator */}
      {accessRoadMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="glass-panel rounded-lg px-4 py-2 flex items-center gap-3 bg-amber-500/90 text-white">
            <Route className="h-4 w-4" />
            <span className="text-sm font-medium">Click a boundary edge to mark as existing Access Road</span>
            <button
              onClick={() => onAccessRoadModeChange(false)}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* River Drawing Indicator */}
      {isDrawingRiver && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="glass-panel rounded-lg px-4 py-2 flex items-center gap-3 bg-primary/90 text-primary-foreground">
            <Waves className="h-4 w-4" />
            <span className="text-sm font-medium">Drawing River - Click to add points, Enter to finish</span>
            <button
              onClick={onFinishDrawRiver}
              className="p-1 hover:bg-primary-foreground/20 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Saving Indicator */}
      {isSaving && (
        <div className="absolute top-4 right-20 z-[1000]">
          <div className="glass-panel rounded-lg px-4 py-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm">Saving...</span>
          </div>
        </div>
      )}
    </>
  );
}
