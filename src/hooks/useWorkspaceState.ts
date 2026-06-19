import { useState, useCallback, useRef, useEffect } from 'react';
import { useProject, useProjectPlots, useCreatePlots, useDeleteProjectPlots, useUpdateProject, useUpdatePlotStatus } from '@/hooks/useSurvey';
import { useRiparianBuffer } from '@/hooks/useRiparianBuffer';
import { useCoPilot } from '@/hooks/useCoPilot';
import { generatePlotGrid, calculateSubdivisionStats, mockChatMessages, GeneratedPlot, AccessEdgeConfig } from '@/data/mockData';
import { Coordinate } from '@/types/survey';
import { toast } from 'sonner';
import { ZoomToFitRef } from '@/components/map/ZoomToFitControl';
import { DraftingTool } from '@/components/map/ManualDraftingTools';

export interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

export interface UseWorkspaceStateProps {
  projectId?: string;
}

export function useWorkspaceState({ projectId }: UseWorkspaceStateProps) {
  // Data fetching
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);
  const { data: savedPlots, isLoading: plotsLoading, refetch: refetchPlots } = useProjectPlots(projectId);
  const createPlots = useCreatePlots();
  const deletePlots = useDeleteProjectPlots();
  const updateProject = useUpdateProject();
  const updatePlotStatus = useUpdatePlotStatus();
  
  // Riparian buffer
  const riparian = useRiparianBuffer(30);
  
  // Map state
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'topo'>('standard');
  
  // Feature toggles
  const [showHazardZone, setShowHazardZone] = useState(false);
  const [showPlotGrid, setShowPlotGrid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [plotSize, setPlotSize] = useState('50x100ft');
  const [inputUnit, setInputUnit] = useState<'FEET' | 'METERS' | 'ACRES' | 'HECTARES'>('FEET');
  const [customWidth, setCustomWidth] = useState('50');
  const [customDepth, setCustomDepth] = useState('100');
  const [roadWidth, setRoadWidth] = useState('9');
  const [riparianBufferEnabled, setRiparianBufferEnabled] = useState(true);
  const [areaQueue, setAreaQueue] = useState<{ value: number; unit: 'ACRES' | 'HECTARES' }[]>([]);
  
  // Parcel data
  const [parcelCoordinates, setParcelCoordinates] = useState<Coordinate[]>([]);
  
  // Load parcel coordinates from project
  useEffect(() => {
    if (project?.parcels && project.parcels.length > 0) {
      const parcel = project.parcels[0];
      if (parcel.coordinates && Array.isArray(parcel.coordinates)) {
        setParcelCoordinates(parcel.coordinates);
      }
    }
  }, [project]);
  
  // Access roads
  const [accessRoadMode, setAccessRoadMode] = useState(false);
  const [accessEdges, setAccessEdges] = useState<AccessEdgeConfig[]>([]);
  
  // Frontage edge selection
  const [frontageEdgeSelectorEnabled, setFrontageEdgeSelectorEnabled] = useState(false);
  const [selectedFrontageEdge, setSelectedFrontageEdge] = useState<{ startIndex: number; endIndex: number } | null>(null);
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [chatInput, setChatInput] = useState('');
  const [isCoPilotProcessing, setIsCoPilotProcessing] = useState(false);
  const [coPilotMessage, setCoPilotMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Modals
  const [mutationModalOpen, setMutationModalOpen] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [hasExported, setHasExported] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  // Generated data
  const [plotGrid, setPlotGrid] = useState<GeneratedPlot[]>([]);
  const [plotCount, setPlotCount] = useState(0);
  const [invalidPlotCount, setInvalidPlotCount] = useState(0);
  const [efficiency, setEfficiency] = useState(0);
  const [roadAreaSqm, setRoadAreaSqm] = useState(0);
  const [baselinePlotCount, setBaselinePlotCount] = useState(0);
  const [showYieldComparison, setShowYieldComparison] = useState(false);
  
  // Drafting
  const [activeDraftingTool, setActiveDraftingTool] = useState<DraftingTool>(null);
  
  // UI state
  const [showTour, setShowTour] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(localStorage.getItem('vipimo_tour_completed') === 'true');
  const [showTimeline, setShowTimeline] = useState(false);
  
  // Computed values
  const totalAreaHa = parcelCoordinates.length > 2
    ? (() => {
        let area = 0;
        for (let i = 0; i < parcelCoordinates.length; i++) {
          const j = (i + 1) % parcelCoordinates.length;
          area += parcelCoordinates[i].lng * parcelCoordinates[j].lat;
          area -= parcelCoordinates[j].lng * parcelCoordinates[i].lat;
        }
        area = Math.abs(area) / 2;
        return area * 111000 * 111000 * Math.cos(parcelCoordinates[0].lat * Math.PI / 180) / 10000;
      })()
    : 0;
  const totalAreaAcres = totalAreaHa * 2.471;
  
  // Zoom to fit ref
  const zoomToFitRef = useRef<ZoomToFitRef>(null);
  
  return {
    // Data
    project,
    projectLoading,
    projectError,
    savedPlots,
    
    // State setters
    setMapLayer,
    setShowHazardZone,
    setShowPlotGrid,
    setIsProcessing,
    setIsSaving,
    setPlotSize,
    setInputUnit,
    setCustomWidth,
    setCustomDepth,
    setRoadWidth,
    setRiparianBufferEnabled,
    setAreaQueue,
    setParcelCoordinates,
    setAccessRoadMode,
    setAccessEdges,
    setChatOpen,
    setChatMessages,
    setChatInput,
    setIsCoPilotProcessing,
    setCoPilotMessage,
    setMutationModalOpen,
    setCompletionModalOpen,
    setHasExported,
    setIsCompleting,
    setPlotGrid,
    setPlotCount,
    setInvalidPlotCount,
    setEfficiency,
    setRoadAreaSqm,
    setBaselinePlotCount,
    setShowYieldComparison,
    setActiveDraftingTool,
    setShowTour,
    setHasSeenTour,
    setShowTimeline,
    
    // State values
    mapLayer,
    showHazardZone,
    showPlotGrid,
    isProcessing,
    isSaving,
    plotSize,
    inputUnit,
    customWidth,
    customDepth,
    roadWidth,
    riparianBufferEnabled,
    areaQueue,
    parcelCoordinates,
    accessRoadMode,
    accessEdges,
    frontageEdgeSelectorEnabled,
    selectedFrontageEdge,
    setFrontageEdgeSelectorEnabled,
    setSelectedFrontageEdge,
    chatOpen,
    chatMessages,
    chatInput,
    isCoPilotProcessing,
    coPilotMessage,
    mutationModalOpen,
    completionModalOpen,
    hasExported,
    isCompleting,
    plotGrid,
    plotCount,
    invalidPlotCount,
    efficiency,
    roadAreaSqm,
    baselinePlotCount,
    showYieldComparison,
    activeDraftingTool,
    showTour,
    hasSeenTour,
    showTimeline,
    
    // Computed
    totalAreaHa,
    totalAreaAcres,
    
    // Hooks
    riparian,
    refetchPlots,
    createPlots,
    deletePlots,
    updateProject,
    updatePlotStatus,
    
    // Refs
    chatEndRef,
    zoomToFitRef,
  };
}
