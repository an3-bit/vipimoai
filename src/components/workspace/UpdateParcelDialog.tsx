import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ParcelUpload } from '@/components/map/ParcelUpload';
import { Coordinate } from '@/types/survey';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';

interface UpdateParcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentParcelName: string;
  onCoordinatesLoaded: (coordinates: Coordinate[]) => void;
  onUpdate: (coordinates: Coordinate[]) => void;
  isUpdating: boolean;
}

export function UpdateParcelDialog({
  open,
  onOpenChange,
  currentParcelName,
  onCoordinatesLoaded,
  onUpdate,
  isUpdating,
}: UpdateParcelDialogProps) {
  const handleUpdate = (coordinates: Coordinate[]) => {
    if (coordinates.length >= 3) {
      onUpdate(coordinates);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto z-[9999]">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Update Parcel Coordinates
          </DialogTitle>
          <DialogDescription>
            Upload new coordinates for <span className="font-semibold text-foreground">{currentParcelName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Upload a new shapefile or coordinates file to update the parcel boundary. The system will recalculate all subdivisions based on the new coordinates.
            </AlertDescription>
          </Alert>

          <div className="border rounded-lg p-4 bg-secondary/30">
            <ParcelUpload onCoordinatesLoaded={onCoordinatesLoaded} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              type="button"
              className="flex-1"
              disabled={isUpdating}
              onClick={() => {
                // This will be handled by the parent component
                // The ParcelUpload component will call onCoordinatesLoaded
              }}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Parcel'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
