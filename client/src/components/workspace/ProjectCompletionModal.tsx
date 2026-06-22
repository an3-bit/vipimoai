import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, AlertTriangle, Loader2, FileText, Map, 
  Users, Download, Shield, PartyPopper
} from 'lucide-react';
import { toast } from 'sonner';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
  autoChecked?: boolean;
}

interface ProjectCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  plotCount: number;
  invalidPlotCount: number;
  hasExported: boolean;
  onComplete: () => Promise<void>;
  onArchive?: () => Promise<void>;
  isCompleting: boolean;
}

export function ProjectCompletionModal({
  open,
  onOpenChange,
  projectName,
  plotCount,
  invalidPlotCount,
  hasExported,
  onComplete,
  onArchive,
  isCompleting,
}: ProjectCompletionModalProps) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const checklistItems: ChecklistItem[] = [
    {
      id: 'plots_generated',
      label: 'All plots have been generated',
      description: `${plotCount} valid plots created`,
      icon: <Map className="h-4 w-4" />,
      required: true,
      autoChecked: plotCount > 0,
    },
    {
      id: 'no_invalid_plots',
      label: 'No invalid plots remaining',
      description: invalidPlotCount > 0 
        ? `${invalidPlotCount} plots still overlap riparian zones` 
        : 'All plots clear of hazard zones',
      icon: <Shield className="h-4 w-4" />,
      required: true,
      autoChecked: invalidPlotCount === 0,
    },
    {
      id: 'mutation_reviewed',
      label: 'Mutation form reviewed',
      description: 'RL 7A form data verified for accuracy',
      icon: <FileText className="h-4 w-4" />,
      required: true,
      autoChecked: false,
    },
    {
      id: 'coordinates_verified',
      label: 'Beacon coordinates verified',
      description: 'UTM coordinates match field survey',
      icon: <Map className="h-4 w-4" />,
      required: true,
      autoChecked: false,
    },
    {
      id: 'client_approval',
      label: 'Client approval obtained',
      description: 'Subdivision layout approved by landowner',
      icon: <Users className="h-4 w-4" />,
      required: false,
      autoChecked: false,
    },
    {
      id: 'exports_completed',
      label: 'All exports completed',
      description: 'Ardhisasa JSON and PDF mutation form downloaded',
      icon: <Download className="h-4 w-4" />,
      required: false,
      autoChecked: hasExported,
    },
  ];

  // Initialize checked state based on autoChecked
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    checklistItems.forEach(item => {
      initial[item.id] = item.autoChecked || false;
    });
    setCheckedItems(initial);
  }, [plotCount, invalidPlotCount, hasExported]);

  const requiredItems = checklistItems.filter(item => item.required);
  const allRequiredChecked = requiredItems.every(item => checkedItems[item.id]);
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = checklistItems.length;

  const handleComplete = async () => {
    if (!allRequiredChecked) {
      toast.error('Please complete all required items before marking as complete');
      return;
    }

    try {
      await onComplete();
      setShowSuccess(true);
    } catch (error) {
      toast.error('Failed to complete project');
    }
  };

  const handleClose = () => {
    setShowSuccess(false);
    onOpenChange(false);
  };

  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md text-center glass-panel">
          <div className="py-8">
            <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-success/20 flex items-center justify-center animate-in zoom-in duration-300">
              <PartyPopper className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Project Completed!</h2>
            <p className="text-muted-foreground mb-6">
              "{projectName}" has been marked as complete and is ready for submission.
            </p>
            <div className="flex gap-3 justify-center">
              {onArchive && (
                <Button variant="outline" onClick={() => onArchive()}>
                  Archive Project
                </Button>
              )}
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg glass-panel">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            Complete Project
          </DialogTitle>
          <DialogDescription>
            Review the checklist before marking "{projectName}" as complete
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <span className="text-sm text-muted-foreground">Checklist Progress</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden">
                <div 
                  className="h-full bg-success transition-all duration-300"
                  style={{ width: `${(checkedCount / totalCount) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium">{checkedCount}/{totalCount}</span>
            </div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {checklistItems.map((item) => {
              const isChecked = checkedItems[item.id];
              const hasIssue = item.required && item.autoChecked === false && !isChecked;
              
              return (
                <div 
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    isChecked 
                      ? 'bg-success/10 border-success/30' 
                      : hasIssue && item.id === 'no_invalid_plots' && invalidPlotCount > 0
                      ? 'bg-destructive/10 border-destructive/30'
                      : 'bg-secondary/30 border-border/50'
                  }`}
                >
                  <Checkbox
                    id={item.id}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      setCheckedItems(prev => ({ ...prev, [item.id]: !!checked }));
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <Label 
                      htmlFor={item.id} 
                      className="flex items-center gap-2 cursor-pointer text-sm font-medium"
                    >
                      <span className={isChecked ? 'text-success' : 'text-muted-foreground'}>
                        {item.icon}
                      </span>
                      {item.label}
                      {item.required && (
                        <span className="text-destructive text-xs">*</span>
                      )}
                    </Label>
                    <p className={`text-xs mt-0.5 ${
                      item.id === 'no_invalid_plots' && invalidPlotCount > 0
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}>
                      {item.description}
                    </p>
                  </div>
                  {isChecked && (
                    <CheckCircle className="h-4 w-4 text-success shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm text-muted-foreground">
              Completion Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes for this project..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-secondary/50 resize-none"
              rows={2}
            />
          </div>

          {/* Warning if not all required checked */}
          {!allRequiredChecked && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <span className="text-warning">Complete all required items (*) to proceed</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleComplete}
            disabled={!allRequiredChecked || isCompleting}
            className="flex-1 bg-success hover:bg-success/90"
          >
            {isCompleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}