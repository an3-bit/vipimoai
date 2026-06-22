import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, MapPin, FolderOpen, LandPlot, Clock, CheckCircle, ArrowRight, Loader2 
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  client_name: string;
  location_name: string;
  status: string;
  acres: number;
  plots: number;
  total_area_ha: number;
}

interface CardsViewProps {
  projects: Project[];
  isLoading: boolean;
  totalAcres: number;
  pendingMutations: number;
  profile: any;
  user: any;
  onNewProject: () => void;
}

export function CardsView({
  projects,
  isLoading,
  totalAcres,
  pendingMutations,
  profile,
  user,
  onNewProject,
}: CardsViewProps) {
  const navigate = useNavigate();

  return (
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
                <p className="text-2xl font-bold">{projects.length}</p>
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
                <p className="text-2xl font-bold">{projects.filter(p => p.status === 'completed').length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Section */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Projects</h2>
          <Button onClick={() => user ? onNewProject() : navigate('/auth')}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
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
              onClick={() => user ? onNewProject() : navigate('/auth')}
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Project
            </Button>
          </Card>
        ) : (
          /* Project Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
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
  );
}
