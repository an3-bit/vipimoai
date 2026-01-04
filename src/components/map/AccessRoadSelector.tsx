import { useState, useCallback } from 'react';
import { Polyline, Popup } from 'react-leaflet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Check, Anchor } from 'lucide-react';

export interface AccessEdge {
  edgeIndex: number;
  roadWidth: number;
  label: string;
  bearing: number; // NEW: Edge bearing for grid alignment
  length: number;  // NEW: Edge length in meters
}

interface AccessRoadSelectorProps {
  parcelCoordinates: { lat: number; lng: number }[];
  accessEdges: AccessEdge[];
  onAccessEdgeToggle: (edgeIndex: number, roadWidth?: number, bearing?: number, length?: number) => void;
  enabled: boolean;
}

/**
 * Calculate the bearing (angle) between two coordinates
 * Returns angle in degrees from North (0-360)
 */
function calculateBearing(start: { lat: number; lng: number }, end: { lat: number; lng: number }): number {
  const dLng = (end.lng - start.lng) * Math.PI / 180;
  const lat1 = start.lat * Math.PI / 180;
  const lat2 = end.lat * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Calculate the length of an edge in meters using Haversine formula
 */
function calculateEdgeLength(start: { lat: number; lng: number }, end: { lat: number; lng: number }): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (end.lat - start.lat) * Math.PI / 180;
  const dLng = (end.lng - start.lng) * Math.PI / 180;
  const lat1 = start.lat * Math.PI / 180;
  const lat2 = end.lat * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

// Get the edge segments from parcel coordinates with bearing and length
function getEdgeSegments(coords: { lat: number; lng: number }[]): { 
  start: { lat: number; lng: number }; 
  end: { lat: number; lng: number }; 
  index: number;
  bearing: number;
  length: number;
}[] {
  if (coords.length < 3) return [];
  
  const edges: { 
    start: { lat: number; lng: number }; 
    end: { lat: number; lng: number }; 
    index: number;
    bearing: number;
    length: number;
  }[] = [];
  
  for (let i = 0; i < coords.length; i++) {
    const start = coords[i];
    const end = coords[(i + 1) % coords.length];
    edges.push({ 
      start, 
      end, 
      index: i,
      bearing: calculateBearing(start, end),
      length: calculateEdgeLength(start, end)
    });
  }
  return edges;
}

// Get human-readable direction for an edge
function getEdgeDirection(start: { lat: number; lng: number }, end: { lat: number; lng: number }): string {
  const latDiff = end.lat - start.lat;
  const lngDiff = end.lng - start.lng;
  
  // Determine primary direction
  if (Math.abs(latDiff) > Math.abs(lngDiff)) {
    return latDiff > 0 ? 'North' : 'South';
  } else {
    return lngDiff > 0 ? 'East' : 'West';
  }
}

export function AccessRoadSelector({ 
  parcelCoordinates, 
  accessEdges, 
  onAccessEdgeToggle,
  enabled 
}: AccessRoadSelectorProps) {
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null);
  const [selectedEdgeBearing, setSelectedEdgeBearing] = useState<number>(0);
  const [selectedEdgeLength, setSelectedEdgeLength] = useState<number>(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roadWidthInput, setRoadWidthInput] = useState('9');
  const [roadType, setRoadType] = useState<'custom' | '9' | '12' | 'highway'>('9');
  
  const edges = getEdgeSegments(parcelCoordinates);
  
  const handleEdgeClick = useCallback((edgeIndex: number) => {
    if (!enabled) return;
    
    // Check if edge is already an access road
    const existingEdge = accessEdges.find(e => e.edgeIndex === edgeIndex);
    
    if (existingEdge) {
      // Remove the access road
      onAccessEdgeToggle(edgeIndex);
    } else {
      // Open dialog to configure road width
      setSelectedEdgeIndex(edgeIndex);
      setSelectedEdgeBearing(edges.find(e => e.index === edgeIndex)?.bearing || 0);
      setSelectedEdgeLength(edges.find(e => e.index === edgeIndex)?.length || 0);
      setDialogOpen(true);
    }
  }, [enabled, accessEdges, onAccessEdgeToggle, edges]);
  
  const handleConfirmRoad = useCallback(() => {
    if (selectedEdgeIndex === null) return;
    
    let width: number;
    switch (roadType) {
      case '9':
        width = 9;
        break;
      case '12':
        width = 12;
        break;
      case 'highway':
        width = 20;
        break;
      case 'custom':
        width = parseFloat(roadWidthInput) || 9;
        break;
      default:
        width = 9;
    }
    
    // Pass bearing and length for grid alignment (Manual Anchor)
    onAccessEdgeToggle(selectedEdgeIndex, width, selectedEdgeBearing, selectedEdgeLength);
    setDialogOpen(false);
    setSelectedEdgeIndex(null);
  }, [selectedEdgeIndex, roadType, roadWidthInput, onAccessEdgeToggle, selectedEdgeBearing, selectedEdgeLength]);
  
  if (parcelCoordinates.length < 3) return null;
  
  return (
    <>
      {edges.map((edge) => {
        const isAccessRoad = accessEdges.some(ae => ae.edgeIndex === edge.index);
        const accessEdge = accessEdges.find(ae => ae.edgeIndex === edge.index);
        const direction = getEdgeDirection(edge.start, edge.end);
        
        return (
          <Polyline
            key={`edge-selector-${edge.index}`}
            positions={[[edge.start.lat, edge.start.lng], [edge.end.lat, edge.end.lng]]}
            pathOptions={{
              color: isAccessRoad ? 'hsl(142, 76%, 36%)' : (enabled ? 'hsl(38, 92%, 50%)' : 'transparent'),
              weight: isAccessRoad ? 8 : (enabled ? 6 : 0),
              opacity: isAccessRoad ? 0.9 : (enabled ? 0.6 : 0),
              lineCap: 'round',
              dashArray: isAccessRoad ? undefined : '10, 10',
            }}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation();
                handleEdgeClick(edge.index);
              },
              mouseover: (e) => {
                if (enabled && !isAccessRoad) {
                  e.target.setStyle({ opacity: 0.9, weight: 8 });
                }
              },
              mouseout: (e) => {
                if (enabled && !isAccessRoad) {
                  e.target.setStyle({ opacity: 0.6, weight: 6 });
                }
              },
            }}
          >
            {isAccessRoad && accessEdge && (
              <Popup>
                <div className="text-center p-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Anchor className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-emerald-600">Access Anchor ({direction} Edge)</span>
                  </div>
                  <p className="text-sm">Width: {accessEdge.roadWidth}m</p>
                  <p className="text-xs text-muted-foreground">
                    Bearing: {Math.round(accessEdge.bearing)}° | Length: {Math.round(accessEdge.length)}m
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Grid aligned to this edge (0m buffer)
                  </p>
                  <button 
                    onClick={() => onAccessEdgeToggle(edge.index)}
                    className="text-xs text-destructive hover:underline mt-1"
                  >
                    Remove Anchor
                  </button>
                </div>
              </Popup>
            )}
          </Polyline>
        );
      })}
      
      {/* Road Width Configuration Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-primary" />
              Set Access Anchor
            </DialogTitle>
            <DialogDescription>
              This edge will become the anchor for grid alignment. Plots will align parallel to this edge with 0m buffer (existing road).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Road Type</Label>
              <Select value={roadType} onValueChange={(v: any) => setRoadType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9">Local Access (9m)</SelectItem>
                  <SelectItem value="12">Collector Road (12m)</SelectItem>
                  <SelectItem value="highway">Highway (20m)</SelectItem>
                  <SelectItem value="custom">Custom Width</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {roadType === 'custom' && (
              <div className="space-y-2">
                <Label>Road Width (meters)</Label>
                <Input 
                  type="number"
                  value={roadWidthInput}
                  onChange={(e) => setRoadWidthInput(e.target.value)}
                  placeholder="Enter width in meters"
                  min={3}
                  max={50}
                />
              </div>
            )}
            
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium text-primary mb-1">⚓ Manual Anchor Mode</p>
              <p className="text-muted-foreground mb-2">
                Grid rotation will align to this edge bearing ({Math.round(selectedEdgeBearing)}°). 
                No internal buffer will be applied on this side.
              </p>
              <p className="text-xs text-muted-foreground">
                Edge length: {Math.round(selectedEdgeLength)}m
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRoad} className="gap-2">
              <Anchor className="h-4 w-4" />
              Set Anchor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
