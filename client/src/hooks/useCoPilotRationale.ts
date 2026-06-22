import { useCallback } from 'react';

interface RationaleData {
  plotCount: number;
  invalidCount: number;
  efficiency: number;
  roadWidthM: number;
  plotWidthM: number;
  plotDepthM: number;
  hasRiparianBuffer: boolean;
  riparianBufferM?: number;
  accessEdgeDirection?: string;
  accessEdgeCount: number;
}

export interface SubdivisionRationale {
  summary: string;
  details: {
    yield: string;
    frontage: string;
    efficiency: string;
    safety: string;
  };
  formatted: string;
}

export function useCoPilotRationale() {
  const generateRationale = useCallback((data: RationaleData): SubdivisionRationale => {
    const {
      plotCount,
      invalidCount,
      efficiency,
      roadWidthM,
      plotWidthM,
      plotDepthM,
      hasRiparianBuffer,
      riparianBufferM = 30,
      accessEdgeDirection,
      accessEdgeCount,
    } = data;

    // Build rationale details
    const yieldText = `Generated ${plotCount} valid plots (${plotWidthM.toFixed(1)}m × ${plotDepthM.toFixed(1)}m each)`;
    
    let frontageText = 'Standard grid layout applied';
    if (accessEdgeCount > 0 && accessEdgeDirection) {
      frontageText = `Detected road on ${accessEdgeDirection} boundary; aligned Row 1 for direct frontage access`;
    } else if (accessEdgeCount > 0) {
      frontageText = `${accessEdgeCount} access road(s) detected; optimized front-row placement`;
    }
    
    const efficiencyText = `Achieved ${efficiency}% land utilization (${roadWidthM}m internal roads)`;
    
    let safetyText = 'No environmental constraints applied';
    if (hasRiparianBuffer) {
      safetyText = `Buffered ${riparianBufferM}m from river/riparian zone`;
      if (invalidCount > 0) {
        safetyText += ` (${invalidCount} plots excluded)`;
      }
    }

    // Build formatted message
    const formatted = `**Subdivision Complete.**

1. **Yield:** ${yieldText}
2. **Frontage:** ${frontageText}
3. **Efficiency:** ${efficiencyText}
4. **Safety:** ${safetyText}`;

    return {
      summary: `Generated ${plotCount} plots at ${efficiency}% efficiency`,
      details: {
        yield: yieldText,
        frontage: frontageText,
        efficiency: efficiencyText,
        safety: safetyText,
      },
      formatted,
    };
  }, []);

  return { generateRationale };
}
