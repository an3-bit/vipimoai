import { useState, useCallback, useMemo } from 'react';
import { Coordinate } from '@/types/survey';
import { createRiparianBuffer, filterPlotsByRiparian } from '@/lib/riparian';

export interface UseRiparianBufferReturn {
  // River drawing state
  isDrawingRiver: boolean;
  riverPoints: Coordinate[];
  bufferPolygon: Coordinate[];
  bufferDistance: number;
  
  // Actions
  startDrawing: () => void;
  stopDrawing: () => void;
  addRiverPoint: (point: Coordinate) => void;
  clearRiver: () => void;
  setBufferDistance: (distance: number) => void;
  
  // Collision detection
  filterPlotsWithRiparian: (plots: Coordinate[][]) => {
    validPlots: { coordinates: Coordinate[]; index: number }[];
    invalidPlots: { coordinates: Coordinate[]; index: number; overlapPercent: number }[];
  };
  
  // Status
  hasRiver: boolean;
  hasBuffer: boolean;
}

/**
 * Hook to manage riparian (river) buffer zone creation and collision detection.
 * Uses Turf.js for geospatial operations.
 */
export function useRiparianBuffer(defaultBufferDistance: number = 30): UseRiparianBufferReturn {
  const [isDrawingRiver, setIsDrawingRiver] = useState(false);
  const [riverPoints, setRiverPoints] = useState<Coordinate[]>([]);
  const [bufferDistance, setBufferDistance] = useState(defaultBufferDistance);

  // Generate buffer polygon whenever river points or buffer distance changes
  const bufferPolygon = useMemo(() => {
    if (riverPoints.length < 2) return [];
    return createRiparianBuffer(riverPoints, bufferDistance);
  }, [riverPoints, bufferDistance]);

  const startDrawing = useCallback(() => {
    setIsDrawingRiver(true);
    setRiverPoints([]);
  }, []);

  const stopDrawing = useCallback(() => {
    setIsDrawingRiver(false);
  }, []);

  const addRiverPoint = useCallback((point: Coordinate) => {
    setRiverPoints(prev => [...prev, point]);
  }, []);

  const clearRiver = useCallback(() => {
    setRiverPoints([]);
    setIsDrawingRiver(false);
  }, []);

  // Function to filter plots based on riparian collision
  const filterPlotsWithRiparian = useCallback((plots: Coordinate[][]) => {
    return filterPlotsByRiparian(plots, bufferPolygon);
  }, [bufferPolygon]);

  return {
    isDrawingRiver,
    riverPoints,
    bufferPolygon,
    bufferDistance,
    startDrawing,
    stopDrawing,
    addRiverPoint,
    clearRiver,
    setBufferDistance,
    filterPlotsWithRiparian,
    hasRiver: riverPoints.length >= 2,
    hasBuffer: bufferPolygon.length > 0,
  };
}

export default useRiparianBuffer;
