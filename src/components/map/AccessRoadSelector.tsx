import { useState, useCallback } from 'react';
import { Polyline, Popup } from 'react-leaflet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Check } from 'lucide-react';

export interface AccessEdge {
  edgeIndex: number;
  roadWidth: number;
  label: string;
}

interface AccessRoadSelectorProps {
  parcelCoordinates: { lat: number; lng: number }[];
  accessEdges: AccessEdge[];
  onAccessEdgeToggle: (edgeIndex: number, roadWidth?: number) => void;
  enabled: boolean;
}

// Get the edge segments from parcel coordinates
function getEdgeSegments(coords: { lat: number; lng: number }[]): { start: { lat: number; lng: number }; end: { lat: number; lng: number }; index: number }[] {
  if (coords.length < 3) return [];
  
  const edges: { start: { lat: number; lng: number }; end: { lat: number; lng: number }; index: number }[] = [];
  for (let i = 0; i < coords.length; i++) {
    const start = coords[i];
    const end = coords[(i + 1) % coords.length];
    edges.push({ start, end, index: i });
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
      setDialogOpen(true);
    }
  }, [enabled, accessEdges, onAccessEdgeToggle]);
  
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
    
    onAccessEdgeToggle(selectedEdgeIndex, width);
    setDialogOpen(false);
    setSelectedEdgeIndex(null);
  }, [selectedEdgeIndex, roadType, roadWidthInput, onAccessEdgeToggle]);
  
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
                    <Route className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-emerald-600">Access Road ({direction} Edge)</span>
                  </div>
                  <p className="text-sm">Width: {accessEdge.roadWidth}m</p>
                  <button 
                    onClick={() => onAccessEdgeToggle(edge.index)}
                    className="text-xs text-destructive hover:underline mt-1"
                  >
                    Remove Access Road
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
              <Route className="h-5 w-5 text-primary" />
              Configure Access Road
            </DialogTitle>
            <DialogDescription>
              Set the width of the existing access road on this boundary. Plots will be placed directly against this edge without internal road surrender.
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
              <p className="font-medium text-primary mb-1">💡 Frontage Optimization</p>
              <p className="text-muted-foreground">
                Plots on this edge will face the existing road directly, maximizing land yield by eliminating internal road surrender.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRoad} className="gap-2">
              <Check className="h-4 w-4" />
              Set Access Road
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
