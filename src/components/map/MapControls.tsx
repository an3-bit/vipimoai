import { Button } from '@/components/ui/button';
import { Layers, Satellite, Map, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapControlsProps {
  showSatellite: boolean;
  onToggleSatellite: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitBounds?: () => void;
  className?: string;
}

export function MapControls({
  showSatellite,
  onToggleSatellite,
  onZoomIn,
  onZoomOut,
  onFitBounds,
  className,
}: MapControlsProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={onToggleSatellite}
        className="bg-background/90 backdrop-blur-sm"
        title={showSatellite ? 'Switch to Map View' : 'Switch to Satellite View'}
      >
        {showSatellite ? <Map className="h-4 w-4" /> : <Satellite className="h-4 w-4" />}
      </Button>
      
      {onZoomIn && (
        <Button
          variant="outline"
          size="icon"
          onClick={onZoomIn}
          className="bg-background/90 backdrop-blur-sm"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      )}
      
      {onZoomOut && (
        <Button
          variant="outline"
          size="icon"
          onClick={onZoomOut}
          className="bg-background/90 backdrop-blur-sm"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      )}
      
      {onFitBounds && (
        <Button
          variant="outline"
          size="icon"
          onClick={onFitBounds}
          className="bg-background/90 backdrop-blur-sm"
          title="Fit to Bounds"
        >
          <Maximize className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
