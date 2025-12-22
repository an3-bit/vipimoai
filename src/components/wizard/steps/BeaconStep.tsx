import { useState } from 'react';
import { MapPin, CheckCircle, Navigation, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SurveyMap } from '@/components/map/SurveyMap';
import { Coordinate } from '@/types/survey';
import { formatCoordinate } from '@/lib/geometry';

interface BeaconStepProps {
  parcelCoordinates: Coordinate[];
  onBack: () => void;
  onNext: () => void;
}

export function BeaconStep({ parcelCoordinates, onBack, onNext }: BeaconStepProps) {
  const [hoveredCoord, setHoveredCoord] = useState<Coordinate | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Beacon List */}
      <div className="space-y-4">
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-survey-beacon" />
              Step 2: Confirm Beacons
            </CardTitle>
            <CardDescription>
              Review the parcel boundary vertices. Hover over points on the map to see coordinates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
              {parcelCoordinates.map((coord, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-md font-mono text-xs border transition-all cursor-pointer ${
                    selectedVertex === index
                      ? 'border-survey-beacon bg-survey-beacon/10'
                      : 'border-border/50 bg-muted/30 hover:border-survey-beacon/50'
                  }`}
                  onClick={() => setSelectedVertex(selectedVertex === index ? null : index)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-survey-beacon flex items-center gap-1">
                      <Navigation className="h-3 w-3" />
                      Vertex {index + 1}
                    </span>
                    {selectedVertex === index && (
                      <CheckCircle className="h-4 w-4 text-survey-success" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>Lat: {formatCoordinate(coord.lat)}</span>
                    <span>Lng: {formatCoordinate(coord.lng)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Hover Info */}
        {hoveredCoord && (
          <Card className="bg-survey-primary/10 border-survey-primary/30">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground mb-1">Mouse Position</p>
              <p className="font-mono text-sm">
                <span className="text-survey-primary">{formatCoordinate(hoveredCoord.lat)}</span>
                <span className="text-muted-foreground mx-2">,</span>
                <span className="text-survey-accent">{formatCoordinate(hoveredCoord.lng)}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="survey" size="lg" className="flex-1" onClick={onNext}>
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Right: Map */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Parcel Boundary Inspection
            </CardTitle>
            <CardDescription>
              Hover over vertices to view coordinates. {parcelCoordinates.length} boundary points detected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SurveyMap
              parcelCoordinates={parcelCoordinates}
              onCoordinateHover={setHoveredCoord}
              className="h-[500px]"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
