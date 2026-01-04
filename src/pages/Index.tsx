import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { useProjects, useCreateProject, useCreateParcel } from '@/hooks/useSurvey';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import {
  ProjectsSidebar,
  MapView,
  CardsView,
  ViewToggle,
  NewProjectDialog,
  StatusIndicators,
} from '@/components/index';
import { Coordinate } from '@/types/survey';
import { toast } from 'sonner';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'map' | 'cards'>('map');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [parcelCoordinates, setParcelCoordinates] = useState<Coordinate[] | null>(null);
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite'>('satellite');

  const { data: dbProjects, isLoading, error, isFetching } = useProjects();
  const { data: profile } = useProfile();
  const createProject = useCreateProject();
  const createParcel = useCreateParcel();

  // Transform DB projects to display format
  const allProjects = (dbProjects || []).map((project: any) => {
    const parcel = project.parcels?.[0];
    let lat = -1.115;
    let lng = 37.117;
    let acres = 0;
    let plots = 0;

    if (parcel?.centroid) {
      lat = parcel.centroid.lat || parcel.centroid[0] || lat;
      lng = parcel.centroid.lng || parcel.centroid[1] || lng;
      acres = parcel.area_sqm ? Number((parcel.area_sqm / 4046.86).toFixed(1)) : 0;
    }

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
      parcels: project.parcels || [],
    };
  });

  // Auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Error handling
  useEffect(() => {
    if (error) {
      toast.error('Sync Error: Failed to load projects. Check your connection.');
    }
  }, [error]);

  const calculateAreaFromCoords = (coords: Coordinate[]): number => {
    if (coords.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      area += coords[i].lng * coords[j].lat;
      area -= coords[j].lng * coords[i].lat;
    }
    area = Math.abs(area) / 2;
    return area * 111000 * 111000 * Math.cos(coords[0].lat * Math.PI / 180) / 10000;
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !parcelCoordinates || parcelCoordinates.length < 3) return;

    try {
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
      // Error handled by mutation
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const totalAcres = allProjects.reduce((sum, p) => sum + p.acres, 0);
  const pendingMutations = allProjects.filter(p => p.status === 'in_progress').length;

  return (
    <>
      <div className="h-screen w-screen overflow-hidden flex">
        {/* Sidebar */}
        <ProjectsSidebar
          projects={allProjects}
          isLoading={isLoading}
          user={user}
          onNewProject={() => user ? setNewProjectOpen(true) : navigate('/auth')}
          onSignOut={handleSignOut}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-hidden relative">
          {viewMode === 'map' ? (
            <MapView projects={allProjects} mapLayer={mapLayer} />
          ) : (
            <CardsView
              projects={allProjects}
              isLoading={isLoading}
              totalAcres={totalAcres}
              pendingMutations={pendingMutations}
              profile={profile}
              user={user}
              onNewProject={() => user ? setNewProjectOpen(true) : navigate('/auth')}
            />
          )}

          {/* Status Indicators */}
          <StatusIndicators isFetching={isFetching} hasError={!!error} />

          {/* View Toggle */}
          <div className="absolute top-4 right-4 z-[1000]">
            <ViewToggle
              viewMode={viewMode}
              mapLayer={mapLayer}
              onViewModeChange={setViewMode}
              onMapLayerChange={setMapLayer}
            />
          </div>

          {/* New Project Button */}
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
        </div>
      </div>

      {/* Dialog - Rendered at root level to ensure it's always on top */}
      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        clientName={clientName}
        onClientNameChange={setClientName}
        locationName={locationName}
        onLocationNameChange={setLocationName}
        parcelCoordinates={parcelCoordinates}
        onCoordinatesLoaded={setParcelCoordinates}
        isSubmitting={createProject.isPending || createParcel.isPending}
        onSubmit={handleCreateProject}
      />
    </>
  );
}