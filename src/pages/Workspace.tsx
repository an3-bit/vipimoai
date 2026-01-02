import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { useProject, useProjectPlots, useCreatePlots, useDeleteProjectPlots, useUpdateProject, useUpdatePlotStatus } from '@/hooks/useSurvey';
import { useLogActivity } from '@/hooks/useActivityLog';
import { useRiparianBuffer } from '@/hooks/useRiparianBuffer';
import { useCoPilot } from '@/hooks/useCoPilot';
import { useCoPilotRationale } from '@/hooks/useCoPilotRationale';
import { RiverDrawingTool } from '@/components/map/RiverDrawingTool';
import { ZoomToFitControl, ZoomToFitRef } from '@/components/map/ZoomToFitControl';
import { CoPilotLoadingOverlay } from '@/components/map/CoPilotLoadingOverlay';
import { ManualDraftingTools, DraftingTool } from '@/components/map/ManualDraftingTools';
import { PlotStatusCard, PlotStatus } from '@/components/workspace/PlotStatusCard';
import { ProjectCompletionModal } from '@/components/workspace/ProjectCompletionModal';
import { ActivityTimeline } from '@/components/workspace/ActivityTimeline';
import { WorkspaceTour } from '@/components/workspace/WorkspaceTour';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  ArrowLeft, Map, Layers, Mountain, Upload, AlertTriangle, Grid3X3, 
  FileText, Send, MessageSquare, ChevronDown, Loader2,
  Download, Settings, Waves, X, Save, CheckCircle, History, Maximize2, Route, HelpCircle
} from 'lucide-react';
import { generatePlotGrid, calculateSubdivisionStats, mockChatMessages, GeneratedPlot, AccessEdgeConfig } from '@/data/mockData';
import { MutationFormModal } from '@/components/workspace/MutationFormModal';
import { AccessRoadSelector, AccessEdge } from '@/components/map/AccessRoadSelector';
import { YieldComparisonBadge } from '@/components/map/YieldComparisonBadge';

