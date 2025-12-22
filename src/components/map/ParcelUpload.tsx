import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { parseCSVCoordinates } from '@/lib/geometry';
import { Coordinate } from '@/types/survey';
import { toast } from 'sonner';

interface ParcelUploadProps {
  onCoordinatesLoaded: (coordinates: Coordinate[], crs?: string) => void;
}

export function ParcelUpload({ onCoordinatesLoaded }: ParcelUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    const text = await file.text();
    
    try {
      const coordinates = parseCSVCoordinates(text);
      
      if (coordinates.length < 3) {
        setParseError('At least 3 coordinates are required to define a parcel');
        return;
      }

      setParseError(null);
      setParsedCount(coordinates.length);
      onCoordinatesLoaded(coordinates);
      toast.success(`Successfully loaded ${coordinates.length} coordinates`);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
      toast.error('Failed to parse coordinate file');
    }
  }, [onCoordinatesLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  const handleManualInput = useCallback(() => {
    if (!manualInput.trim()) {
      setParseError('Please enter coordinate data');
      return;
    }

    try {
      const coordinates = parseCSVCoordinates(manualInput);
      
      if (coordinates.length < 3) {
        setParseError('At least 3 coordinates are required to define a parcel');
        return;
      }

      setParseError(null);
      setParsedCount(coordinates.length);
      onCoordinatesLoaded(coordinates);
      toast.success(`Successfully loaded ${coordinates.length} coordinates`);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse coordinates');
    }
  }, [manualInput, onCoordinatesLoaded]);

  const loadSampleData = useCallback(() => {
    // Sample parcel coordinates (a simple polygon)
    const sampleCoordinates: Coordinate[] = [
      { lat: -1.2921, lng: 36.8219 },
      { lat: -1.2921, lng: 36.8239 },
      { lat: -1.2941, lng: 36.8239 },
      { lat: -1.2941, lng: 36.8219 },
    ];

    setParsedCount(sampleCoordinates.length);
    setParseError(null);
    onCoordinatesLoaded(sampleCoordinates);
    toast.success('Sample parcel loaded');
  }, [onCoordinatesLoaded]);

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-survey-primary" />
          Upload Parent Parcel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drag and Drop Zone */}
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-all
            ${dragActive 
              ? 'border-survey-primary bg-survey-primary/10' 
              : 'border-border hover:border-survey-primary/50'
            }
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop a CSV file with coordinates
          </p>
          <p className="text-xs text-muted-foreground">
            Format: latitude,longitude (one per line)
          </p>
        </div>

        {/* Manual Input */}
        <div className="space-y-2">
          <Label htmlFor="coordinates">Or paste coordinates manually</Label>
          <Textarea
            id="coordinates"
            placeholder={`-1.2921, 36.8219
-1.2921, 36.8239
-1.2941, 36.8239
-1.2941, 36.8219`}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="font-mono text-sm h-32"
          />
        </div>

        {/* Status Messages */}
        {parseError && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {parseError}
          </div>
        )}

        {parsedCount !== null && !parseError && (
          <div className="flex items-center gap-2 text-survey-success text-sm">
            <CheckCircle className="h-4 w-4" />
            {parsedCount} coordinates loaded successfully
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleManualInput} className="flex-1">
            Load Coordinates
          </Button>
          <Button variant="outline" onClick={loadSampleData}>
            Load Sample
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
