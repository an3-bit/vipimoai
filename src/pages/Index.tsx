import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { useProjects, useCreateProject, useCreateParcel } from '@/hooks/useSurvey';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, MapPin, FolderOpen, LogOut, Clock, CheckCircle, FileText, 
  ChevronLeft, ChevronRight, Map, Layers, LandPlot
} from 'lucide-react';
import { mockProjects } from '@/data/mockData';
import { ParcelUpload } from '@/components/map/ParcelUpload';
import { Coordinate } from '@/types/survey';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom project marker icons
const createProjectIcon = (status: string) => {
  const colors = {
    draft: '#6b7280',
    in_progress: '#f59e0b',
    completed: '#10b981',
  };
  const color = colors[status as keyof typeof colors] || colors.draft;
  
  return L.divIcon({
    className: 'project-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        background: ${color};
        border: 3px solid rgba(255,255,255,0.9);
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

// Map bounds adjuster
function MapBoundsAdjuster({ projects }: { projects: typeof mockProjects }) {
  const map = useMap();
  
  useEffect(() => {
    if (projects.length > 0) {
      const bounds = L.latLngBounds(projects.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 11 });
    }
  }, [projects, map]);
  
  return null;
}

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [parcelCoordinates, setParcelCoordinates] = useState<Coordinate[] | null>(null);
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite'>('standard');

  const { data: dbProjects } = useProjects();
  const createProject = useCreateProject();
  const createParcel = useCreateParcel();

  // Combine mock data with real projects for demo
  const allProjects = mockProjects;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !parcelCoordinates || parcelCoordinates.length < 3) return;

    const project = await createProject.mutateAsync({
      name: projectName,
      client_name: clientName || undefined,
    });

    await createParcel.mutateAsync({
      projectId: project.id,
      name: 'Main Parcel',
      coordinates: parcelCoordinates,
    });

    setNewProjectOpen(false);
    setProjectName('');
    setClientName('');
    setParcelCoordinates(null);
    navigate(`/project/${project.id}`);
  };

  const handleCoordinatesLoaded = (coordinates: Coordinate[]) => {
    setParcelCoordinates(coordinates);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const totalAcres = allProjects.reduce((sum, p) => sum + p.acres, 0);
  const pendingMutations = allProjects.filter(p => p.status === 'in_progress').length;

  const statusColors = {
    draft: 'text-muted-foreground',
    in_progress: 'text-warning',
    completed: 'text-success',
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Full-screen Map */}
      <MapContainer
        center={[-1.2, 37.0]}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={mapLayer === 'satellite' 
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
        />
        <MapBoundsAdjuster projects={allProjects} />
        
        {/* Project Markers */}
        {allProjects.map((project) => (
          <Marker
            key={project.id}
            position={[project.lat, project.lng]}
            icon={createProjectIcon(project.status)}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-semibold text-base mb-1">{project.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{project.client_name}</p>
                <div className="flex items-center gap-3 text-sm mb-3">
                  <span>{project.acres} acres</span>
                  <span>•</span>
                  <span>{project.plots} plots</span>
                </div>
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => navigate(`/workspace/${project.id}`)}
                >
                  Open Workspace
                </Button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Top Metrics Card */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="glass-panel rounded-xl px-6 py-3 flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <LandPlot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gradient">{totalAcres}</p>
              <p className="text-xs text-muted-foreground">Total Acres Surveyed</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingMutations}</p>
              <p className="text-xs text-muted-foreground">Pending Mutations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Layer Toggle */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
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
        </div>
      </div>

      {/* Collapsible Sidebar */}
      <div 
        className={`absolute top-0 left-0 h-full z-[1000] transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0'
        }`}
      >
        {sidebarOpen && (
          <div className="h-full glass-panel border-r border-border/50 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="font-bold text-lg">VipimoAI</h1>
                <p className="text-xs text-muted-foreground">Land Surveyor's Co-Pilot</p>
              </div>
            </div>

            {/* Projects List */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Recent Projects
                  </h2>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => user ? setNewProjectOpen(true) : navigate('/auth')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {allProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => navigate(`/workspace/${project.id}`)}
                      className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 ${statusColors[project.status]}`}>
                          {project.status === 'completed' ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : project.status === 'in_progress' ? (
                            <Clock className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate group-hover:text-primary transition-colors">
                            {project.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {project.client_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{project.acres} ac</span>
                            <span>•</span>
                            <span>{project.plots} plots</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t border-border/50">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {user.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm truncate flex-1">{user.email}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSignOut} 
                    className="w-full justify-start"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={() => navigate('/auth')}
                >
                  Sign In to Create Projects
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`absolute top-1/2 -translate-y-1/2 z-10 glass-panel p-2 rounded-r-lg border-l-0 transition-all ${
            sidebarOpen ? 'left-80' : 'left-0'
          }`}
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* New Project Button (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-[1000]">
        <Button 
          size="lg" 
          className="shadow-glow"
          onClick={() => user ? setNewProjectOpen(true) : navigate('/auth')}
        >
          <Plus className="h-5 w-5 mr-2" />
          New Project
        </Button>
      </div>

      {/* New Project Dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-panel border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl">Create New Survey Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Juja Farm Block 5"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Client Name</Label>
                <Input
                  id="client"
                  placeholder="e.g., ABC Developers Ltd"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
            </div>
            
            <div className="pt-2">
              <ParcelUpload onCoordinatesLoaded={handleCoordinatesLoaded} />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={createProject.isPending || createParcel.isPending || !parcelCoordinates}
            >
              {createProject.isPending || createParcel.isPending 
                ? 'Creating...' 
                : !parcelCoordinates 
                  ? 'Upload coordinates to continue'
                  : 'Create Project & Open Workspace'
              }
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
