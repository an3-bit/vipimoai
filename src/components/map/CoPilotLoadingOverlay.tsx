import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoPilotLoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function CoPilotLoadingOverlay({ visible, message = 'Processing...' }: CoPilotLoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div 
      className={cn(
        "absolute inset-0 z-[999] flex items-center justify-center",
        "bg-background/60 backdrop-blur-sm",
        "transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="glass-panel rounded-xl px-6 py-4 flex items-center gap-3 shadow-glow">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
