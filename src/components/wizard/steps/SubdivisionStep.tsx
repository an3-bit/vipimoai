import { useState } from 'react';
import { Settings, ArrowLeft, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SurveyMap } from '@/components/map/SurveyMap';
import { SubdivisionForm } from '@/components/subdivision/SubdivisionForm';
import { Coordinate, Plot, Beacon, AISuggestion } from '@/types/survey';
import { formatArea, calculateArea } from '@/lib/geometry';

interface SubdivisionStepProps {
  parcelCoordinates: Coordinate[];
  plots: Plot[];
  beacons: Beacon[];
  onBack: () => void;
  onSubdivisionComplete: (plots: Plot[], beacons: Beacon[], suggestions: AISuggestion[]) => void;
}

export function SubdivisionStep({
  parcelCoordinates,
  plots,
  beacons,
  onBack,
  onSubdivisionComplete,
}: SubdivisionStepProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Form */}
      <div className="space-y-4">
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-survey-primary" />
              Step 3: Configure Subdivision
            </CardTitle>
            <CardDescription>
              Set plot dimensions, strategy, and setback rules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SubdivisionForm
              parcelCoordinates={parcelCoordinates}
              onSubdivisionComplete={onSubdivisionComplete}
            />
          </CardContent>
        </Card>

        <Button variant="outline" size="lg" className="w-full" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Beacons
        </Button>
      </div>

      {/* Right: Map Preview */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Subdivision Preview</span>
              {plots.length > 0 && (
                <span className="text-survey-success font-normal">
                  {plots.length} plots generated
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SurveyMap
              parcelCoordinates={parcelCoordinates}
              plots={plots}
              beacons={beacons}
              className="h-[400px]"
            />
          </CardContent>
        </Card>

        {/* Stats */}
        {plots.length > 0 && (
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
                <div>
                  <p className="text-2xl font-bold text-survey-accent">
                    {plots.length > 0
                      ? formatArea(plots.reduce((sum, p) => sum + p.area_sqm, 0) / plots.length)
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Plot Size</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
