import { useEffect, useCallback } from 'react';
import { useMapEvents, Polyline, CircleMarker } from 'react-leaflet';
import { Coordinate } from '@/types/survey';

interface RiverDrawingToolProps {
  isDrawing: boolean;
  riverPoints: Coordinate[];
  onPointAdd: (point: Coordinate) => void;
  onDrawingComplete: () => void;
}

/**
 * Component that handles drawing a river polyline on the map.
 * When active, captures click events and adds points to the river line.
 */
export function RiverDrawingTool({ 
  isDrawing, 
  riverPoints, 
  onPointAdd,
  onDrawingComplete 
}: RiverDrawingToolProps) {
  
  // Handle map clicks when in drawing mode
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onPointAdd({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });

  // Handle keyboard events for completing the drawing
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isDrawing && (e.key === 'Enter' || e.key === 'Escape')) {
      onDrawingComplete();
    }
  }, [isDrawing, onDrawingComplete]);

  useEffect(() => {
    if (isDrawing) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawing, handleKeyDown]);

  if (!isDrawing && riverPoints.length === 0) return null;

  return (
    <>
      {/* River line */}
      {riverPoints.length >= 2 && (
        <Polyline
          positions={riverPoints.map(p => [p.lat, p.lng] as [number, number])}
          pathOptions={{
            color: 'hsl(210, 100%, 50%)',
            weight: 4,
            opacity: 0.8,
            dashArray: isDrawing ? '10, 5' : undefined,
          }}
        />
      )}
      
      {/* River points (vertices) */}
      {riverPoints.map((point, index) => (
        <CircleMarker
          key={index}
          center={[point.lat, point.lng]}
          radius={6}
          pathOptions={{
            color: 'hsl(210, 100%, 40%)',
            fillColor: 'hsl(210, 100%, 60%)',
            fillOpacity: 1,
            weight: 2,
          }}
        />
      ))}
    </>
  );
}

export default RiverDrawingTool;
