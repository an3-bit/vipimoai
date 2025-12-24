import { useCallback } from 'react';

export interface CoPilotCommand {
  type: 'road_width' | 'plot_dimensions' | 'subdivide' | 'reset' | 'unknown';
  value?: number;
  width?: number;
  height?: number;
  message: string;
}

interface CoPilotHandlers {
  setRoadWidth: (width: string) => void;
  setPlotSize: (size: string) => void;
  setCustomWidth: (width: string) => void;
  setCustomDepth: (depth: string) => void;
  handleAutoSubdivide: () => Promise<void>;
  clearPlots: () => void;
}

export function useCoPilot(handlers: CoPilotHandlers) {
  const parseCommand = useCallback((input: string): CoPilotCommand => {
    const lowerInput = input.toLowerCase().trim();
    
    // Road width commands: "reduce roads to 6m", "set road width to 9 meters", "make roads 12m"
    const roadWidthMatch = lowerInput.match(/(?:reduce|set|make|change)\s*(?:road(?:s)?(?:\s*width)?)\s*(?:to|=)?\s*(\d+(?:\.\d+)?)\s*(?:m(?:eters?)?)?/i);
    if (roadWidthMatch) {
      const width = parseFloat(roadWidthMatch[1]);
      return {
        type: 'road_width',
        value: width,
        message: `Road width updated to ${width}m. Grid regenerating...`
      };
    }
    
    // Alternative road patterns: "roads 6m", "6m roads"
    const altRoadMatch = lowerInput.match(/(?:road(?:s)?\s+(\d+(?:\.\d+)?)\s*m)|(?:(\d+(?:\.\d+)?)\s*m\s*road(?:s)?)/i);
    if (altRoadMatch) {
      const width = parseFloat(altRoadMatch[1] || altRoadMatch[2]);
      return {
        type: 'road_width',
        value: width,
        message: `Road width updated to ${width}m. Grid regenerating...`
      };
    }
    
    // Plot dimensions: "change plots to 50x100", "set plot size 40x80", "plots 30x60"
    const plotDimMatch = lowerInput.match(/(?:change|set|make)?\s*(?:plot(?:s)?(?:\s*size)?(?:\s*to)?)\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
    if (plotDimMatch) {
      const width = parseFloat(plotDimMatch[1]);
      const height = parseFloat(plotDimMatch[2]);
      return {
        type: 'plot_dimensions',
        width,
        height,
        message: `Plot dimensions set to ${width}m x ${height}m. Recalculating yield...`
      };
    }
    
    // Alternative plot patterns: "50x100 plots", "50 by 100"
    const altPlotMatch = lowerInput.match(/(\d+(?:\.\d+)?)\s*(?:[x×]|by)\s*(\d+(?:\.\d+)?)\s*(?:plot(?:s)?|m)?/i);
    if (altPlotMatch && !lowerInput.includes('road')) {
      const width = parseFloat(altPlotMatch[1]);
      const height = parseFloat(altPlotMatch[2]);
      return {
        type: 'plot_dimensions',
        width,
        height,
        message: `Plot dimensions set to ${width}m x ${height}m. Recalculating yield...`
      };
    }
    
    // Subdivide commands: "run subdivision", "subdivide now", "generate plots", "auto subdivide"
    if (/(?:run|start|execute|do|trigger|perform)\s*(?:subdivision|subdivide|auto.?subdivide)/i.test(lowerInput) ||
        /(?:subdivide|generate\s*plots|auto.?subdivide)\s*(?:now|please)?/i.test(lowerInput)) {
      return {
        type: 'subdivide',
        message: 'Running subdivision...'
      };
    }
    
    // Reset/Clear commands: "clear map", "reset project", "clear plots", "start over"
    if (/(?:clear|reset|remove|delete)\s*(?:map|project|plots|all|grid|everything)/i.test(lowerInput) ||
        /start\s*over/i.test(lowerInput)) {
      return {
        type: 'reset',
        message: 'Clearing map and resetting subdivision...'
      };
    }
    
    return {
      type: 'unknown',
      message: "I didn't understand that command. Try:\n• \"Set roads to 6m\"\n• \"Change plots to 50x100\"\n• \"Run subdivision\"\n• \"Clear map\""
    };
  }, []);

  const executeCommand = useCallback(async (input: string): Promise<{ command: CoPilotCommand; success: boolean; resultMessage: string }> => {
    const command = parseCommand(input);
    
    try {
      switch (command.type) {
        case 'road_width':
          if (command.value !== undefined) {
            handlers.setRoadWidth(command.value.toString());
            // Trigger subdivision after a brief delay to allow state update
            await new Promise(resolve => setTimeout(resolve, 100));
            await handlers.handleAutoSubdivide();
            return {
              command,
              success: true,
              resultMessage: `Road width updated to ${command.value}m. Grid regenerated.`
            };
          }
          break;
          
        case 'plot_dimensions':
          if (command.width !== undefined && command.height !== undefined) {
            handlers.setPlotSize('custom');
            handlers.setCustomWidth(command.width.toString());
            handlers.setCustomDepth(command.height.toString());
            // Trigger subdivision after a brief delay
            await new Promise(resolve => setTimeout(resolve, 100));
            await handlers.handleAutoSubdivide();
            return {
              command,
              success: true,
              resultMessage: `Plot dimensions set to ${command.width}m x ${command.height}m. Grid regenerated.`
            };
          }
          break;
          
        case 'subdivide':
          await handlers.handleAutoSubdivide();
          return {
            command,
            success: true,
            resultMessage: 'Subdivision complete.'
          };
          
        case 'reset':
          handlers.clearPlots();
          return {
            command,
            success: true,
            resultMessage: 'Map cleared and subdivision reset.'
          };
          
        case 'unknown':
        default:
          return {
            command,
            success: false,
            resultMessage: command.message
          };
      }
    } catch (error: any) {
      return {
        command,
        success: false,
        resultMessage: `Error: ${error.message || 'Command failed'}`
      };
    }
    
    return {
      command,
      success: false,
      resultMessage: 'Command could not be executed.'
    };
  }, [parseCommand, handlers]);

  return {
    parseCommand,
    executeCommand,
  };
}
