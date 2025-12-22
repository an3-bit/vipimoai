import { Download, ArrowLeft, FileText, Map, Layers, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SurveyMap } from '@/components/map/SurveyMap';
import { ExportDialog } from '@/components/export/ExportDialog';
import { Coordinate, Plot, Beacon } from '@/types/survey';
import { formatArea, calculateArea } from '@/lib/geometry';

interface ExportStepProps {
  projectName: string;
  clientName?: string;
  parcelCoordinates: Coordinate[];
  plots: Plot[];
  beacons: Beacon[];
  onBack: () => void;
  onComplete: () => void;
}

export function ExportStep({
  projectName,
  clientName,
  parcelCoordinates,
  plots,
  beacons,
  onBack,
  onComplete,
}: ExportStepProps) {
  const exportTypes = [
    {
      icon: FileText,
      title: 'PDF Report',
      description: 'Mutation map and beacon list',
      format: 'pdf',
    },
    {
      icon: Layers,
      title: 'GeoJSON',
      description: 'Standard GIS format',
      format: 'geojson',
    },
    {
      icon: Map,
      title: 'KML',
      description: 'Google Earth compatible',
      format: 'kml',
    },
    {
      icon: Download,
      title: 'CSV',
      description: 'Beacon coordinate table',
      format: 'csv',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Export Options */}
      <div className="space-y-4">
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-survey-primary" />
              Step 5: Export Outputs
            </CardTitle>
            <CardDescription>
              Generate professional outputs for your subdivision
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-survey-success/10 border border-survey-success/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-survey-success" />
                <span className="font-medium text-survey-success">Ready to Export</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Project:</span>
                  <span className="ml-1 font-medium">{projectName}</span>
                </div>
                {clientName && (
                  <div>
                    <span className="text-muted-foreground">Client:</span>
                    <span className="ml-1 font-medium">{clientName}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Plots:</span>
                  <span className="ml-1 font-medium">{plots.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Beacons:</span>
                  <span className="ml-1 font-medium">{beacons.length}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Total Area:</span>
                  <span className="ml-1 font-medium">{formatArea(calculateArea(parcelCoordinates))}</span>
                </div>
              </div>
            </div>

            {/* Export Types Preview */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Available Formats</h4>
              <div className="grid grid-cols-2 gap-2">
                {exportTypes.map((type) => (
                  <div
                    key={type.format}
                    className="p-3 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <type.icon className="h-5 w-5 text-survey-primary mb-1" />
                    <p className="text-xs font-medium">{type.title}</p>
                    <p className="text-[10px] text-muted-foreground">{type.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Button */}
            <ExportDialog
              projectName={projectName}
              clientName={clientName}
              parcelCoordinates={parcelCoordinates}
              plots={plots}
              beacons={beacons}
              disabled={plots.length === 0}
            />
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="survey" size="lg" className="flex-1" onClick={onComplete}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete Project
          </Button>
        </div>
      </div>

      {/* Right: Final Map */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Final Subdivision Map
            </CardTitle>
            <CardDescription>
              {plots.length} plots • {beacons.length} beacons • {parcelCoordinates.length} vertices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SurveyMap
              parcelCoordinates={parcelCoordinates}
              plots={plots}
              beacons={beacons}
              className="h-[500px]"
              showSatellite
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
