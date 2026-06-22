import { TrendingUp, Sparkles } from 'lucide-react';

interface YieldComparisonBadgeProps {
  beforeCount: number;
  afterCount: number;
  visible: boolean;
}

export function YieldComparisonBadge({ beforeCount, afterCount, visible }: YieldComparisonBadgeProps) {
  if (!visible || afterCount <= beforeCount) return null;
  
  const gainedPlots = afterCount - beforeCount;
  const percentGain = beforeCount > 0 ? ((gainedPlots / beforeCount) * 100).toFixed(1) : 0;
  
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-3 bg-emerald-500/90 text-white shadow-lg border border-emerald-400/50">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium">
          Smart Optimization: gained <strong>+{gainedPlots}</strong> plots by using existing road frontage
        </span>
        <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5 text-xs">
          <TrendingUp className="h-3 w-3" />
          {percentGain}%
        </div>
      </div>
    </div>
  );
}
