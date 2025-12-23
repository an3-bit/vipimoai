import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Map, Layers, Mountain, Upload, AlertTriangle, Grid3X3, 
  FileText, Send, MessageSquare, ChevronDown, ChevronUp, Loader2,
  Download, Settings, ZoomIn, ZoomOut, Crosshair
} from 'lucide-react';
import { mockParcelCoordinates, mockRiparianZone, generatePlotGrid, mockChatMessages } from '@/data/mockData';
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
  
  // Map state
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'topo'>('standard');
  
  // Feature toggles
  const [showHazardZone, setShowHazardZone] = useState(false);
  const [showPlotGrid, setShowPlotGrid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form state
  const [projectName, setProjectName] = useState('Juja Farm Block 4');
  const [plotSize, setPlotSize] = useState('50x100');
  const [customWidth, setCustomWidth] = useState('15.24');
  const [customDepth, setCustomDepth] = useState('30.48');
  const [roadWidth, setRoadWidth] = useState('9');
  const [riparianBuffer, setRiparianBuffer] = useState(true);
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Mutation modal
  const [mutationModalOpen, setMutationModalOpen] = useState(false);
  
  // Generated data
  const [plotGrid, setPlotGrid] = useState<{ lat: number; lng: number }[][]>([]);
  const [plotCount, setPlotCount] = useState(0);
  const [efficiency, setEfficiency] = useState(0);
  
  // Parcel data (using mock for demo)
  const parcelCoordinates = mockParcelCoordinates;
  const riparianZone = mockRiparianZone;
  
  // Calculate area (approximate)
  const totalAreaAcres = 40; // Mock value
  const totalAreaHa = totalAreaAcres * 0.404686;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleRunHazardScan = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setShowHazardZone(true);
      setIsProcessing(false);
      toast({
        title: "Hazard Scan Complete",
        description: "Warning: 3 plots overlap with riparian reserve. Affected areas highlighted in red.",
        variant: "destructive",
      });
    }, 1500);
  };

  const handleAutoSubdivide = () => {
    setIsProcessing(true);
    
    setTimeout(() => {
      const width = plotSize === 'custom' ? parseFloat(customWidth) : 15.24;
      const depth = plotSize === 'custom' ? parseFloat(customDepth) : 30.48;
      const road = parseFloat(roadWidth);
      
      const plots = generatePlotGrid(parcelCoordinates, width, depth, road);
      setPlotGrid(plots);
      setPlotCount(plots.length);
      setEfficiency(88);
      setShowPlotGrid(true);
      setIsProcessing(false);
      
      toast({
        title: "Auto-Subdivision Complete",
        description: `Success: ${plots.length} Plots generated. Yield Efficiency: 88%.`,
      });
    }, 1500);
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
        <MapController coordinates={parcelCoordinates} />
        
        {/* Parent Parcel Boundary */}
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
        
        {/* Hazard Zone (Riparian) */}
        {showHazardZone && (
          <Polygon
            positions={riparianZone.map(c => [c.lat, c.lng] as [number, number])}
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
        
        {/* Plot Grid */}
        {showPlotGrid && plotGrid.map((plot, index) => (
          <Polygon
            key={index}
            positions={plot.map(c => [c.lat, c.lng] as [number, number])}
            pathOptions={{
              color: 'hsl(199, 89%, 48%)',
              weight: 1.5,
              fillColor: 'hsl(199, 89%, 48%)',
              fillOpacity: 0.3,
            }}
          >
            <Popup>
              <div>
                <p className="font-semibold">Plot {index + 1}</p>
                <p className="text-sm text-muted-foreground">50x100ft (465 sqm)</p>
              </div>
            </Popup>
          </Polygon>
        ))}
      </MapContainer>

      {/* Top Bar */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="glass-panel p-3 rounded-lg hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="glass-panel rounded-lg px-4 py-2">
          <p className="font-semibold">{projectName}</p>
          <p className="text-xs text-muted-foreground">Calculated: {totalAreaHa.toFixed(2)} Ha / {totalAreaAcres} Acres</p>
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
                <p className="text-xs text-muted-foreground">Auto-detect rivers</p>
              </div>
              <Switch 
                checked={riparianBuffer} 
                onCheckedChange={setRiparianBuffer}
              />
            </div>

            {/* Stats */}
            {showPlotGrid && (
              <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plots Generated:</span>
                  <span className="font-mono font-semibold text-primary">{plotCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Yield Efficiency:</span>
                  <span className="font-mono font-semibold text-primary">{efficiency}%</span>
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
          
          {/* Hazard Scan */}
          <button 
            className={`tool-btn ${showHazardZone ? 'active' : ''}`}
            onClick={handleRunHazardScan}
            disabled={isProcessing}
            title="Run Hazard Scan"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </button>
          
          {/* Auto Subdivide */}
          <button 
            className={`tool-btn ${showPlotGrid ? 'active' : ''}`}
            onClick={handleAutoSubdivide}
            disabled={isProcessing}
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
        plotCount={plotCount}
      />
    </div>
  );
}
