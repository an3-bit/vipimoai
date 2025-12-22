import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Map, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProject, useCreateParcel } from '@/hooks/useSurvey';
import { Coordinate, Beacon, Plot, AISuggestion } from '@/types/survey';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  WizardProgress,
  UploadStep,
  BeaconStep,
  SubdivisionStep,
  AIStep,
  ExportStep,
} from '@/components/wizard';

const WIZARD_STEPS = [
  { id: 1, title: 'Upload', description: 'Load coordinates' },
  { id: 2, title: 'Beacons', description: 'Confirm boundaries' },
  { id: 3, title: 'Subdivide', description: 'Configure plots' },
  { id: 4, title: 'AI Results', description: 'Review layout' },
  { id: 5, title: 'Export', description: 'Generate outputs' },
];

export default function Project() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const createParcel = useCreateParcel();

  const [currentStep, setCurrentStep] = useState(1);
  const [showSatellite, setShowSatellite] = useState(false);
  const [parcelCoordinates, setParcelCoordinates] = useState<Coordinate[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);

  // Check auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/auth');
    });
  }, [navigate]);

  // Load existing parcel coordinates and determine starting step
  useEffect(() => {
    if (project?.parcels && project.parcels.length > 0) {
      const parcel = project.parcels[0];
      const coords = parcel.coordinates as unknown as Coordinate[];
      if (Array.isArray(coords) && coords.length >= 3) {
        setParcelCoordinates(coords);
        // If parcel exists, start at step 2
        if (currentStep === 1) {
          setCurrentStep(2);
        }
      }
    }
  }, [project]);

  const handleCoordinatesLoaded = async (coordinates: Coordinate[]) => {
    setParcelCoordinates(coordinates);

    // Save parcel to database if it doesn't exist
    if (projectId && (!project?.parcels || project.parcels.length === 0)) {
      try {
        await createParcel.mutateAsync({
          projectId,
          name: 'Main Parcel',
          coordinates,
        });
      } catch (error) {
        console.error('Error saving parcel:', error);
      }
    }
  };

  const handleSubdivisionComplete = (
    newPlots: Plot[],
    newBeacons: Beacon[],
    newSuggestions: AISuggestion[]
  ) => {
    setPlots(newPlots);
    setBeacons(newBeacons);
    setSuggestions(newSuggestions);
    // Auto-advance to AI results step
    setCurrentStep(4);
  };

  const handleProjectComplete = () => {
    toast.success('Project completed successfully!');
    navigate('/dashboard');
  };

  const goToStep = (step: number) => {
    // Only allow going to steps that have been unlocked
    if (step === 1) {
      setCurrentStep(1);
    } else if (step === 2 && parcelCoordinates.length >= 3) {
      setCurrentStep(2);
    } else if (step === 3 && parcelCoordinates.length >= 3) {
      setCurrentStep(3);
    } else if (step === 4 && plots.length > 0) {
      setCurrentStep(4);
    } else if (step === 5 && plots.length > 0) {
      setCurrentStep(5);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-20 w-full" />
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
            </div>
          </div>
        </div>
      </header>

      {/* Wizard Progress */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <WizardProgress
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepClick={goToStep}
        />
      </div>

      {/* Main Content - Step Views */}
      <main className="max-w-7xl mx-auto px-6 pb-12">
        {currentStep === 1 && (
          <UploadStep
            parcelCoordinates={parcelCoordinates}
            onCoordinatesLoaded={handleCoordinatesLoaded}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <BeaconStep
            parcelCoordinates={parcelCoordinates}
            onBack={() => setCurrentStep(1)}
            onNext={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 3 && (
          <SubdivisionStep
            parcelCoordinates={parcelCoordinates}
            plots={plots}
            beacons={beacons}
            onBack={() => setCurrentStep(2)}
            onSubdivisionComplete={handleSubdivisionComplete}
          />
        )}

        {currentStep === 4 && (
          <AIStep
            parcelCoordinates={parcelCoordinates}
            plots={plots}
            beacons={beacons}
            suggestions={suggestions}
            onBack={() => setCurrentStep(3)}
            onNext={() => setCurrentStep(5)}
          />
        )}

        {currentStep === 5 && (
          <ExportStep
            projectName={project?.name || 'Project'}
            clientName={project?.client_name || undefined}
            parcelCoordinates={parcelCoordinates}
            plots={plots}
            beacons={beacons}
            onBack={() => setCurrentStep(4)}
            onComplete={handleProjectComplete}
          />
        )}
      </main>
    </div>
  );
}
