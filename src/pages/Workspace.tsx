import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, useMap, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { useProject, useProjectPlots, useCreatePlots, useDeleteProjectPlots, useUpdateProject } from '@/hooks/useSurvey';
import { useRiparianBuffer } from '@/hooks/useRiparianBuffer';
import { RiverDrawingTool } from '@/components/map/RiverDrawingTool';
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
  Download, Settings, Waves, X
} from 'lucide-react';
import { generatePlotGrid, calculateSubdivisionStats, mockChatMessages, GeneratedPlot } from '@/data/mockData';
import { MutationFormModal } from '@/components/workspace/MutationFormModal';

// Map controller component
function MapController({ coordinates }: { coordinates: { lat: number; lng: number }[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates.map(c => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [100, 100] });
    }
  }, [coordinates, map]);
  
  return null;
}

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
  
  // Riparian buffer hook
  const riparian = useRiparianBuffer(30);
  
  // Map state
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'topo'>('standard');
  
  // Feature toggles
  const [showHazardZone, setShowHazardZone] = useState(false);
  const [showPlotGrid, setShowPlotGrid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [plotSize, setPlotSize] = useState('50x100');
  const [customWidth, setCustomWidth] = useState('15.24');
  const [customDepth, setCustomDepth] = useState('30.48');
  const [roadWidth, setRoadWidth] = useState('9');
  const [riparianBufferEnabled, setRiparianBufferEnabled] = useState(true);
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Mutation modal
  const [mutationModalOpen, setMutationModalOpen] = useState(false);
  
  // Generated data
  const [plotGrid, setPlotGrid] = useState<GeneratedPlot[]>([]);
  const [plotCount, setPlotCount] = useState(0);
  const [invalidPlotCount, setInvalidPlotCount] = useState(0);
  const [efficiency, setEfficiency] = useState(0);

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
      // Calculate real efficiency
      const width = plotSize === 'custom' ? parseFloat(customWidth) : 15.24;
      const depth = plotSize === 'custom' ? parseFloat(customDepth) : 30.48;
      const stats = calculateSubdivisionStats(parcelAreaSqm, loadedPlots, width, depth);
      setEfficiency(Math.round(stats.efficiency));
    }
  }, [savedPlots, parcelAreaSqm, plotSize, customWidth, customDepth]);

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
    
    try {
      // Delete existing plots first
      if (savedPlots && savedPlots.length > 0) {
        await deletePlots.mutateAsync(projectId);
      }

      const width = plotSize === 'custom' ? parseFloat(customWidth) : 15.24;
      const depth = plotSize === 'custom' ? parseFloat(customDepth) : 30.48;
      const road = parseFloat(roadWidth);
      
      // Generate plots with riparian collision detection
      const riparianBuffer = riparianBufferEnabled ? riparian.bufferPolygon : [];
      const plots = generatePlotGrid(parcelCoordinates, width, depth, road, riparianBuffer);
      
      // Calculate stats
      const stats = calculateSubdivisionStats(parcelAreaSqm, plots, width, depth);
      
      setIsSaving(true);
      
      // Filter to only valid plots for saving
      const validPlots = plots.filter(p => p.isValid);
      
      // Prepare plots for database
      const plotsToSave = validPlots.map((plot, index) => ({
        plot_number: index + 1,
        coordinates: plot.coordinates,
        area_sqm: width * depth,
        status: 'valid',
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
      setShowPlotGrid(true);
      
      // Update project status
      await updateProject.mutateAsync({
        projectId,
        updates: { status: 'in_progress' },
      });
      
      if (stats.invalidCount > 0) {
        toast.warning(`Generated ${stats.validCount} valid plots. ${stats.invalidCount} plots discarded (riparian overlap). Efficiency: ${Math.round(stats.efficiency)}%.`);
      } else {
        toast.success(`Success: ${stats.validCount} plots generated and saved. Yield Efficiency: ${Math.round(stats.efficiency)}%.`);
      }
      
      // Refetch to ensure sync
      refetchPlots();
    } catch (error: any) {
      toast.error("Failed to subdivide: " + error.message);
    } finally {
      setIsProcessing(false);
      setIsSaving(false);
    }
  };

  const handleStartDrawRiver = () => {
    riparian.startDrawing();
    toast.info("Click on the map to draw river path. Press Enter or Escape to finish.");
  };

  const handleFinishDrawRiver = () => {
    riparian.stopDrawing();
    if (riparian.riverPoints.length >= 2) {
      toast.success(`River drawn with ${riparian.riverPoints.length} points. 30m buffer zone created.`);
      setShowHazardZone(true);
    } else {
      toast.warning("River needs at least 2 points.");
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');

    // Simulate AI response
    setTimeout(() => {
      let aiResponse = "I understand. Let me process that for you.";
      
      if (chatInput.toLowerCase().includes('commercial')) {
        aiResponse = "Adjusting grid for commercial plots (100x100ft)... Done. 12 Commercial plots added to the northern block.";
      } else if (chatInput.toLowerCase().includes('road')) {
        aiResponse = "Road width adjusted to 12m. Re-calculating plot positions... Complete.";
      } else if (chatInput.toLowerCase().includes('split') || chatInput.toLowerCase().includes('northern')) {
        aiResponse = "Analyzing northern block... Adjusting grid... Done. 12 Commercial plots added.";
      } else if (chatInput.toLowerCase().includes('river') || chatInput.toLowerCase().includes('riparian')) {
        aiResponse = "To draw a river, click the 'Draw River' button (wave icon) in the toolbar, then click points on the map to trace the river path. Press Enter when done.";
      }

      const aiMessage: ChatMessage = {
        role: 'ai',
        content: aiResponse,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiMessage]);
    }, 1000);
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
          attribution='&copy; OpenStreetMap contributors'
          url={getTileUrl()}
        />
        {parcelCoordinates.length > 0 && (
          <MapController coordinates={parcelCoordinates} />
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
        
        {/* Plot Grid */}
        {showPlotGrid && plotGrid.map((plot, index) => (
          <Polygon
            key={index}
            positions={plot.coordinates.map(c => [c.lat, c.lng] as [number, number])}
            pathOptions={{
              color: plot.isValid ? 'hsl(199, 89%, 48%)' : 'hsl(0, 72%, 51%)',
              weight: 1.5,
              fillColor: plot.isValid ? 'hsl(199, 89%, 48%)' : 'hsl(0, 72%, 51%)',
              fillOpacity: plot.isValid ? 0.3 : 0.5,
            }}
          >
            <Popup>
              <div>
                <p className="font-semibold">
                  {plot.isValid ? `Plot ${plotGrid.filter((p, i) => p.isValid && i <= index).length}` : 'INVALID'}
                </p>
                {plot.isValid ? (
                  <p className="text-sm text-muted-foreground">50x100ft (465 sqm)</p>
                ) : (
                  <p className="text-sm text-destructive">
                    Riparian overlap: {plot.overlapPercent.toFixed(1)}%
                  </p>
                )}
              </div>
            </Popup>
          </Polygon>
        ))}
      </MapContainer>

      {/* Drawing Mode Indicator */}
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
      <div className="absolute top-4 right-4 z-[1000]">
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
            {/* Plot Size */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Plot Size Target</Label>
              <Select value={plotSize} onValueChange={setPlotSize}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50x100">50 x 100 ft (Standard)</SelectItem>
                  <SelectItem value="40x80">40 x 80 ft (Compact)</SelectItem>
                  <SelectItem value="custom">Custom Dimensions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Dimensions */}
            {plotSize === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Width (m)</Label>
                  <Input 
                    value={customWidth} 
                    onChange={(e) => setCustomWidth(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Depth (m)</Label>
                  <Input 
                    value={customDepth} 
                    onChange={(e) => setCustomDepth(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
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
                  <span className="text-muted-foreground">Yield Efficiency:</span>
                  <span className="font-mono font-semibold text-primary">{efficiency}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-mono font-semibold text-success">Saved ✓</span>
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
          >
            <Download className="h-5 w-5" />
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
        onOpenChange={setMutationModalOpen}
        projectId={projectId || ''}
        projectName={project.name}
      />
    </div>
  );
}