// Chat message interface
interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export default function Workspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  // Fetch real project data
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);
  const { data: savedPlots, isLoading: plotsLoading, refetch: refetchPlots } = useProjectPlots(projectId);
  const createPlots = useCreatePlots();
  const deletePlots = useDeleteProjectPlots();
  const updateProject = useUpdateProject();
  const updatePlotStatus = useUpdatePlotStatus();
  const logActivity = useLogActivity();
  
  // Riparian buffer hook
  const riparian = useRiparianBuffer(30);
  
  // Activity timeline state
  const [showTimeline, setShowTimeline] = useState(false);
  
  // Plot status modal state
  const [selectedPlot, setSelectedPlot] = useState<{
    id: string;
    plotNumber: number;
    areaSqm: number;
    status: PlotStatus;
  } | null>(null);
  
  // Map state
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'topo'>('standard');
  
  // Feature toggles
  const [showHazardZone, setShowHazardZone] = useState(false);
  const [showPlotGrid, setShowPlotGrid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state with unit support
  const [plotSize, setPlotSize] = useState('50x100ft');
  const [inputUnit, setInputUnit] = useState<'FEET' | 'METERS'>('FEET');
  const [customWidth, setCustomWidth] = useState('50');
  const [customDepth, setCustomDepth] = useState('100');
  const [roadWidth, setRoadWidth] = useState('9');
  const [riparianBufferEnabled, setRiparianBufferEnabled] = useState(true);
  
  // Unit conversion constant
  const FEET_TO_METERS = 0.3048;
  
  // Helper to get dimensions in meters based on preset or custom
  const getDimensionsInMeters = useCallback(() => {
    switch (plotSize) {
      case '50x100ft':
        return { width: 50 * FEET_TO_METERS, depth: 100 * FEET_TO_METERS }; // 15.24m x 30.48m
      case '40x80ft':
        return { width: 40 * FEET_TO_METERS, depth: 80 * FEET_TO_METERS }; // 12.19m x 24.38m
      case '100x100ft':
        return { width: 100 * FEET_TO_METERS, depth: 100 * FEET_TO_METERS }; // 30.48m x 30.48m
      case 'custom':
        const w = parseFloat(customWidth) || 50;
        const d = parseFloat(customDepth) || 100;
        return {
          width: inputUnit === 'FEET' ? w * FEET_TO_METERS : w,
          depth: inputUnit === 'FEET' ? d * FEET_TO_METERS : d,
        };
      default:
        return { width: 15.24, depth: 30.48 };
    }
  }, [plotSize, customWidth, customDepth, inputUnit]);
  
  // Get display dimensions (what user sees)
  const getDisplayDimensions = useCallback(() => {
    switch (plotSize) {
      case '50x100ft':
        return { width: 50, depth: 100, unit: 'ft' };
      case '40x80ft':
        return { width: 40, depth: 80, unit: 'ft' };
      case '100x100ft':
        return { width: 100, depth: 100, unit: 'ft' };
      case 'custom':
        return { 
          width: parseFloat(customWidth) || 50, 
          depth: parseFloat(customDepth) || 100, 
          unit: inputUnit === 'FEET' ? 'ft' : 'm' 
        };
      default:
        return { width: 50, depth: 100, unit: 'ft' };
    }
  }, [plotSize, customWidth, customDepth, inputUnit]);
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [chatInput, setChatInput] = useState('');
  const [isCoPilotProcessing, setIsCoPilotProcessing] = useState(false);
  const [coPilotMessage, setCoPilotMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const zoomToFitRef = useRef<ZoomToFitRef>(null);
  
  // Mutation modal
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
  
  // Access Road Selector state
  const [accessEdges, setAccessEdges] = useState<AccessEdge[]>([]);
  const [accessRoadMode, setAccessRoadMode] = useState(false);
  const [baselinePlotCount, setBaselinePlotCount] = useState(0);
  const [showYieldComparison, setShowYieldComparison] = useState(false);
  
  // Manual Drafting Tools state
  const [activeDraftingTool, setActiveDraftingTool] = useState<DraftingTool>(null);
  
  // Workspace Tour state
  const [showTour, setShowTour] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(() => {
    return localStorage.getItem('vipimo_tour_completed') === 'true';
  });
  
  // CoPilot Rationale hook
  const { generateRationale } = useCoPilotRationale();

  // Get parcel coordinates from project
  const parcelCoordinates = project?.parcels?.[0]?.coordinates as { lat: number; lng: number }[] || [];
  
  // Calculate area
  const parcelAreaSqm = project?.parcels?.[0]?.area_sqm || 0;
  const totalAreaAcres = parcelAreaSqm / 4046.86;
  const totalAreaHa = parcelAreaSqm / 10000;

  // Load saved plots on mount
  useEffect(() => {
    if (savedPlots && savedPlots.length > 0) {
      const loadedPlots: GeneratedPlot[] = savedPlots.map((plot: any) => ({
        coordinates: plot.coordinates as { lat: number; lng: number }[],
        isValid: plot.status !== 'invalid',
        overlapPercent: 0,
      }));
      setPlotGrid(loadedPlots);
      setPlotCount(savedPlots.length);
      setShowPlotGrid(true);
      // Calculate real efficiency with road area
      const width = plotSize === 'custom' ? parseFloat(customWidth) : 15.24;
      const depth = plotSize === 'custom' ? parseFloat(customDepth) : 30.48;
      const road = parseFloat(roadWidth);
      const stats = calculateSubdivisionStats(parcelAreaSqm, loadedPlots, width, depth, road);
      setEfficiency(Math.round(stats.efficiency));
      setRoadAreaSqm(stats.roadAreaSqm);
    }
  }, [savedPlots, parcelAreaSqm, plotSize, customWidth, customDepth, roadWidth]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Check auth with proper listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        navigate('/auth');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Show tour for first-time users
  useEffect(() => {
    if (!hasSeenTour && !projectLoading && project) {
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour, projectLoading, project]);

  // Show riparian buffer when river is drawn
  useEffect(() => {
    if (riparian.hasBuffer) {
      setShowHazardZone(true);
    }
  }, [riparian.hasBuffer]);

  const handleRunHazardScan = () => {
    if (!riparian.hasRiver) {
      toast.info("Draw a river first using the 'Draw River' tool to run a hazard scan.");
      return;
    }
    
    setIsProcessing(true);
    setTimeout(() => {
      setShowHazardZone(true);
      setIsProcessing(false);
      
      const invalidCount = plotGrid.filter(p => !p.isValid).length;
      
      // Log activity
      if (projectId) {
        logActivity.mutate({
          projectId,
          actionType: 'hazard_scan',
          actionLabel: 'Hazard scan completed',
          details: { invalid_plots: invalidCount },
        });
      }
      
      if (invalidCount > 0) {
        toast.warning(`Hazard Scan Complete: ${invalidCount} plots overlap with riparian reserve. Affected areas highlighted in red.`);
      } else {
        toast.success("Hazard Scan Complete: No plots overlap with riparian reserve.");
      }
    }, 1000);
  };
  
  const handleAutoSubdivide = async () => {
    if (!projectId || parcelCoordinates.length === 0) {
      toast.error("No parcel coordinates available");
      return;
    }

    setIsProcessing(true);
    setShowYieldComparison(false);
    
    try {
      // Delete existing plots first
      if (savedPlots && savedPlots.length > 0) {
        await deletePlots.mutateAsync(projectId);
      }

      // Use the smart conversion helper (always outputs meters)
      const { width, depth } = getDimensionsInMeters();
      const road = parseFloat(roadWidth);
      
      // Convert AccessEdge[] to AccessEdgeConfig[]
      const accessEdgeConfigs: AccessEdgeConfig[] = accessEdges.map(e => ({
        edgeIndex: e.edgeIndex,
        roadWidth: e.roadWidth,
      }));
      
      // Generate plots with riparian collision detection and access edges
      const riparianBuffer = riparianBufferEnabled ? riparian.bufferPolygon : [];
      const plots = generatePlotGrid(parcelCoordinates, width, depth, road, riparianBuffer, accessEdgeConfigs);
      
      // Calculate stats with road area
      const stats = calculateSubdivisionStats(parcelAreaSqm, plots, width, depth, road);
      
      // If access edges are used, calculate baseline for comparison
      if (accessEdges.length > 0 && baselinePlotCount === 0) {
        // Calculate baseline without access edges
        const baselinePlots = generatePlotGrid(parcelCoordinates, width, depth, road, riparianBuffer, []);
        const baselineStats = calculateSubdivisionStats(parcelAreaSqm, baselinePlots, width, depth, road);
        setBaselinePlotCount(baselineStats.validCount);
      }
      
      setIsSaving(true);
      
      // Filter to only valid plots for saving
      const validPlots = plots.filter(p => p.isValid);
      
      // Prepare plots for database with 'available' status
      const plotsToSave = validPlots.map((plot, index) => ({
        plot_number: index + 1,
        coordinates: plot.coordinates,
        area_sqm: width * depth,
        status: 'available', // Default to available for new plots
      }));
      
      // Save to Supabase
      await createPlots.mutateAsync({
        projectId,
        plots: plotsToSave,
      });
      
      // Update local state with ALL plots (including invalid for display)
      setPlotGrid(plots);
      setPlotCount(stats.validCount);
      setInvalidPlotCount(stats.invalidCount);
      setEfficiency(Math.round(stats.efficiency));
      setRoadAreaSqm(stats.roadAreaSqm);
      setShowPlotGrid(true);
      
      // Show yield comparison if access edges are used
      if (accessEdges.length > 0 && baselinePlotCount > 0) {
        setShowYieldComparison(true);
        setTimeout(() => setShowYieldComparison(false), 5000); // Hide after 5 seconds
      }
      
      // Update project status
      await updateProject.mutateAsync({
        projectId,
        updates: { status: 'in_progress' },
      });
      
      // Log activity
      logActivity.mutate({
        projectId,
        actionType: 'subdivision_generated',
        actionLabel: `Generated ${stats.validCount} plots`,
        details: {
          plot_count: stats.validCount,
          invalid_count: stats.invalidCount,
          efficiency: `${Math.round(stats.efficiency)}%`,
          plot_size: `${width}m x ${depth}m`,
          access_edges: accessEdges.length,
        },
      });
      
      if (stats.invalidCount > 0) {
        toast.warning(`Generated ${stats.validCount} valid plots. ${stats.invalidCount} plots discarded (riparian overlap). Efficiency: ${Math.round(stats.efficiency)}%.`);
      } else {
        toast.success(`Success: ${stats.validCount} plots generated and saved. Yield Efficiency: ${Math.round(stats.efficiency)}%.`);
      }
      
      // Generate and return rationale for CoPilot
      const accessDirection = accessEdges.length > 0 ? accessEdges[0].label?.split(' ')[0] : undefined;
      const rationale = generateRationale({
        plotCount: stats.validCount,
        invalidCount: stats.invalidCount,
        efficiency: Math.round(stats.efficiency),
        roadWidthM: road,
        plotWidthM: width,
        plotDepthM: depth,
        hasRiparianBuffer: riparian.hasBuffer && riparianBufferEnabled,
        riparianBufferM: 30,
        accessEdgeDirection: accessDirection,
        accessEdgeCount: accessEdges.length,
      });
      
      return rationale;
      
      // Refetch to ensure sync
      refetchPlots();
    } catch (error: any) {
      toast.error("Failed to subdivide: " + error.message);
    } finally {
      setIsProcessing(false);
      setIsSaving(false);
    }
  };

  // Handle access edge toggle
  const handleAccessEdgeToggle = useCallback((edgeIndex: number, roadWidth?: number) => {
    setAccessEdges(prev => {
      const existing = prev.find(e => e.edgeIndex === edgeIndex);
      if (existing) {
        // Remove the edge
        return prev.filter(e => e.edgeIndex !== edgeIndex);
      } else if (roadWidth !== undefined) {
        // Add new edge
        const directions = ['South', 'East', 'North', 'West'];
        return [...prev, {
          edgeIndex,
          roadWidth,
          label: `${directions[edgeIndex]} Access (${roadWidth}m)`,
        }];
      }
      return prev;
    });
    // Reset baseline when edges change
    setBaselinePlotCount(0);
    setShowYieldComparison(false);
  }, []);

  // Clear plots function for CoPilot reset command
  const clearPlots = useCallback(async () => {
    if (!projectId) return;
    try {
      if (savedPlots && savedPlots.length > 0) {
        await deletePlots.mutateAsync(projectId);
      }
      setPlotGrid([]);
      setPlotCount(0);
      setInvalidPlotCount(0);
      setEfficiency(0);
      setRoadAreaSqm(0);
      setShowPlotGrid(false);
      riparian.clearRiver();
      setShowHazardZone(false);
      refetchPlots();
      toast.success('Map cleared successfully');
    } catch (error: any) {
      toast.error('Failed to clear plots: ' + error.message);
    }
  }, [projectId, savedPlots, deletePlots, riparian, refetchPlots]);

  // Handler for riparian filter via CoPilot
  const handleRiparianFilter = useCallback(() => {
    if (!riparian.hasBuffer) {
      toast.info("Draw a river first using the 'Draw River' tool to filter riparian zones.");
      return;
    }
    // Re-run subdivision with riparian filtering enabled
    setRiparianBufferEnabled(true);
    handleAutoSubdivide();
  }, [riparian.hasBuffer, handleAutoSubdivide]);

  // Initialize CoPilot hook
  const coPilot = useCoPilot({
    setRoadWidth,
    setPlotSize,
    setCustomWidth,
    setCustomDepth,
    handleAutoSubdivide,
    clearPlots,
    handleRiparianFilter: riparian.hasBuffer ? handleRiparianFilter : undefined,
  });

  const handleStartDrawRiver = () => {
    riparian.startDrawing();
    toast.info("Click on the map to draw river path. Press Enter or Escape to finish.");
  };

  const handleFinishDrawRiver = () => {
    riparian.stopDrawing();
    if (riparian.riverPoints.length >= 2) {
      toast.success(`River drawn with ${riparian.riverPoints.length} points. 30m buffer zone created.`);
      setShowHazardZone(true);
      
      // Log activity
      if (projectId) {
        logActivity.mutate({
          projectId,
          actionType: 'river_drawn',
          actionLabel: 'River line drawn',
          details: { points: riparian.riverPoints.length, buffer_m: 30 },
        });
      }
    } else {
      toast.warning("River needs at least 2 points.");
    }
  };

  // Zoom to fit handler
  const handleZoomToFit = useCallback(() => {
    zoomToFitRef.current?.fitBounds();
  }, []);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isCoPilotProcessing) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    const inputText = chatInput;
    setChatInput('');

    // Show loading overlay
    setIsCoPilotProcessing(true);
    setCoPilotMessage('Processing command...');

    try {
      // Execute the CoPilot command
      const result = await coPilot.executeCommand(inputText);
      
      // Add a small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update message based on result
      if (result.success && result.command.type !== 'unknown') {
        setCoPilotMessage(result.resultMessage);
        
        // Update the plot count in the message if subdivision was run
        let finalMessage = result.resultMessage;
        if (result.command.type === 'subdivide' || result.command.type === 'road_width' || result.command.type === 'plot_dimensions') {
          // Wait a moment for state to update
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        const aiMessage: ChatMessage = {
          role: 'ai',
          content: finalMessage,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, aiMessage]);
      } else {
        // Unknown command - provide help
        const aiMessage: ChatMessage = {
          role: 'ai',
          content: result.resultMessage,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, aiMessage]);
      }
    } catch (error: any) {
      const aiMessage: ChatMessage = {
        role: 'ai',
        content: `Error: ${error.message || 'Something went wrong'}`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiMessage]);
    } finally {
      setIsCoPilotProcessing(false);
      setCoPilotMessage('');
    }
  };

  const getTileUrl = () => {
    switch (mapLayer) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'topo':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  if (projectLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Project not found or access denied</p>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Full-screen Map */}
      <MapContainer
        center={[-1.115, 37.117]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          key={mapLayer}
          attribution='&copy; OpenStreetMap contributors'
          url={getTileUrl()}
        />
        {parcelCoordinates.length > 0 && (
          <ZoomToFitControl ref={zoomToFitRef} coordinates={parcelCoordinates} />
        )}
        
        {/* River Drawing Tool */}
        <RiverDrawingTool
          isDrawing={riparian.isDrawingRiver}
          riverPoints={riparian.riverPoints}
          onPointAdd={riparian.addRiverPoint}
          onDrawingComplete={handleFinishDrawRiver}
        />
        
        {/* Parent Parcel Boundary */}
        {parcelCoordinates.length > 0 && (
          <Polygon
            positions={parcelCoordinates.map(c => [c.lat, c.lng] as [number, number])}
            pathOptions={{
              color: 'hsl(160, 84%, 39%)',
              weight: 3,
              fillColor: 'hsl(160, 84%, 39%)',
              fillOpacity: 0.1,
              dashArray: '10, 5',
            }}
          />
        )}
        
        {/* Access Road Selector - Interactive boundary line selection */}
        {parcelCoordinates.length > 0 && (
          <AccessRoadSelector
            parcelCoordinates={parcelCoordinates}
            accessEdges={accessEdges}
            onAccessEdgeToggle={handleAccessEdgeToggle}
            enabled={accessRoadMode}
          />
        )}
        
        {/* Riparian Buffer Zone (30m from river) */}
        {showHazardZone && riparian.bufferPolygon.length > 0 && (
          <Polygon
            positions={riparian.bufferPolygon.map(c => [c.lat, c.lng] as [number, number])}
            pathOptions={{
              color: 'hsl(0, 72%, 51%)',
              weight: 2,
              fillColor: 'hsl(0, 72%, 51%)',
              fillOpacity: 0.35,
              dashArray: '8, 4',
            }}
          >
            <Popup>
              <div className="text-center">
                <p className="font-semibold text-destructive">Riparian Reserve</p>
                <p className="text-sm text-muted-foreground">30m buffer zone - No development</p>
              </div>
            </Popup>
          </Polygon>
        )}
        
        {/* River Line (drawn) */}
        {!riparian.isDrawingRiver && riparian.riverPoints.length >= 2 && (
          <Polyline
            positions={riparian.riverPoints.map(p => [p.lat, p.lng] as [number, number])}
            pathOptions={{
              color: 'hsl(210, 100%, 50%)',
              weight: 4,
              opacity: 0.9,
            }}
          />
        )}
        
        {/* Plot Grid - Clickable with Status Colors */}
        {showPlotGrid && savedPlots && savedPlots.map((plot: any, index: number) => {
          const plotStatus = (plot.status === 'available' || plot.status === 'reserved' || plot.status === 'sold') 
            ? plot.status 
            : 'available';
          
          // Status-based colors
          const getPlotColor = (status: string) => {
            switch (status) {
              case 'sold': return 'hsl(0, 72%, 51%)'; // Red
              case 'reserved': return 'hsl(38, 92%, 50%)'; // Amber
              case 'available': 
              default: return 'hsl(152, 69%, 40%)'; // Green
            }
          };
          
          const color = getPlotColor(plotStatus);
          const coords = plot.coordinates as { lat: number; lng: number }[];
          
          return (
            <Polygon
              key={plot.id}
              positions={coords.map(c => [c.lat, c.lng] as [number, number])}
              pathOptions={{
                color: color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.4,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedPlot({
                    id: plot.id,
                    plotNumber: plot.plot_number,
                    areaSqm: plot.area_sqm,
                    status: plotStatus as PlotStatus,
                  });
                },
              }}
            >
              <Popup>
                <div className="text-center">
                  <p className="font-semibold">Plot {plot.plot_number}</p>
                  <p className="text-xs text-muted-foreground">{plot.area_sqm.toFixed(0)} m²</p>
                  <p className={`text-xs font-medium mt-1 ${
                    plotStatus === 'sold' ? 'text-rose-500' :
                    plotStatus === 'reserved' ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                    {plotStatus.charAt(0).toUpperCase() + plotStatus.slice(1)}
                  </p>
                </div>
              </Popup>
            </Polygon>
          );
        })}
        
        {/* Also show invalid plots (riparian overlap) in red if generated but not saved */}
        {showPlotGrid && plotGrid.filter(p => !p.isValid).map((plot, index) => (
          <Polygon
            key={`invalid-${index}`}
            positions={plot.coordinates.map(c => [c.lat, c.lng] as [number, number])}
            pathOptions={{
              color: 'hsl(0, 72%, 51%)',
              weight: 1.5,
              fillColor: 'hsl(0, 72%, 51%)',
              fillOpacity: 0.5,
              dashArray: '4, 4',
            }}
          >
            <Popup>
              <div className="text-center">
                <p className="font-semibold text-destructive">INVALID</p>
                <p className="text-xs text-destructive">Riparian overlap: {plot.overlapPercent.toFixed(1)}%</p>
              </div>
            </Popup>
          </Polygon>
        ))}
      </MapContainer>

      {/* CoPilot Loading Overlay */}
      <CoPilotLoadingOverlay visible={isCoPilotProcessing} message={coPilotMessage} />
      
      {/* Yield Comparison Badge */}
      <YieldComparisonBadge 
        beforeCount={baselinePlotCount} 
        afterCount={plotCount} 
        visible={showYieldComparison && accessEdges.length > 0} 
      />
      
      {/* Manual Drafting Tools Palette */}
      <ManualDraftingTools
        activeTool={activeDraftingTool}
        onToolChange={setActiveDraftingTool}
        disabled={isProcessing}
      />
      
      {/* Workspace Tour */}
      <WorkspaceTour
        run={showTour}
        onComplete={() => {
          setShowTour(false);
          setHasSeenTour(true);
          localStorage.setItem('vipimo_tour_completed', 'true');
        }}
      />
      
      {/* Access Road Mode Indicator */}
      {accessRoadMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="glass-panel rounded-lg px-4 py-2 flex items-center gap-3 bg-amber-500/90 text-white">
            <Route className="h-4 w-4" />
            <span className="text-sm font-medium">Click a boundary edge to mark as existing Access Road</span>
            <button 
              onClick={() => setAccessRoadMode(false)}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      
      {riparian.isDrawingRiver && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="glass-panel rounded-lg px-4 py-2 flex items-center gap-3 bg-primary/90 text-primary-foreground">
            <Waves className="h-4 w-4" />
            <span className="text-sm font-medium">Drawing River - Click to add points, Enter to finish</span>
            <button 
              onClick={handleFinishDrawRiver}
              className="p-1 hover:bg-primary-foreground/20 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Saving Indicator */}
      {isSaving && (
        <div className="absolute top-4 right-20 z-[1000]">
          <div className="glass-panel rounded-lg px-4 py-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm">Saving...</span>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="glass-panel p-3 rounded-lg hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="glass-panel rounded-lg px-4 py-2">
          <p className="font-semibold">{project.name}</p>
          <p className="text-xs text-muted-foreground">
            {totalAreaHa.toFixed(2)} Ha / {totalAreaAcres.toFixed(1)} Acres
            {(project as any).location_name && ` • ${(project as any).location_name}`}
          </p>
        </div>
      </div>

      {/* Layer Toggle (Top Right) */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
      {/* Activity Timeline Toggle */}
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className={`floating-control p-2 rounded transition-colors ${showTimeline ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
          title="Activity Timeline"
        >
          <History className="h-4 w-4" />
        </button>
        
        {/* Help / Tour Button */}
        <button
          onClick={() => setShowTour(true)}
          className="floating-control p-2 rounded transition-colors hover:bg-secondary"
          title="Show Tour"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        
        {/* Zoom to Fit Button */}
        <button
          onClick={handleZoomToFit}
          className="floating-control p-2 rounded transition-colors hover:bg-secondary"
          title="Zoom to Fit"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        
        <div className="floating-control flex flex-col gap-1">
          <button
            onClick={() => setMapLayer('standard')}
            className={`p-2 rounded transition-colors ${mapLayer === 'standard' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
            title="Standard Map"
          >
            <Map className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMapLayer('satellite')}
            className={`p-2 rounded transition-colors ${mapLayer === 'satellite' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
            title="Satellite View"
          >
            <Layers className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMapLayer('topo')}
            className={`p-2 rounded transition-colors ${mapLayer === 'topo' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
            title="Topographic"
          >
            <Mountain className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Activity Timeline Panel */}
      {showTimeline && (
        <div className="absolute top-16 right-4 z-[1000] w-80">
          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Activity Timeline
              </h3>
              <button 
                onClick={() => setShowTimeline(false)}
                className="p-1 hover:bg-secondary rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <ActivityTimeline projectId={projectId || ''} />
            </div>
          </div>
        </div>
      )}

      {/* Floating Command Center (Left Panel) */}
      <div className="absolute bottom-4 left-4 z-[1000] w-80">
        <div className="glass-panel rounded-xl overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-border/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Subdivision Parameters
            </h3>
          </div>
          
          {/* Form */}
          <div className="p-4 space-y-4">
            {/* Plot Size Preset */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Plot Size Target</Label>
              <Select value={plotSize} onValueChange={(v) => {
                setPlotSize(v);
                // Reset to feet for presets
                if (v !== 'custom') setInputUnit('FEET');
              }}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50x100ft">50 × 100 ft (Standard)</SelectItem>
                  <SelectItem value="40x80ft">40 × 80 ft (Compact)</SelectItem>
                  <SelectItem value="100x100ft">100 × 100 ft (Quarter Acre)</SelectItem>
                  <SelectItem value="custom">Custom Dimensions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Dimensions with Unit Toggle */}
            {plotSize === 'custom' && (
              <div className="space-y-3">
                {/* Unit Toggle */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Unit:</Label>
                  <div className="flex rounded-md border border-border/50 overflow-hidden">
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        inputUnit === 'FEET' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-secondary/50 hover:bg-secondary'
                      }`}
                      onClick={() => setInputUnit('FEET')}
                    >
                      Feet
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        inputUnit === 'METERS' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-secondary/50 hover:bg-secondary'
                      }`}
                      onClick={() => setInputUnit('METERS')}
                    >
                      Meters
                    </button>
                  </div>
                </div>
                
                {/* Width & Depth Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Width ({inputUnit === 'FEET' ? 'ft' : 'm'})
                    </Label>
                    <Input 
                      type="number"
                      value={customWidth} 
                      onChange={(e) => setCustomWidth(e.target.value)}
                      className="bg-secondary/50"
                      placeholder={inputUnit === 'FEET' ? '50' : '15.24'}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Depth ({inputUnit === 'FEET' ? 'ft' : 'm'})
                    </Label>
                    <Input 
                      type="number"
                      value={customDepth} 
                      onChange={(e) => setCustomDepth(e.target.value)}
                      className="bg-secondary/50"
                      placeholder={inputUnit === 'FEET' ? '100' : '30.48'}
                    />
                  </div>
                </div>
                
                {/* Conversion Preview */}
                <p className="text-xs text-muted-foreground">
                  {inputUnit === 'FEET' ? (
                    <>≈ {((parseFloat(customWidth) || 0) * FEET_TO_METERS).toFixed(2)}m × {((parseFloat(customDepth) || 0) * FEET_TO_METERS).toFixed(2)}m</>
                  ) : (
                    <>≈ {((parseFloat(customWidth) || 0) / FEET_TO_METERS).toFixed(1)}ft × {((parseFloat(customDepth) || 0) / FEET_TO_METERS).toFixed(1)}ft</>
                  )}
                </p>
              </div>
            )}
            
            {/* Plot Area Display for Presets */}
            {plotSize !== 'custom' && (
              <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Plot Area: {(() => {
                    const dims = getDimensionsInMeters();
                    const areaSqm = dims.width * dims.depth;
                    const areaHa = areaSqm / 10000;
                    return `${areaSqm.toFixed(0)} m² (${areaHa.toFixed(3)} Ha)`;
                  })()}
                </p>
              </div>
            )}

            {/* Road Width */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Road Width (m)</Label>
              <Input 
                value={roadWidth} 
                onChange={(e) => setRoadWidth(e.target.value)}
                className="bg-secondary/50"
              />
            </div>

            {/* Riparian Buffer Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Riparian Buffer</Label>
                <p className="text-xs text-muted-foreground">
                  {riparian.hasRiver ? 'River drawn (30m buffer active)' : 'Draw river to enable'}
                </p>
              </div>
              <Switch 
                checked={riparianBufferEnabled} 
                onCheckedChange={setRiparianBufferEnabled}
                disabled={!riparian.hasRiver}
              />
            </div>

            {/* River Info */}
            {riparian.hasRiver && (
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-400">River: {riparian.riverPoints.length} points</span>
                  <button 
                    onClick={riparian.clearRiver}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Stats */}
            {showPlotGrid && (
              <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valid Plots:</span>
                  <span className="font-mono font-semibold text-primary">{plotCount}</span>
                </div>
                {invalidPlotCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Invalid (Riparian):</span>
                    <span className="font-mono font-semibold text-destructive">{invalidPlotCount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Road Surrender:</span>
                  <span className="font-mono font-semibold text-muted-foreground">
                    {(roadAreaSqm / 10000).toFixed(4)} Ha
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Yield Efficiency:</span>
                  <span className={`font-mono font-semibold ${
                    efficiency >= 70 ? 'text-primary' : 
                    efficiency >= 50 ? 'text-amber-500' : 'text-destructive'
                  }`}>
                    {efficiency}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-mono font-semibold text-success">Saved ✓</span>
                </div>
                
                {/* Plot Status Legend */}
                <div className="pt-2 border-t border-border/50 mt-2">
                  <p className="text-xs text-muted-foreground mb-2">Plot Status (tap to change):</p>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-emerald-500"></div>
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-amber-500"></div>
                      <span>Reserved</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-rose-500"></div>
                      <span>Sold</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tool Toolbar (Bottom Center) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="glass-panel rounded-xl p-2 flex items-center gap-2">
          {/* Import Data */}
          <button 
            className="tool-btn"
            title="Import Field Data (.CSV, .DXF)"
          >
            <Upload className="h-5 w-5" />
          </button>
          
          {/* Draw River */}
          <button 
            className={`tool-btn ${riparian.isDrawingRiver ? 'active' : ''}`}
            onClick={riparian.isDrawingRiver ? handleFinishDrawRiver : handleStartDrawRiver}
            title={riparian.isDrawingRiver ? "Finish Drawing" : "Draw River"}
          >
            <Waves className="h-5 w-5" />
          </button>
          
          {/* Access Road Selector */}
          <button 
            className={`tool-btn ${accessRoadMode ? 'active' : ''} ${accessEdges.length > 0 ? 'text-emerald-500' : ''}`}
            onClick={() => setAccessRoadMode(!accessRoadMode)}
            title={accessEdges.length > 0 ? `Access Roads: ${accessEdges.length} selected` : "Mark Access Roads"}
          >
            <Route className="h-5 w-5" />
          </button>
          
          {/* Hazard Scan */}
          <button 
            className={`tool-btn ${showHazardZone ? 'active' : ''}`}
            onClick={handleRunHazardScan}
            disabled={isProcessing}
            title="Run Hazard Scan"
          >
            {isProcessing && !isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </button>
          
          {/* Auto Subdivide */}
          <button 
            className={`tool-btn ${showPlotGrid ? 'active' : ''}`}
            onClick={handleAutoSubdivide}
            disabled={isProcessing || parcelCoordinates.length === 0}
            title="Auto-Subdivide"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Grid3X3 className="h-5 w-5" />
            )}
          </button>
          
          <div className="w-px h-8 bg-border mx-1" />
          
          {/* Save Button */}
          <button 
            className={`tool-btn ${isSaving ? '' : 'hover:text-success'}`}
            onClick={async () => {
              if (!projectId) return;
              setIsSaving(true);
              try {
                await updateProject.mutateAsync({
                  projectId,
                  updates: { status: 'in_progress' },
                });
                toast.success('Project saved successfully');
              } catch (error) {
                toast.error('Failed to save project');
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            title="Save Project"
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
          </button>
          
          {/* Generate Mutation */}
          <button 
            className="tool-btn"
            onClick={() => setMutationModalOpen(true)}
            title="Generate Mutation Form"
            disabled={plotCount === 0}
          >
            <FileText className="h-5 w-5" />
          </button>
          
          {/* Download */}
          <button 
            className="tool-btn"
            title="Export Data"
            onClick={() => setHasExported(true)}
          >
            <Download className="h-5 w-5" />
          </button>
          
          <div className="w-px h-8 bg-border mx-1" />
          
          {/* Complete Project */}
          <button 
            className={`tool-btn ${project?.status === 'completed' ? 'text-success' : 'hover:text-success'}`}
            onClick={() => setCompletionModalOpen(true)}
            title={project?.status === 'completed' ? 'Project Completed' : 'Complete Project'}
            disabled={plotCount === 0}
          >
            <CheckCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Chat Interface (Bottom Right) */}
      <div className="absolute bottom-4 right-4 z-[1000]">
        {/* Chat Panel */}
        <div className={`transition-all duration-300 ${chatOpen ? 'mb-2' : 'h-0 overflow-hidden'}`}>
          <div className="glass-panel rounded-xl w-80 overflow-hidden">
            {/* Chat Header */}
            <div className="p-3 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Vipimo Co-Pilot</p>
                  <p className="text-xs text-muted-foreground">AI Assistant</p>
                </div>
              </div>
              <button 
                onClick={() => setChatOpen(false)}
                className="p-1 hover:bg-secondary rounded"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="h-64 p-3">
              <div className="space-y-3">
                {chatMessages.map((msg, index) => (
                  <div 
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <form onSubmit={handleChatSubmit} className="p-3 border-t border-border/50">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask Vipimo..."
                  className="bg-secondary/50 text-sm"
                />
                <Button type="submit" size="icon" className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Chat Toggle Button */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="glass-panel rounded-full p-4 hover:bg-secondary/80 transition-colors shadow-glow"
          >
            <MessageSquare className="h-6 w-6 text-primary" />
          </button>
        )}
      </div>

      {/* Mutation Form Modal */}
      <MutationFormModal 
        open={mutationModalOpen} 
        onOpenChange={(open) => {
          setMutationModalOpen(open);
          if (!open) setHasExported(true); // Assume they exported when closing
        }}
        projectId={projectId || ''}
        projectName={project.name}
      />
      
      {/* Project Completion Modal */}
      <ProjectCompletionModal
        open={completionModalOpen}
        onOpenChange={setCompletionModalOpen}
        projectName={project.name}
        plotCount={plotCount}
        invalidPlotCount={invalidPlotCount}
        hasExported={hasExported}
        isCompleting={isCompleting}
        onComplete={async () => {
          if (!projectId) return;
          setIsCompleting(true);
          try {
            await updateProject.mutateAsync({
              projectId,
              updates: { status: 'completed' },
            });
            logActivity.mutate({
              projectId,
              actionType: 'project_completed',
              actionLabel: 'Project marked as complete',
              details: { plot_count: plotCount },
            });
            toast.success('Project marked as complete!');
          } finally {
            setIsCompleting(false);
          }
        }}
        onArchive={async () => {
          if (!projectId) return;
          try {
            await updateProject.mutateAsync({
              projectId,
              updates: { status: 'archived' },
            });
            logActivity.mutate({
              projectId,
              actionType: 'project_archived',
              actionLabel: 'Project archived',
            });
            toast.success('Project archived');
            navigate('/');
          } catch (error) {
            toast.error('Failed to archive project');
          }
        }}
      />
      
      {/* Plot Status Card (Mobile-friendly) */}
      <PlotStatusCard
        open={!!selectedPlot}
        onOpenChange={(open) => !open && setSelectedPlot(null)}
        plotNumber={selectedPlot?.plotNumber || 0}
        areaSqm={selectedPlot?.areaSqm || 0}
        currentStatus={selectedPlot?.status || 'available'}
        isUpdating={updatePlotStatus.isPending}
        onStatusChange={(newStatus) => {
          if (selectedPlot && projectId) {
            updatePlotStatus.mutate({
              plotId: selectedPlot.id,
              status: newStatus,
              projectId,
            }, {
              onSuccess: () => {
                logActivity.mutate({
                  projectId,
                  actionType: 'plot_status_changed',
                  actionLabel: `Plot ${selectedPlot.plotNumber} marked as ${newStatus}`,
                  details: { plot_number: selectedPlot.plotNumber, status: newStatus },
                });
                setSelectedPlot(null);
              },
            });
          }
        }}
      />
    </div>
  );
}
