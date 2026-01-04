import { Loader2, AlertCircle } from 'lucide-react';

interface StatusIndicatorsProps {
  isFetching: boolean;
  hasError: boolean;
}

export function StatusIndicators({ isFetching, hasError }: StatusIndicatorsProps) {
  return (
    <>
      {/* Syncing Indicator */}
      {isFetching && (
        <div className="absolute top-4 right-20 z-[1000]">
          <div className="glass-panel rounded-lg px-3 py-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs">Syncing...</span>
          </div>
        </div>
      )}

      {/* Error Indicator */}
      {hasError && (
        <div className="absolute top-4 right-20 z-[1000]">
          <div className="glass-panel rounded-lg px-3 py-2 flex items-center gap-2 border-destructive/50">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-destructive">Sync Error</span>
          </div>
        </div>
      )}
    </>
  );
}
