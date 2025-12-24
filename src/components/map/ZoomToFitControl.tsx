import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';

interface ZoomToFitControlProps {
  coordinates: { lat: number; lng: number }[];
}

export interface ZoomToFitRef {
  fitBounds: () => void;
}

export const ZoomToFitControl = forwardRef<ZoomToFitRef, ZoomToFitControlProps>(
  ({ coordinates }, ref) => {
    const map = useMap();

    const fitBounds = useCallback(() => {
      if (coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates.map(c => [c.lat, c.lng]));
        map.flyToBounds(bounds, { padding: [80, 80], duration: 0.5 });
      }
    }, [coordinates, map]);

    useImperativeHandle(ref, () => ({
      fitBounds,
    }), [fitBounds]);

    // Initial fit on mount
    useEffect(() => {
      if (coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates.map(c => [c.lat, c.lng]));
        map.fitBounds(bounds, { padding: [100, 100] });
      }
    }, [coordinates, map]);

    return null;
  }
);

ZoomToFitControl.displayName = 'ZoomToFitControl';
