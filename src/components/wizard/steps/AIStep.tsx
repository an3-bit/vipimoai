import { Cpu, ArrowLeft, ArrowRight, Lightbulb, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SurveyMap } from '@/components/map/SurveyMap';
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
}

export function AIStep({
  parcelCoordinates,
  plots,
  beacons,
  suggestions,
  onBack,
  onNext,
}: AIStepProps) {
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
              Review the AI-generated subdivision layout
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

                {/* Plot Summary */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Plot Summary</h4>
                  <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
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
            <CardTitle className="text-sm font-medium">
              Final Layout
            </CardTitle>
            <CardDescription>
              Review plots and beacons before exporting
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
