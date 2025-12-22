import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Map, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SurveyMap, ParcelUpload } from '@/components/map';
import { SubdivisionForm, SuggestionsPanel } from '@/components/subdivision';
import { ExportDialog } from '@/components/export';
import { useProject, useCreateParcel } from '@/hooks/useSurvey';
import { Coordinate, Beacon, Plot, AISuggestion } from '@/types/survey';
import { calculateArea, calculatePerimeter, formatArea } from '@/lib/geometry';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

export default function Project() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const createParcel = useCreateParcel();

  const [showSatellite, setShowSatellite] = useState(false);
  const [parcelCoordinates, setParcelCoordinates] = useState<Coordinate[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [activeTab, setActiveTab] = useState('upload');

  // Check auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/auth');
    });
  }, [navigate]);

  // Load existing parcel coordinates
  useEffect(() => {
    if (project?.parcels && project.parcels.length > 0) {
      const parcel = project.parcels[0];
      const coords = parcel.coordinates as unknown as Coordinate[];
      if (Array.isArray(coords)) {
        setParcelCoordinates(coords);
        setActiveTab('subdivide');
      }
    }
  }, [project]);

  const handleCoordinatesLoaded = async (coordinates: Coordinate[]) => {
    setParcelCoordinates(coordinates);
    setActiveTab('subdivide');

    // Save parcel to database
    if (projectId) {
      await createParcel.mutateAsync({
        projectId,
        name: 'Main Parcel',
        coordinates,
      });
    }
  };

  const handleSubdivisionComplete = (newPlots: Plot[], newBeacons: Beacon[], newSuggestions: AISuggestion[]) => {
    setPlots(newPlots);
    setBeacons(newBeacons);
    setSuggestions(newSuggestions);
    setActiveTab('beacons');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-[500px] lg:col-span-2" />
            <Skeleton className="h-[500px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{project?.name || 'Project'}</h1>
                {project?.client_name && (
                  <p className="text-sm text-muted-foreground">Client: {project.client_name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSatellite(!showSatellite)}
              >
                {showSatellite ? <Map className="h-4 w-4 mr-2" /> : <Satellite className="h-4 w-4 mr-2" />}
                {showSatellite ? 'Map View' : 'Satellite'}
              </Button>
              <ExportDialog
                projectName={project?.name || 'Project'}
                clientName={project?.client_name || undefined}
                parcelCoordinates={parcelCoordinates}
                plots={plots}
                beacons={beacons}
                disabled={plots.length === 0}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2 space-y-4">
            <SurveyMap
              parcelCoordinates={parcelCoordinates}
              plots={plots}
              beacons={beacons}
              showSatellite={showSatellite}
              className="h-[500px]"
            />

            {/* Parcel Info */}
            {parcelCoordinates.length > 0 && (
              <Card variant="glass">
                <CardContent className="py-4">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-survey-primary">
                        {formatArea(calculateArea(parcelCoordinates))}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Area</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-survey-accent">
                        {calculatePerimeter(parcelCoordinates).toFixed(0)} m
                      </p>
                      <p className="text-xs text-muted-foreground">Perimeter</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-survey-success">
                        {plots.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Plots</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-survey-beacon">
                        {beacons.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Beacons</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
              <SuggestionsPanel suggestions={suggestions} />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="subdivide">Subdivide</TabsTrigger>
                <TabsTrigger value="beacons">Beacons</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <ParcelUpload onCoordinatesLoaded={handleCoordinatesLoaded} />
              </TabsContent>

              <TabsContent value="subdivide" className="mt-4">
                {parcelCoordinates.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Upload a parcel first to configure subdivision
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <SubdivisionForm
                    parcelCoordinates={parcelCoordinates}
                    onSubdivisionComplete={handleSubdivisionComplete}
                  />
                )}
              </TabsContent>

              <TabsContent value="beacons" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-survey-beacon" />
                      Beacon List ({beacons.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {beacons.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No beacons yet. Subdivide the parcel to generate beacons.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {beacons.map((beacon) => (
                          <div
                            key={beacon.id}
                            className="p-3 rounded-md bg-muted/50 font-mono text-xs border border-border/50 hover:border-survey-beacon/50 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-survey-beacon">
                                B{beacon.beacon_number}
                              </span>
                              <span className="text-muted-foreground text-[10px]">
                                {beacon.description}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                              <span>Lat: {beacon.latitude.toFixed(6)}</span>
                              <span>Lng: {beacon.longitude.toFixed(6)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
