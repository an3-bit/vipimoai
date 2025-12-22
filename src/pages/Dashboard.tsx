import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProjects, useCreateProject, useCreateParcel } from '@/hooks/useSurvey';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Plus, MapPin, FolderOpen, LogOut, Clock, CheckCircle, FileText, 
  Grid3X3, Download, Map, Settings, Home, Layers
} from 'lucide-react';
import { ParcelUpload } from '@/components/map/ParcelUpload';
import { Coordinate } from '@/types/survey';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [activeSection, setActiveSection] = useState('projects');
  const [parcelCoordinates, setParcelCoordinates] = useState<Coordinate[] | null>(null);

  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const createParcel = useCreateParcel();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/auth');
      } else {
        setUser(user);
      }
    });
  }, [navigate]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    if (!parcelCoordinates || parcelCoordinates.length < 3) {
      return;
    }

    const project = await createProject.mutateAsync({
      name: projectName,
      client_name: clientName || undefined,
    });

    // Create the parcel with coordinates
    await createParcel.mutateAsync({
      projectId: project.id,
      name: 'Main Parcel',
      coordinates: parcelCoordinates,
    });

    setNewProjectOpen(false);
    setProjectName('');
    setClientName('');
    setParcelCoordinates(null);
    
    // Navigate to the new project
    navigate(`/project/${project.id}`);
  };

  const handleCoordinatesLoaded = (coordinates: Coordinate[]) => {
    setParcelCoordinates(coordinates);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-warning" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const menuItems = [
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'subdivisions', label: 'Subdivisions', icon: Grid3X3 },
    { id: 'maps', label: 'Maps & Parcels', icon: Map },
    { id: 'exports', label: 'Exports', icon: Download },
  ];

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-topographic">
        {/* Sidebar */}
        <Sidebar className="border-r border-border">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">SurveyAI Pro</h1>
                <p className="text-xs text-muted-foreground">Land Subdivision</p>
              </div>
            </div>
          </div>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton 
                        onClick={() => setActiveSection(item.id)}
                        isActive={activeSection === item.id}
                        className="w-full"
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setNewProjectOpen(true)} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      <span>New Project</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <div className="mt-auto p-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 h-14 flex items-center px-4">
            <SidebarTrigger className="mr-4" />
            <h2 className="text-lg font-semibold capitalize">{activeSection.replace('_', ' ')}</h2>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            {activeSection === 'projects' && (
              <>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold">Survey Projects</h2>
                    <p className="text-muted-foreground">Manage your land subdivision projects</p>
                  </div>
                  <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
                    <DialogTrigger asChild>
                      <Button variant="survey" size="lg">
                        <Plus className="h-5 w-5 mr-2" />
                        New Project
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Project Name</Label>
                          <Input
                            id="name"
                            placeholder="e.g., Westlands Subdivision"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client">Client Name (Optional)</Label>
                          <Input
                            id="client"
                            placeholder="e.g., ABC Developers Ltd"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                          />
                        </div>
                        
                        {/* CSV Upload Section */}
                        <div className="pt-2">
                          <ParcelUpload onCoordinatesLoaded={handleCoordinatesLoaded} />
                        </div>

                        <Button 
                          type="submit" 
                          variant="survey" 
                          className="w-full" 
                          disabled={createProject.isPending || createParcel.isPending || !parcelCoordinates}
                        >
                          {createProject.isPending || createParcel.isPending 
                            ? 'Creating...' 
                            : !parcelCoordinates 
                              ? 'Upload coordinates to continue'
                              : 'Create Project'
                          }
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="skeleton-shimmer h-48" />
                    ))}
                  </div>
                ) : projects && projects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                      <Card key={project.id} variant="glow" className="cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => navigate(`/project/${project.id}`)}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{project.name}</CardTitle>
                              <CardDescription>{project.client_name || 'No client assigned'}</CardDescription>
                            </div>
                            {statusIcon(project.status)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="capitalize">{project.status.replace('_', ' ')}</span>
                            <span>•</span>
                            <span>{new Date(project.created_at).toLocaleDateString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="text-center py-16">
                    <CardContent>
                      <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
                      <p className="text-muted-foreground mb-6">
                        Create your first survey project to get started
                      </p>
                      <Button variant="survey" onClick={() => setNewProjectOpen(true)}>
                        <Plus className="h-5 w-5 mr-2" />
                        Create Project
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {activeSection === 'subdivisions' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Subdivisions</h2>
                  <p className="text-muted-foreground">AI-powered land subdivision and plot generation</p>
                </div>
                <Card className="p-8 text-center">
                  <Grid3X3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Select a Project</h3>
                  <p className="text-muted-foreground mb-4">
                    Open a project to access subdivision tools and AI-powered plot generation
                  </p>
                  <Button variant="survey" onClick={() => setActiveSection('projects')}>
                    View Projects
                  </Button>
                </Card>
              </div>
            )}

            {activeSection === 'maps' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Maps & Parcels</h2>
                  <p className="text-muted-foreground">Upload and manage parcel boundaries</p>
                </div>
                <Card className="p-8 text-center">
                  <Map className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Parcel Management</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload GeoJSON/KML files or draw boundaries within a project
                  </p>
                  <Button variant="survey" onClick={() => setActiveSection('projects')}>
                    Open a Project
                  </Button>
                </Card>
              </div>
            )}

            {activeSection === 'exports' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Exports</h2>
                  <p className="text-muted-foreground">Export mutation maps, beacon lists, and GIS data</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-6">
                    <FileText className="h-10 w-10 text-primary mb-3" />
                    <h4 className="font-semibold mb-1">PDF Reports</h4>
                    <p className="text-sm text-muted-foreground">Mutation maps and beacon lists</p>
                  </Card>
                  <Card className="p-6">
                    <Layers className="h-10 w-10 text-primary mb-3" />
                    <h4 className="font-semibold mb-1">GeoJSON</h4>
                    <p className="text-sm text-muted-foreground">Standard GIS format</p>
                  </Card>
                  <Card className="p-6">
                    <Map className="h-10 w-10 text-primary mb-3" />
                    <h4 className="font-semibold mb-1">KML</h4>
                    <p className="text-sm text-muted-foreground">Google Earth compatible</p>
                  </Card>
                  <Card className="p-6">
                    <Download className="h-10 w-10 text-primary mb-3" />
                    <h4 className="font-semibold mb-1">CSV</h4>
                    <p className="text-sm text-muted-foreground">Beacon coordinate tables</p>
                  </Card>
                </div>
                <Card className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Export options are available within each project after subdivision is complete
                  </p>
                  <Button variant="survey" className="mt-4" onClick={() => setActiveSection('projects')}>
                    Go to Projects
                  </Button>
                </Card>
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
