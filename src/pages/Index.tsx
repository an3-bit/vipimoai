import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { useProjects, useCreateProject, useCreateParcel } from '@/hooks/useSurvey';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, MapPin, LogOut, Clock, CheckCircle, FileText, 
  ChevronLeft, ChevronRight, Map, Layers, LandPlot, Loader2, AlertCircle, User,
  Calendar, ArrowRight, FolderOpen
} from 'lucide-react';
import { ParcelUpload } from '@/components/map/ParcelUpload';
import { Coordinate } from '@/types/survey';
import { toast } from 'sonner';

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
    archived: '#64748b',
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
function MapBoundsAdjuster({ projects }: { projects: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (projects.length > 0) {
      const validProjects = projects.filter(p => p.lat && p.lng);
      if (validProjects.length > 0) {
        const bounds = L.latLngBounds(validProjects.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 11 });
      }
    }
  }, [projects, map]);
  
  return null;
}

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'cards'>('map'); // Default to map view for Global Operations
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [parcelCoordinates, setParcelCoordinates] = useState<Coordinate[] | null>(null);
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite'>('satellite'); // Default to satellite for visual appeal

  const { data: dbProjects, isLoading, error, isFetching } = useProjects();
  const { data: profile } = useProfile();
  const createProject = useCreateProject();
  const createParcel = useCreateParcel();

  // Transform DB projects to display format with coordinates
  const allProjects = (dbProjects || []).map((project: any) => {
    // Try to get coordinates from first parcel's centroid
    const parcel = project.parcels?.[0];
    let lat = -1.115; // Default to Juja
    let lng = 37.117;
    let acres = 0;
    let plots = 0;

    if (parcel?.centroid) {
      lat = parcel.centroid.lat || parcel.centroid[0] || lat;
      lng = parcel.centroid.lng || parcel.centroid[1] || lng;
      acres = parcel.area_sqm ? Number((parcel.area_sqm / 4046.86).toFixed(1)) : 0;
    }

    // Count plots
    if (parcel?.subdivisions) {
      parcel.subdivisions.forEach((sub: any) => {
        plots += sub.plots?.length || 0;
      });
    }

    return {
      id: project.id,
      name: project.name,
      client_name: project.client_name || 'No client',
      location_name: project.location_name || 'Kenya',
      status: project.status,
      lat,
      lng,
      acres: Number(acres),
      plots,
      total_area_ha: project.total_area_ha || 0,
    };
  });

  // Auth state handling
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show sync error toast
  useEffect(() => {
    if (error) {
      toast.error('Sync Error: Failed to load projects. Check your connection.');
    }
  }, [error]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !parcelCoordinates || parcelCoordinates.length < 3) return;

    try {
      // Calculate area from coordinates
      const areaHa = calculateAreaFromCoords(parcelCoordinates);

      const project = await createProject.mutateAsync({
        name: projectName,
        client_name: clientName || undefined,
        location_name: locationName || undefined,
        total_area_ha: areaHa,
      });

      await createParcel.mutateAsync({
        projectId: project.id,
        name: 'Main Parcel',
        coordinates: parcelCoordinates,
      });

      setNewProjectOpen(false);
      setProjectName('');
      setClientName('');
      setLocationName('');
      setParcelCoordinates(null);
      navigate(`/workspace/${project.id}`);
    } catch (err) {
      // Error is already handled by the mutation
    }
  };

  // Simple area calculation
  const calculateAreaFromCoords = (coords: Coordinate[]): number => {
    if (coords.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i].lng * coords[j].lat;
      area -= coords[j].lng * coords[i].lat;
    }
    area = Math.abs(area) / 2;
    // Convert to hectares (rough approximation)
    return area * 111000 * 111000 * Math.cos(coords[0].lat * Math.PI / 180) / 10000;
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
    archived: 'text-muted-foreground',
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Main Content - Map or Cards View */}
      {viewMode === 'map' ? (
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
      ) : (
        /* Cards View - Mission Control Dashboard */
        <div className="h-full bg-background overflow-auto">
          <div className="max-w-6xl mx-auto p-6">
            {/* Dashboard Header */}
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gradient">Mission Control</h1>
                  <p className="text-muted-foreground">
                    {profile?.full_name ? `Welcome back, ${profile.full_name}` : 'Welcome to VipimoAI'}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card variant="glow" className="bg-secondary/30">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                    <FolderOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{allProjects.length}</p>
                    <p className="text-xs text-muted-foreground">Total Projects</p>
                  </div>
                </CardContent>
              </Card>
              <Card variant="glow" className="bg-secondary/30">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-success/20 flex items-center justify-center">
                    <LandPlot className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gradient">{(totalAcres / 2.471).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Total Hectares</p>
                  </div>
                </CardContent>
              </Card>
              <Card variant="glow" className="bg-secondary/30">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-warning/20 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingMutations}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                </CardContent>
              </Card>
              <Card variant="glow" className="bg-secondary/30">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{allProjects.filter(p => p.status === 'completed').length}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Projects Section */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Projects</h2>
              <Button onClick={() => user ? setNewProjectOpen(true) : navigate('/auth')}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : allProjects.length === 0 ? (
              /* Empty State */
              <Card variant="glow" className="p-12 text-center">
                <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Start your first land subdivision project. Upload parcel coordinates and let VipimoAI help you create compliant plot layouts.
                </p>
                <Button 
                  size="lg"
                  onClick={() => user ? setNewProjectOpen(true) : navigate('/auth')}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create Your First Project
                </Button>
              </Card>
            ) : (
              /* Project Cards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allProjects.map((project) => (
                  <Card 
                    key={project.id} 
                    variant="glow"
                    className="hover:border-primary/50 transition-all cursor-pointer group"
                    onClick={() => navigate(`/workspace/${project.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${
                            project.status === 'completed' ? 'bg-success' :
                            project.status === 'in_progress' ? 'bg-warning' : 'bg-muted-foreground'
                          }`} />
                          <span className="text-xs text-muted-foreground capitalize">{project.status.replace('_', ' ')}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {project.name}
                      </CardTitle>
                      <CardDescription>{project.client_name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-3 rounded-lg bg-secondary/50">
                          <p className="text-lg font-bold text-primary">{(project.total_area_ha || project.acres / 2.471).toFixed(2)} Ha</p>
                          <p className="text-xs text-muted-foreground">Total Area</p>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/50">
                          <p className="text-lg font-bold">{project.plots}</p>
                          <p className="text-xs text-muted-foreground">Plots</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{project.location_name || 'Kenya'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
      {error && (
        <div className="absolute top-4 right-20 z-[1000]">
          <div className="glass-panel rounded-lg px-3 py-2 flex items-center gap-2 border-destructive/50">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-destructive">Sync Error</span>
          </div>
        </div>
      )}

      {/* View Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <div className="floating-control flex flex-col gap-1">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded transition-colors ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
            title="Cards View"
          >
            <LandPlot className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`p-2 rounded transition-colors ${viewMode === 'map' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
            title="Map View"
          >
            <Map className="h-4 w-4" />
          </button>
          {viewMode === 'map' && (
            <>
              <div className="w-full h-px bg-border my-1" />
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
            </>
          )}
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
                    {isLoading ? 'Loading...' : `Projects (${allProjects.length})`}
                  </h2>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => user ? setNewProjectOpen(true) : navigate('/auth')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : allProjects.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm mb-4">No projects yet</p>
                    <Button 
                      size="sm"
                      onClick={() => user ? setNewProjectOpen(true) : navigate('/auth')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Project
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allProjects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => navigate(`/workspace/${project.id}`)}
                        className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 ${statusColors[project.status as keyof typeof statusColors]}`}>
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
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t border-border/50">
              {user ? (
                <div className="space-y-3">
                  <button 
                    onClick={() => navigate('/profile')}
                    className="flex items-center gap-2 w-full hover:bg-secondary/50 p-2 rounded-lg transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {user.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground">View Profile</p>
                    </div>
                    <User className="h-4 w-4 text-muted-foreground" />
                  </button>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Create New Survey Project
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-5 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Juja Farm Block 5"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="client">Client Name</Label>
                  <Input
                    id="client"
                    placeholder="e.g., ABC Developers"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Juja, Kiambu"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="border-t border-border pt-4">
              <ParcelUpload onCoordinatesLoaded={handleCoordinatesLoaded} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setNewProjectOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={createProject.isPending || createParcel.isPending || !parcelCoordinates || !projectName.trim()}
              >
                {createProject.isPending || createParcel.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </div>
            
            {!parcelCoordinates && (
              <p className="text-xs text-center text-muted-foreground">
                Upload parcel coordinates to create project
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}