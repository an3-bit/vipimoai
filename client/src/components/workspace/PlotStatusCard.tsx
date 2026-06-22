import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatArea } from '@/lib/geometry';
import { MapPin, Check, Clock, DollarSign } from 'lucide-react';

export type PlotStatus = 'available' | 'reserved' | 'sold';

interface PlotStatusCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plotNumber: number;
  areaSqm: number;
  currentStatus: PlotStatus;
  onStatusChange: (status: PlotStatus) => void;
  isUpdating?: boolean;
}

const statusConfig = {
  available: {
    label: 'Available',
    color: 'bg-emerald-500 hover:bg-emerald-600',
    icon: Check,
    description: 'Plot is open for purchase',
  },
  reserved: {
    label: 'Reserved',
    color: 'bg-amber-500 hover:bg-amber-600',
    icon: Clock,
    description: 'Plot is temporarily held',
  },
  sold: {
    label: 'Sold',
    color: 'bg-rose-500 hover:bg-rose-600',
    icon: DollarSign,
    description: 'Plot has been purchased',
  },
};

export function PlotStatusCard({
  open,
  onOpenChange,
  plotNumber,
  areaSqm,
  currentStatus,
  onStatusChange,
  isUpdating = false,
}: PlotStatusCardProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs mx-4 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Plot {plotNumber}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Area: {formatArea(areaSqm)} ({areaSqm.toFixed(0)} m²)
          </p>
        </DialogHeader>

        {/* Current Status Indicator */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Current:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${
              currentStatus === 'available' ? 'bg-emerald-500' :
              currentStatus === 'reserved' ? 'bg-amber-500' : 'bg-rose-500'
            }`}>
              {statusConfig[currentStatus].label}
            </span>
          </div>
        </div>

        {/* Status Buttons */}
        <div className="p-4 pt-2 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">Change status:</p>
          
          {(Object.entries(statusConfig) as [PlotStatus, typeof statusConfig.available][]).map(([status, config]) => {
            const Icon = config.icon;
            const isActive = currentStatus === status;
            
            return (
              <Button
                key={status}
                variant={isActive ? 'default' : 'outline'}
                className={`w-full justify-start gap-3 h-12 ${isActive ? config.color : ''}`}
                onClick={() => {
                  onStatusChange(status);
                }}
                disabled={isUpdating || isActive}
              >
                <Icon className="h-5 w-5" />
                <div className="text-left">
                  <p className="font-medium">{config.label}</p>
                  <p className="text-xs opacity-80">{config.description}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
