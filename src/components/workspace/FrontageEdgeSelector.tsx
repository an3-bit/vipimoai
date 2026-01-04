import { useState, useCallback } from 'react';
import { CircleMarker, Polyline, Popup } from 'react-leaflet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, MapPin, CheckCircle2 } from 'lucide-react';
import { Coordinate } from '@/types/survey';

interface FrontageEdgeSelectorProps {
  parcelCoordinates: Coordinate[];
  onFrontageSelected: (startIndex: number, endIndex: number) => void;
  isEnabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

/**
 * Component that allows surveyors to click 2+ coordinates along the parcel
 * boundary that face the road, marking the primary frontage edge
 */
export function FrontageEdgeSelector({
  parcelCoordinates,
  onFrontageSelected,
  isEnabled,
  onEnabledChange,
}: FrontageEdgeSelectorProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleCoordinateClick = useCallback(
    (index: number) => {
      if (!isEnabled) return;

      setSelectedIndices((prev) => {
        const already = prev.includes(index);
        if (already) {
          // Remove if clicked again
          return prev.filter((i) => i !== index);
        } else {
          // Add if not already selected
          return [...prev, index].sort((a, b) => a - b);
        }
      });
    },
    [isEnabled]
  );

  const handleConfirm = () => {
    if (selectedIndices.length >= 2) {
      const startIdx = Math.min(...selectedIndices);
      const endIdx = Math.max(...selectedIndices);
      onFrontageSelected(startIdx, endIdx);
      setSelectedIndices([]);
      onEnabledChange(false);
      setShowConfirmDialog(false);
    }
  };

  const handleCancel = () => {
    setSelectedIndices([]);
    onEnabledChange(false);
  };

  if (!isEnabled || parcelCoordinates.length < 3) return null;

  // Calculate edge length between two coordinates
  const getEdgeLength = (idx1: number, idx2: number): number => {
    const c1 = parcelCoordinates[idx1];
    const c2 = parcelCoordinates[idx2];
    const dLat = (c2.lat - c1.lat) * Math.PI / 180;
    const dLng = (c2.lng - c1.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(c1.lat * Math.PI / 180) *
        Math.cos(c2.lat * Math.PI / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371000 * c; // Earth radius in meters
  };

  // Get selected edge segment
  const selectedEdgeLength =
    selectedIndices.length >= 2
      ? (() => {
          let total = 0;
          for (let i = 0; i < selectedIndices.length - 1; i++) {
            total += getEdgeLength(selectedIndices[i], selectedIndices[i + 1]);
          }
          return total;
        })()
      : 0;

  return (
    <>
      {/* Render clickable markers on parcel boundary */}
      {parcelCoordinates.map((coord, idx) => {
        const isSelected = selectedIndices.includes(idx);
        const isStart = selectedIndices.length > 0 && selectedIndices[0] === idx;
        const isEnd = selectedIndices.length > 0 && selectedIndices[selectedIndices.length - 1] === idx;

        return (
          <CircleMarker
            key={`frontage-marker-${idx}`}
            center={[coord.lat, coord.lng]}
            radius={isSelected ? 8 : 5}
            fillColor={isStart ? '#ef4444' : isEnd ? '#22c55e' : isSelected ? '#3b82f6' : '#94a3b8'}
            fillOpacity={0.8}
            weight={isSelected ? 2 : 1}
            color={isSelected ? '#1e293b' : '#64748b'}
            interactive={true}
            eventHandlers={{
              click: () => handleCoordinateClick(idx),
            }}
          >
            <Popup>
              <div className="text-center text-xs">
                <p className="font-semibold">Vertex {idx + 1}</p>
                <p className="text-muted-foreground">{coord.lat.toFixed(6)}</p>
                <p className="text-muted-foreground">{coord.lng.toFixed(6)}</p>
                {isSelected && (
                  <p className="text-blue-600 font-medium mt-1">
                    {isStart ? '🔴 Start' : isEnd ? '🟢 End' : '🔵 Selected'}
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Highlight selected edge */}
      {selectedIndices.length >= 2 && (
        <Polyline
          positions={selectedIndices.map((idx) => [
            parcelCoordinates[idx].lat,
            parcelCoordinates[idx].lng,
          ])}
          color="#3b82f6"
          weight={4}
          opacity={0.7}
          dashArray="5, 5"
        />
      )}

      {/* Info Banner */}
      <div className="fixed bottom-32 left-96 bg-white border-l-4 border-blue-500 rounded-lg shadow-lg p-4 max-w-xs z-50">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-sm text-foreground">
              Select Frontage Edge
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click 2 or more coordinates along the parcel boundary that face the road.
            </p>
            {selectedIndices.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium">
                  Selected: {selectedIndices.length} vertices
                </p>
                <p className="text-xs text-muted-foreground">
                  Length: {selectedEdgeLength.toFixed(0)}m
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            className="flex-1 text-xs h-7"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => setShowConfirmDialog(true)}
            disabled={selectedIndices.length < 2}
            className="flex-1 text-xs h-7"
          >
            Confirm
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Confirm Road Frontage
            </DialogTitle>
            <DialogDescription>
              You've selected {selectedIndices.length} coordinates as the road-facing edge.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Selected Edge Information
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                <div>
                  <p className="text-muted-foreground">Start Vertex</p>
                  <p className="font-medium">#{selectedIndices[0] + 1}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">End Vertex</p>
                  <p className="font-medium">
                    #{selectedIndices[selectedIndices.length - 1] + 1}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Edge Length</p>
                  <p className="font-medium">{selectedEdgeLength.toFixed(0)}m</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vertices</p>
                  <p className="font-medium">{selectedIndices.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                The subdivision engine will use this edge as the primary frontage for
                optimal road access and plot layout.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Adjust Selection
            </Button>
            <Button onClick={handleConfirm}>
              Confirm & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
