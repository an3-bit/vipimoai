import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, MapPin, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { parseCoordinateFile } from '@/lib/geometry';
import { Coordinate } from '@/types/survey';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ParcelUploadProps {
  onCoordinatesLoaded: (coordinates: Coordinate[], crs?: string) => void;
}

export function ParcelUpload({ onCoordinatesLoaded }: ParcelUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

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
    setFileName(file.name);
    
    try {
      const coordinates = parseCoordinateFile(text, file.name);
      
      if (coordinates.length < 3) {
        setParseError('At least 3 coordinates are required to define a parcel boundary');
        setParsedCount(null);
        return;
      }

      setParseError(null);
      setParsedCount(coordinates.length);
      onCoordinatesLoaded(coordinates);
      toast.success(`Loaded ${coordinates.length} boundary points from ${file.name}`);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
      setParsedCount(null);
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
      const coordinates = parseCoordinateFile(manualInput);
      
      if (coordinates.length < 3) {
        setParseError('At least 3 coordinates are required to define a parcel boundary');
        setParsedCount(null);
        return;
      }

      setParseError(null);
      setParsedCount(coordinates.length);
      setFileName(null);
      onCoordinatesLoaded(coordinates);
      toast.success(`Loaded ${coordinates.length} boundary points`);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse coordinates');
      setParsedCount(null);
    }
  }, [manualInput, onCoordinatesLoaded]);

  const loadSampleData = useCallback(() => {
    const sampleCoordinates: Coordinate[] = [
      { lat: -1.2921, lng: 36.8219 },
      { lat: -1.2921, lng: 36.8239 },
      { lat: -1.2941, lng: 36.8239 },
      { lat: -1.2941, lng: 36.8219 },
    ];

    setParsedCount(sampleCoordinates.length);
    setParseError(null);
    setFileName('sample_parcel.csv');
    onCoordinatesLoaded(sampleCoordinates);
    toast.success('Sample parcel loaded');
  }, [onCoordinatesLoaded]);

  const clearData = useCallback(() => {
    setParsedCount(null);
    setParseError(null);
    setFileName(null);
    setManualInput('');
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-5 w-5 text-primary" />
        <Label className="text-base font-medium">Parcel Boundary Coordinates</Label>
      </div>

      {/* Success State */}
      {parsedCount !== null && !parseError && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/30">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">{parsedCount} boundary points loaded</p>
              {fileName && <p className="text-xs opacity-80">{fileName}</p>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clearData}>
            Change
          </Button>
        </div>
      )}

      {/* Error State */}
      {parseError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{parseError}</p>
        </div>
      )}

      {/* Upload UI - only show if no data loaded */}
      {parsedCount === null && (
        <>
          {/* Drag and Drop Zone */}
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer
              ${dragActive 
                ? 'border-primary bg-primary/10' 
                : 'border-border hover:border-primary/50 hover:bg-secondary/30'
              }
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv,.txt,.geojson,.json"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              Drop your geo file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              CSV, TXT, GeoJSON • Total station exports supported
            </p>
          </div>

          {/* Manual Input Accordion */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="manual" className="border-none">
              <AccordionTrigger className="text-sm text-muted-foreground hover:no-underline py-2">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Paste coordinates manually
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <div className="space-y-3">
                  <Textarea
                    placeholder={`Paste coordinates in any format:\n\nCSV: lat, lng\n-1.2921, 36.8219\n-1.2921, 36.8239\n\nOr with point IDs:\nP1, -1.2921, 36.8219\nP2, -1.2921, 36.8239`}
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="font-mono text-xs h-32 bg-secondary/30"
                  />
                  <Button onClick={handleManualInput} size="sm" className="w-full">
                    Parse Coordinates
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Format Help */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Supported formats:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>CSV/TXT with lat, lng columns</li>
                <li>Total station exports (point ID, easting, northing)</li>
                <li>GeoJSON (Polygon, MultiPolygon, LineString)</li>
              </ul>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSampleData} className="flex-1">
              Load Sample Data
            </Button>
          </div>
        </>
      )}
    </div>
  );
}