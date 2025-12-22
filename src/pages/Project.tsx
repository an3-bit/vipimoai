import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Settings, Download, Map, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SurveyMap, ParcelUpload } from '@/components/map';
import { useProject, useCreateParcel } from '@/hooks/useSurvey';
import { Coordinate, Beacon, Plot } from '@/types/survey';
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
  const [hoveredCoord, setHoveredCoord] = useState<Coordinate | null>(null);

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
      }
    }
  }, [project]);

  const handleCoordinatesLoaded = async (coordinates: Coordinate[]) => {
    setParcelCoordinates(coordinates);

    // Save parcel to database
    if (projectId) {
      await createParcel.mutateAsync({
        projectId,
        name: 'Main Parcel',
        coordinates,
      });
    }
  };

  // Get beacons from project data
  const beacons: Beacon[] = project?.parcels?.flatMap(parcel =>
    parcel.subdivisions?.flatMap(sub =>
      sub.plots?.flatMap(plot =>
        (plot.beacons || []).map(b => ({
          id: b.id,
          beacon_number: b.beacon_number,
          latitude: b.latitude,
          longitude: b.longitude,
          northing: b.northing,
          easting: b.easting,
          description: b.description,
        }))
      ) || []
    ) || []
  ) || [];

  // Get plots from project data
  const plots: Plot[] = project?.parcels?.flatMap(parcel =>
    parcel.subdivisions?.flatMap(sub =>
      (sub.plots || []).map(p => ({
        id: p.id,
        plot_number: p.plot_number,
        coordinates: p.coordinates as Coordinate[],
        area_sqm: p.area_sqm,
        width_m: p.width_m,
        depth_m: p.depth_m,
        is_partial: p.is_partial || false,
        beacons: [],
      }))
    ) || []
  ) || [];

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
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
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
              onCoordinateHover={setHoveredCoord}
              showSatellite={showSatellite}
              className="h-[500px]"
            />

            {/* Parcel Info */}
            {parcelCoordinates.length > 0 && (
              <Card variant="glass">
                <CardContent className="py-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-survey-primary">
                        {formatArea(calculateArea(parcelCoordinates))}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Area</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-survey-accent">
                        {calculatePerimeter(parcelCoordinates).toFixed(2)} m
                      </p>
                      <p className="text-xs text-muted-foreground">Perimeter</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-survey-beacon">
                        {parcelCoordinates.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Beacons</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="subdivide">Subdivide</TabsTrigger>
                <TabsTrigger value="beacons">Beacons</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <ParcelUpload onCoordinatesLoaded={handleCoordinatesLoaded} />
              </TabsContent>

              <TabsContent value="subdivide" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-survey-primary" />
                      Subdivision Setup
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {parcelCoordinates.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Upload a parcel first to configure subdivision
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Subdivision form coming soon...
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="beacons" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-survey-beacon" />
                      Beacon List
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {beacons.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No beacons yet. Subdivide the parcel to generate beacons.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {beacons.map((beacon) => (
                          <div
                            key={beacon.id}
                            className="p-3 rounded-md bg-muted/50 font-mono text-xs"
                          >
                            <p className="font-semibold">Beacon {beacon.beacon_number}</p>
                            <p>Lat: {beacon.latitude.toFixed(6)}</p>
                            <p>Lng: {beacon.longitude.toFixed(6)}</p>
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
