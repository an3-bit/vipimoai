import { Upload, CheckCircle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ParcelUpload } from '@/components/map/ParcelUpload';
import { SurveyMap } from '@/components/map/SurveyMap';
import { Coordinate } from '@/types/survey';
import { calculateArea, calculatePerimeter, formatArea } from '@/lib/geometry';

interface UploadStepProps {
  parcelCoordinates: Coordinate[];
  onCoordinatesLoaded: (coordinates: Coordinate[]) => void;
  onNext: () => void;
}

export function UploadStep({ parcelCoordinates, onCoordinatesLoaded, onNext }: UploadStepProps) {
  const hasParcel = parcelCoordinates.length >= 3;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Upload Form */}
      <div className="space-y-4">
        <Card variant="glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-survey-primary" />
              Step 1: Upload Parcel Coordinates
            </CardTitle>
            <CardDescription>
              Upload a CSV file with your parcel boundary coordinates or paste them manually
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ParcelUpload onCoordinatesLoaded={onCoordinatesLoaded} />
          </CardContent>
        </Card>

        {hasParcel && (
          <Card className="bg-survey-success/10 border-survey-success/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-survey-success" />
                <div className="flex-1">
                  <p className="font-medium text-survey-success">Parcel Loaded Successfully</p>
                  <p className="text-sm text-muted-foreground">
                    {parcelCoordinates.length} vertices • {formatArea(calculateArea(parcelCoordinates))} • {calculatePerimeter(parcelCoordinates).toFixed(0)}m perimeter
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          variant="survey"
          size="lg"
          className="w-full"
          onClick={onNext}
          disabled={!hasParcel}
        >
          <MapPin className="h-5 w-5 mr-2" />
          {hasParcel ? 'Continue to Beacon Inspection' : 'Upload coordinates to continue'}
        </Button>
      </div>

      {/* Right: Map Preview */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Parcel Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {hasParcel ? (
              <SurveyMap
                parcelCoordinates={parcelCoordinates}
                className="h-[400px]"
              />
            ) : (
              <div className="h-[400px] rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/20">
                <div className="text-center text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Upload coordinates to see parcel preview</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
