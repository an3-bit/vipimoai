import { useState } from 'react';
import { Download, FileText, Map, Database, Loader2, Check, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Coordinate, Plot, Beacon } from '@/types/survey';
import { calculateArea, calculatePerimeter } from '@/lib/geometry';
import {
  generatePDF,
  generateGeoJSON,
  generateKML,
  generateBeaconCSV,
  downloadFile,
} from '@/lib/exports';
import { generateMutationJSON, downloadMutationJSON, DrawingScale } from '@/lib/mutationExport';
import { toast } from 'sonner';

interface ExportDialogProps {
  projectName: string;
  clientName?: string;
  surveyorLicense?: string;
  surveyorName?: string;
  parcelCoordinates: Coordinate[];
  plots: Plot[];
  beacons: Beacon[];
  disabled?: boolean;
}

type ExportFormat = 'pdf' | 'geojson' | 'kml' | 'csv' | 'json';

export function ExportDialog({
  projectName,
  clientName,
  surveyorLicense,
  surveyorName,
  parcelCoordinates,
  plots,
  beacons,
  disabled,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<ExportFormat[]>(['pdf']);
  const [exporting, setExporting] = useState(false);
  const [completed, setCompleted] = useState<ExportFormat[]>([]);
  const [drawingScale, setDrawingScale] = useState<DrawingScale>('1:2500');

  const toggleFormat = (format: ExportFormat) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const getExportData = () => {
    const areaSqm = calculateArea(parcelCoordinates);
    const perimeterM = calculatePerimeter(parcelCoordinates);
    return {
      project: {
        name: projectName,
        clientName,
        date: new Date().toLocaleDateString(),
        surveyorLicense,
      },
      parcel: {
        coordinates: parcelCoordinates,
        areaSqm,
        perimeterM,
      },
      plots,
      beacons,
      // Additional data for JSON export
      areaSqm,
      perimeterM,
    };
  };

  const handleExport = async () => {
    if (selectedFormats.length === 0) {
      toast.error('Please select at least one export format');
      return;
    }

    setExporting(true);
    setCompleted([]);
    const data = getExportData();
    const safeName = projectName.replace(/[^a-zA-Z0-9]/g, '_');

    try {
      for (const format of selectedFormats) {
        switch (format) {
          case 'pdf':
            const pdfBlob = await generatePDF(data);
            downloadFile(pdfBlob, `${safeName}_mutation_map.pdf`);
            break;
          case 'geojson':
            const geojson = generateGeoJSON(data);
            downloadFile(geojson, `${safeName}.geojson`, 'application/geo+json');
            break;
          case 'kml':
            const kml = generateKML(data);
            downloadFile(kml, `${safeName}.kml`, 'application/vnd.google-earth.kml+xml');
            break;
          case 'csv':
            const csv = generateBeaconCSV(data);
            downloadFile(csv, `${safeName}_beacons.csv`, 'text/csv');
            break;
          case 'json':
            const jsonData = generateMutationJSON({
              projectName,
              clientName,
              surveyorLicense,
              surveyorName,
              parcelCoordinates,
              parcelAreaSqm: data.areaSqm,
              perimeterM: data.perimeterM,
              plots,
              beacons,
              scale: drawingScale,
            });
            downloadMutationJSON(jsonData, `${safeName}_mutation_schema.json`);
            break;
        }
        setCompleted(prev => [...prev, format]);
        await new Promise(r => setTimeout(r, 300)); // Small delay between downloads
      }

      toast.success(`Exported ${selectedFormats.length} file(s) successfully`);
      setTimeout(() => setOpen(false), 1000);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const formats: { id: ExportFormat; label: string; description: string; icon: React.ReactNode }[] = [
    {
      id: 'pdf',
      label: 'PDF Mutation Map',
      description: 'Professional document with plots, beacons, and coordinates',
      icon: <FileText className="h-5 w-5 text-red-500" />,
    },
    {
      id: 'geojson',
      label: 'GeoJSON',
      description: 'Standard GIS format for web mapping applications',
      icon: <Map className="h-5 w-5 text-green-500" />,
    },
    {
      id: 'kml',
      label: 'KML (Google Earth)',
      description: 'View in Google Earth with styled polygons and markers',
      icon: <Map className="h-5 w-5 text-blue-500" />,
    },
    {
      id: 'csv',
      label: 'CSV Beacon List',
      description: 'Spreadsheet-compatible list of all beacon coordinates',
      icon: <Database className="h-5 w-5 text-orange-500" />,
    },
    {
      id: 'json',
      label: 'Mutation JSON Schema',
      description: 'Structured JSON for Survey of Kenya workflow integration',
      icon: <Code className="h-5 w-5 text-purple-500" />,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Survey Data</DialogTitle>
          <DialogDescription>
            Select the formats you want to export. Files will download automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-3 rounded-lg bg-muted/50 text-center">
            <div>
              <p className="text-lg font-bold text-survey-primary">{plots.length}</p>
              <p className="text-xs text-muted-foreground">Plots</p>
            </div>
            <div>
              <p className="text-lg font-bold text-survey-beacon">{beacons.length}</p>
              <p className="text-xs text-muted-foreground">Beacons</p>
            </div>
            <div>
              <p className="text-lg font-bold text-survey-accent">{parcelCoordinates.length}</p>
              <p className="text-xs text-muted-foreground">Vertices</p>
            </div>
          </div>

          <Separator />

          {/* Scale Selector for JSON export */}
          {selectedFormats.includes('json') && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Drawing Scale (for JSON export)</Label>
              <Select value={drawingScale} onValueChange={(v) => setDrawingScale(v as DrawingScale)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:500">1:500 (Detail)</SelectItem>
                  <SelectItem value="1:1000">1:1000</SelectItem>
                  <SelectItem value="1:2500">1:2500 (Standard)</SelectItem>
                  <SelectItem value="1:5000">1:5000</SelectItem>
                  <SelectItem value="1:10000">1:10000 (Overview)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Scale affects the JSON schema output for cadastral workflows
              </p>
            </div>
          )}

          <Separator />

          {/* Format Selection */}
          <div className="space-y-3">
            {formats.map(format => (
              <div
                key={format.id}
                className={`
                  flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${selectedFormats.includes(format.id)
                    ? 'border-survey-primary bg-survey-primary/5'
                    : 'border-border hover:border-survey-primary/50'
                  }
                `}
                onClick={() => !exporting && toggleFormat(format.id)}
              >
                <Checkbox
                  checked={selectedFormats.includes(format.id)}
                  onCheckedChange={() => toggleFormat(format.id)}
                  disabled={exporting}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {format.icon}
                    <Label className="font-medium cursor-pointer">{format.label}</Label>
                    {completed.includes(format.id) && (
                      <Check className="h-4 w-4 text-survey-success" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button
            variant="survey"
            onClick={handleExport}
            disabled={exporting || selectedFormats.length === 0}
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export ({selectedFormats.length})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
