import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ParcelUpload } from '@/components/map/ParcelUpload';
import { Coordinate } from '@/types/survey';
import { Plus, Loader2 } from 'lucide-react';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  clientName: string;
  onClientNameChange: (name: string) => void;
  locationName: string;
  onLocationNameChange: (name: string) => void;
  parcelCoordinates: Coordinate[] | null;
  onCoordinatesLoaded: (coordinates: Coordinate[]) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  projectName,
  onProjectNameChange,
  clientName,
  onClientNameChange,
  locationName,
  onLocationNameChange,
  parcelCoordinates,
  onCoordinatesLoaded,
  isSubmitting,
  onSubmit,
}: NewProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto z-[9999]">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create New Survey Project
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5 mt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Juja Farm Block 5"
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                required
                autoFocus
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="client">Client Name</Label>
                <Input
                  id="client"
                  placeholder="e.g., ABC Developers"
                  value={clientName}
                  onChange={(e) => onClientNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Juja, Kiambu"
                  value={locationName}
                  onChange={(e) => onLocationNameChange(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="border-t border-border pt-4">
            <ParcelUpload onCoordinatesLoaded={onCoordinatesLoaded} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={isSubmitting || !parcelCoordinates || !projectName.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
          
          {!parcelCoordinates && (
            <p className="text-xs text-center text-muted-foreground">
              Upload parcel coordinates to create project
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
