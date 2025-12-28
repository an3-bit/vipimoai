import { useState } from 'react';
import { Pencil, Edit3, Scissors, MousePointer, Minus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type DraftingTool = 'select' | 'polyline' | 'edit' | 'split' | null;

interface ManualDraftingToolsProps {
  activeTool: DraftingTool;
  onToolChange: (tool: DraftingTool) => void;
  disabled?: boolean;
}

export function ManualDraftingTools({ 
  activeTool, 
  onToolChange, 
  disabled 
}: ManualDraftingToolsProps) {
  const tools = [
    {
      id: 'select' as DraftingTool,
      icon: MousePointer,
      label: 'Select',
      description: 'Select and view plot details',
    },
    {
      id: 'polyline' as DraftingTool,
      icon: Minus,
      label: 'Draw Polyline',
      description: 'Draw roads or boundaries manually',
    },
    {
      id: 'edit' as DraftingTool,
      icon: Edit3,
      label: 'Edit Vertices',
      description: 'Drag plot corners to adjust shape',
    },
    {
      id: 'split' as DraftingTool,
      icon: Scissors,
      label: 'Split Plot',
      description: 'Divide a plot into two equal parts',
    },
  ];

  return (
    <div className="absolute top-32 left-4 z-[1000]">
      <div className="glass-panel rounded-xl p-2 flex flex-col gap-1">
        <div className="px-2 py-1 border-b border-border/50 mb-1">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Pencil className="h-3 w-3" />
            Manual Tools
          </span>
        </div>
        
        <TooltipProvider delayDuration={200}>
          {tools.map((tool) => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToolChange(activeTool === tool.id ? null : tool.id)}
                  disabled={disabled}
                  className={`
                    p-2.5 rounded-lg transition-all flex items-center justify-center
                    ${activeTool === tool.id 
                      ? 'bg-primary text-primary-foreground shadow-md' 
                      : 'hover:bg-secondary text-foreground'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <tool.icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px]">
                <p className="font-medium">{tool.label}</p>
                <p className="text-xs text-muted-foreground">{tool.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
      
      {/* Active Tool Indicator */}
      {activeTool && (
        <div className="mt-2 glass-panel rounded-lg px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Active: <span className="font-medium text-primary">
              {tools.find(t => t.id === activeTool)?.label}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
