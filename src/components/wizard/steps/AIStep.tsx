import { useState } from 'react';
import { Cpu, ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, Move, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SurveyMap } from '@/components/map/SurveyMap';
import { InteractiveMapEditor } from '@/components/map/InteractiveMapEditor';
import { SuggestionsPanel } from '@/components/subdivision/SuggestionsPanel';
import { Coordinate, Plot, Beacon, AISuggestion } from '@/types/survey';
import { formatArea } from '@/lib/geometry';

interface AIStepProps {
  parcelCoordinates: Coordinate[];
  plots: Plot[];
  beacons: Beacon[];
  suggestions: AISuggestion[];
  onBack: () => void;
  onNext: () => void;
  onPlotsUpdate: (plots: Plot[]) => void;
}

export function AIStep({
  parcelCoordinates,
  plots,
  beacons,
  suggestions,
  onBack,
  onNext,
  onPlotsUpdate,
}: AIStepProps) {
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const hasResults = plots.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Results Summary */}
      <div className="space-y-4">
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-survey-primary" />
              Step 4: AI Results
            </CardTitle>
            <CardDescription>
              Review and adjust the AI-generated subdivision layout
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasResults ? (
              <>
                <div className="rounded-lg bg-survey-success/10 border border-survey-success/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-survey-success" />
                    <span className="font-medium text-survey-success">Subdivision Complete</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Generated {plots.length} plots with {beacons.length} beacons
                  </p>
                </div>

                {/* Edit Mode Toggle */}
                <div className="rounded-lg bg-survey-primary/10 border border-survey-primary/30 p-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Switch to Edit mode to drag plot corners and fine-tune boundaries
                  </p>
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'preview' | 'edit')}>
                    <TabsList className="w-full">
                      <TabsTrigger value="preview" className="flex-1">
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                      </TabsTrigger>
                      <TabsTrigger value="edit" className="flex-1">
                        <Move className="h-3 w-3 mr-1" />
                        Edit
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Plot Summary */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Plot Summary</h4>
                  <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1">
                    {plots.map((plot) => (
                      <div
                        key={plot.id}
                        className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
                      >
                        <span className="font-medium">Plot {plot.plot_number}</span>
                        <span className="text-muted-foreground">
                          {formatArea(plot.area_sqm)}
                          {plot.is_partial && (
                            <span className="ml-2 text-warning text-xs">(partial)</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg bg-warning/10 border border-warning/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <span className="font-medium text-warning">No Subdivision Yet</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Go back to Step 3 and run the subdivision to generate plots.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <SuggestionsPanel suggestions={suggestions} />
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            variant="survey"
            size="lg"
            className="flex-1"
            onClick={onNext}
            disabled={!hasResults}
          >
            Export
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Right: Map */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>{viewMode === 'edit' ? 'Interactive Editor' : 'Final Layout'}</span>
              {viewMode === 'edit' && (
                <span className="text-xs font-normal text-survey-primary flex items-center gap-1">
                  <Move className="h-3 w-3" />
                  Drag corners to adjust
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {viewMode === 'edit'
                ? 'Drag the corner markers to fine-tune plot boundaries'
                : 'Review plots and beacons before exporting'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {viewMode === 'edit' ? (
              <InteractiveMapEditor
                parcelCoordinates={parcelCoordinates}
                plots={plots}
                onPlotsUpdate={onPlotsUpdate}
                className="h-[500px]"
                showSatellite
              />
            ) : (
              <SurveyMap
                parcelCoordinates={parcelCoordinates}
                plots={plots}
                beacons={beacons}
                className="h-[500px]"
                showSatellite
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
