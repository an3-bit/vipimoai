import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, MapPin, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { parseCoordinateFile } from '@/lib/geometry';
import { parseDXF, validateDXFFile, extractBoundaryFromDXF } from '@/lib/dxfParser';
import { detectCRS, convertCoordinatesFromUTM } from '@/lib/coordinates';
import { Coordinate } from '@/types/survey';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface ParcelUploadProps {
  onCoordinatesLoaded: (coordinates: Coordinate[], crs?: string) => void;
}

export function ParcelUpload({ onCoordinatesLoaded }: ParcelUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [crsWarning, setCrsWarning] = useState<string | null>(null);
  const [detectedCRS, setDetectedCRS] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processCoordinates = useCallback((coordinates: Coordinate[], fileName?: string) => {
    // Detect CRS
    const crsResult = detectCRS(coordinates);
    setDetectedCRS(crsResult.detectedCRS);

    let finalCoordinates = coordinates;

    if (crsResult.suggestedConversion && crsResult.detectedCRS === 'UTM') {
      // Auto-convert UTM to WGS84
      setCrsWarning(crsResult.message);
      toast.warning('UTM coordinates detected - auto-converting to WGS84');
      
      finalCoordinates = convertCoordinatesFromUTM(coordinates);
      toast.success(`Converted ${coordinates.length} UTM coordinates to WGS84`);
    } else {
      setCrsWarning(null);
    }

    if (finalCoordinates.length < 3) {
      setParseError('At least 3 coordinates are required to define a parcel boundary');
      setParsedCount(null);
      return;
    }

    setParseError(null);
    setParsedCount(finalCoordinates.length);
    onCoordinatesLoaded(finalCoordinates, crsResult.detectedCRS);
    toast.success(`Loaded ${finalCoordinates.length} boundary points${fileName ? ` from ${fileName}` : ''}`);
  }, [onCoordinatesLoaded]);

  const processFile = useCallback(async (file: File) => {
    const text = await file.text();
    const extension = file.name.split('.').pop()?.toLowerCase();
    setFileName(file.name);
    setCrsWarning(null);
    
    try {
      let coordinates: Coordinate[] = [];

      // Handle DXF files
      if (extension === 'dxf') {
        const validation = validateDXFFile(text);
        if (!validation.valid) {
          setParseError(validation.message);
          setParsedCount(null);
          toast.error('Invalid DXF file');
          return;
        }

        const dxfResult = parseDXF(text);
        
        if (!dxfResult.success) {
          setParseError(dxfResult.errors.join('. '));
          setParsedCount(null);
          toast.error('Failed to parse DXF file');
          return;
        }

        if (dxfResult.warnings.length > 0) {
          toast.warning(dxfResult.warnings.join('. '));
        }

        coordinates = dxfResult.coordinates;
        toast.info(`DXF parsed: ${dxfResult.entityCount} entities (${dxfResult.entityTypes.join(', ')})`);
      } else {
        // Handle CSV, TXT, GeoJSON
        coordinates = parseCoordinateFile(text, file.name);
      }

      processCoordinates(coordinates, file.name);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
      setParsedCount(null);
      toast.error('Failed to parse coordinate file');
    }
  }, [processCoordinates]);

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
      processCoordinates(coordinates);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse coordinates');
      setParsedCount(null);
    }
  }, [manualInput, processCoordinates]);

  const loadSampleData = useCallback(() => {
    // 40-acre parcel in Juja, Kenya
    const sampleCoordinates: Coordinate[] = [
      { lat: -1.1120, lng: 37.1140 },
      { lat: -1.1120, lng: 37.1220 },
      { lat: -1.1180, lng: 37.1220 },
      { lat: -1.1180, lng: 37.1140 },
    ];

    setParsedCount(sampleCoordinates.length);
    setParseError(null);
    setCrsWarning(null);
    setFileName('sample_juja_40acre.csv');
    setDetectedCRS('WGS84');
    onCoordinatesLoaded(sampleCoordinates, 'WGS84');
    toast.success('Sample 40-acre Juja parcel loaded');
  }, [onCoordinatesLoaded]);

  const clearData = useCallback(() => {
    setParsedCount(null);
    setParseError(null);
    setFileName(null);
    setManualInput('');
    setCrsWarning(null);
    setDetectedCRS(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-5 w-5 text-primary" />
        <Label className="text-base font-medium">Parcel Boundary Coordinates</Label>
      </div>

      {/* CRS Warning */}
      {crsWarning && (
        <Alert className="border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>Coordinate System Detected</AlertTitle>
          <AlertDescription className="text-sm">
            {crsWarning}
            {detectedCRS === 'UTM' && (
              <span className="block mt-1 text-xs">
                Coordinates have been auto-converted from Arc 1960 / UTM Zone 37N to WGS84 for map display.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Success State */}
      {parsedCount !== null && !parseError && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/30">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">{parsedCount} boundary points loaded</p>
              <p className="text-xs opacity-80">
                {fileName && `${fileName} • `}
                {detectedCRS && `CRS: ${detectedCRS}`}
              </p>
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
              accept=".csv,.txt,.geojson,.json,.dxf"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              Drop your geo file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              CSV, TXT, GeoJSON, <span className="text-primary font-medium">DXF (AutoCAD/Leica)</span>
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
                    placeholder={`Paste coordinates in any format:\n\nWGS84 (lat, lng):\n-1.2921, 36.8219\n-1.2921, 36.8239\n\nUTM (will auto-convert):\n9856234.123, 234567.890\n9856234.456, 234567.234`}
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
                <li><span className="font-medium text-primary">DXF</span> - AutoCAD, Leica, Trimble exports</li>
                <li>CSV/TXT - lat, lng or Easting, Northing columns</li>
                <li>GeoJSON - Polygon, MultiPolygon, LineString</li>
                <li><span className="font-medium">UTM/Arc 1960</span> coordinates auto-converted</li>
              </ul>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSampleData} className="flex-1">
              Load Sample (Juja 40-Acre)
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
