import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileJson, Send, CheckCircle, FileOutput, Loader2, AlertTriangle, User } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectPlots, useProject } from '@/hooks/useSurvey';
import { useProfile } from '@/hooks/useProfile';
import { sqmToHectares } from '@/lib/geometry';
import { generateArdhisasaJSON, generatePDF, generateFormLRA27, downloadFile } from '@/lib/exports';
import { Coordinate, Beacon } from '@/types/survey';

interface MutationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  clientName?: string;
  parcelAreaSqm?: number;
}

export function MutationFormModal({ 
  open, 
  onOpenChange, 
  projectId, 
  projectName = 'Project',
  clientName,
  parcelAreaSqm = 0,
}: MutationFormModalProps) {
  // Fetch surveyor profile for dynamic header
  const { data: profile } = useProfile();
  // Fetch project including parent parcel coordinates
  const { data: project } = useProject(projectId);
  // Fetch real plot data from Supabase/MySQL
  const { data: plots, isLoading } = useProjectPlots(projectId);

  const motherTitle = `${projectName.toUpperCase().replace(/\s+/g, '/')}/0000`;
  
  const parcelCoords = project?.parcels?.[0]?.coordinates as Coordinate[] || [];
  const parcelArea = Number(project?.parcels?.[0]?.area_sqm) || parcelAreaSqm || 0;
  const perimeter = Number(project?.parcels?.[0]?.perimeter_m) || 0;
  const totalAreaHa = sqmToHectares(parcelArea);

  // Transform plots to child titles with HECTARES
  const childTitles = (plots || []).map((plot: any, index: number) => {
    const plotAreaHa = sqmToHectares(plot.area_sqm || 465);
    return {
      plotNo: plot.plot_number || index + 1,
      newTitle: `${projectName.toUpperCase().replace(/\s+/g, '/')}/${String(plot.plot_number || index + 1).padStart(4, '0')}`,
      areaHa: plotAreaHa.toFixed(4),
      areaSqm: plot.area_sqm?.toFixed(0) || '465',
      status: plot.status === 'valid' ? 'Approved' : plot.status === 'invalid' ? 'Rejected' : 'Pending',
    };
  });

  // Reconstruct unique beacons list from plot corners
  const getBeaconsList = (): Beacon[] => {
    const list: Beacon[] = [];
    let beaconNum = 1;
    const seen = new Set<string>();
    
    (plots || []).forEach((plot: any) => {
      (plot.coordinates || []).forEach((coord: Coordinate) => {
        const key = `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            id: crypto.randomUUID(),
            beacon_number: beaconNum++,
            latitude: coord.lat,
            longitude: coord.lng,
            description: `BK${beaconNum - 1}`,
          });
        }
      });
    });

    return list;
  };

  const handleExportArdhisasa = async () => {
    toast.info('Generating Ardhisasa-compliant JSON...');
    
    try {
      const beacons = getBeaconsList();
      const exportData = {
        project: {
          name: projectName,
          clientName,
          date: new Date().toLocaleDateString(),
          motherTitle,
        },
        parcel: {
          coordinates: parcelCoords,
          areaSqm: parcelArea,
          perimeterM: perimeter,
        },
        plots: (plots || []).map((plot: any) => ({
          id: plot.id || `plot-${plot.plot_number}`,
          plot_number: plot.plot_number,
          coordinates: plot.coordinates || [],
          area_sqm: plot.area_sqm || 0,
          width_m: plot.width_m,
          depth_m: plot.depth_m,
          is_partial: plot.is_partial,
        })),
        beacons,
      };

      const json = generateArdhisasaJSON(exportData);
      downloadFile(json, `${projectName.replace(/\s+/g, '_')}_ardhisasa.json`, 'application/json');
      toast.success('Ardhisasa JSON exported successfully');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleExportPDF = async () => {
    toast.info('Generating PDF Mutation Form...');
    
    try {
      const beacons = getBeaconsList();
      const exportData = {
        project: {
          name: projectName,
          clientName,
          date: new Date().toLocaleDateString(),
          motherTitle,
        },
        parcel: {
          coordinates: parcelCoords,
          areaSqm: parcelArea,
          perimeterM: perimeter,
        },
        plots: (plots || []).map((plot: any) => ({
          id: plot.id || `plot-${plot.plot_number}`,
          plot_number: plot.plot_number,
          coordinates: plot.coordinates || [],
          area_sqm: plot.area_sqm || 0,
          width_m: plot.width_m,
          depth_m: plot.depth_m,
          is_partial: plot.is_partial,
        })),
        beacons,
      };

      const pdfBlob = await generatePDF(exportData);
      downloadFile(pdfBlob, `${projectName.replace(/\s+/g, '_')}_mutation_form.pdf`);
      toast.success('PDF Mutation Form exported successfully');
    } catch (error) {
      toast.error('PDF export failed');
    }
  };

  const handleExportFormLRA27 = async () => {
    toast.info('Generating official Form LRA 27...');
    
    try {
      const beacons = getBeaconsList();
      const exportData = {
        project: {
          name: projectName,
          clientName: clientName || 'Registered Owner',
          date: new Date().toLocaleDateString(),
          motherTitle,
          surveyorLicense: profile?.license_number || 'LS/2026/0921',
          surveyorName: profile?.full_name || 'Licensed Surveyor',
        },
        parcel: {
          coordinates: parcelCoords,
          areaSqm: parcelArea,
          perimeterM: perimeter,
        },
        plots: (plots || []).map((plot: any) => ({
          id: plot.id || `plot-${plot.plot_number}`,
          plot_number: plot.plot_number,
          coordinates: plot.coordinates || [],
          area_sqm: plot.area_sqm || 0,
          width_m: plot.width_m,
          depth_m: plot.depth_m,
          is_partial: plot.is_partial,
        })),
        beacons,
      };

      const pdfBlob = await generateFormLRA27(exportData);
      downloadFile(pdfBlob, `${projectName.replace(/\s+/g, '_')}_form_LRA_27.pdf`);
      toast.success('Official Form LRA 27 PDF exported successfully');
    } catch (error) {
      console.error(error);
      toast.error('Form LRA 27 export failed');
    }
  };

  const plotCount = childTitles.length;
  const approvedCount = childTitles.filter(t => t.status === 'Approved').length;
  const rejectedCount = childTitles.filter(t => t.status === 'Rejected').length;

  // Calculate actual efficiency
  const totalPlotArea = (plots || []).reduce((sum: number, p: any) => sum + (p.area_sqm || 0), 0);
  const efficiency = parcelArea > 0 ? ((totalPlotArea / parcelArea) * 100).toFixed(1) : '0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] glass-panel border-border/50 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <FileOutput className="h-5 w-5 text-primary" />
            </div>
            Mutation Form Preview
          </DialogTitle>
          <DialogDescription>
            Ardhisasa-compliant mutation form for land subdivision
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading plot data...</span>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="p-6 space-y-6">
              {/* Government Form Header - ARDHISASA STANDARD */}
              <div className="border border-border rounded-lg p-6 bg-secondary/30">
                <div className="text-center mb-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Republic of Kenya</p>
                  <h2 className="text-lg font-bold mt-1">THE LAND REGISTRATION ACT</h2>
                  <p className="text-sm text-muted-foreground">(Cap 300 Laws of Kenya)</p>
                  <div className="mt-4 inline-block px-4 py-2 bg-primary/10 rounded-lg">
                    <p className="text-xl font-bold text-primary">FORM LRA 27</p>
                    <p className="text-xs text-muted-foreground">Mutation Form</p>
                  </div>
                </div>

                {/* Mother Title Info */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Mother Title</p>
                      <p className="font-mono font-semibold">{motherTitle}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Registered Owner</p>
                      <p className="font-semibold">{clientName || `${projectName} Limited`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Original Area</p>
                      <p className="font-mono font-bold text-primary">{totalAreaHa.toFixed(4)} Ha</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Survey File Reference</p>
                      <p className="font-mono font-semibold">FR/{projectName.split(' ')[0]?.toUpperCase()}/2024/0456</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Licensed Surveyor
                      </p>
                      <p className="font-semibold">{profile?.full_name || 'Not Set'}</p>
                      <p className="font-mono text-sm text-primary">{profile?.license_number || 'License Not Set'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Application Date</p>
                      <p className="font-mono">{new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg border border-warning/30">
                  <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Status: CLOSED (Pending Mutation)</p>
                    <p className="text-xs text-muted-foreground">Ready for subdivision into child titles</p>
                  </div>
                </div>
              </div>

              {/* Child Titles Table - WITH HECTARES */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="p-4 border-b border-border bg-secondary/30">
                  <h3 className="font-semibold">Proposed Child Titles ({plotCount})</h3>
                </div>
                {plotCount === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-warning" />
                    No plots generated yet. Use Auto-Subdivide to generate plots.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead className="w-16">Plot #</TableHead>
                        <TableHead>New Title Number</TableHead>
                        <TableHead>Area (Ha)</TableHead>
                        <TableHead>Area (m²)</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {childTitles.slice(0, 20).map((title) => (
                        <TableRow key={title.plotNo}>
                          <TableCell className="font-mono">{title.plotNo}</TableCell>
                          <TableCell className="font-mono font-semibold">{title.newTitle}</TableCell>
                          <TableCell className="font-mono font-bold text-primary">{title.areaHa} Ha</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{title.areaSqm} m²</TableCell>
                          <TableCell className="text-right">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                              title.status === 'Approved' 
                                ? 'bg-success/20 text-success' 
                                : title.status === 'Rejected'
                                ? 'bg-destructive/20 text-destructive'
                                : 'bg-warning/20 text-warning'
                            }`}>
                              {title.status === 'Approved' && <CheckCircle className="h-3 w-3" />}
                              {title.status === 'Rejected' && <AlertTriangle className="h-3 w-3" />}
                              {title.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {plotCount > 20 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            ... and {plotCount - 20} more plots
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 border border-border rounded-lg text-center bg-secondary/30">
                  <p className="text-2xl font-bold text-primary">{plotCount}</p>
                  <p className="text-xs text-muted-foreground">Total Plots</p>
                </div>
                <div className="p-4 border border-border rounded-lg text-center bg-secondary/30">
                  <p className="text-2xl font-bold text-primary">{efficiency}%</p>
                  <p className="text-xs text-muted-foreground">Land Utilization</p>
                </div>
                <div className="p-4 border border-border rounded-lg text-center bg-secondary/30">
                  <p className="text-2xl font-bold text-success">{approvedCount}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
                <div className="p-4 border border-border rounded-lg text-center bg-secondary/30">
                  <p className="text-2xl font-bold text-destructive">{rejectedCount}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* Action Buttons */}
        <div className="p-6 border-t border-border/50 flex items-center justify-between bg-secondary/30">
          <p className="text-sm text-muted-foreground">
            {plotCount > 0 ? 'Ready for submission to Ardhisasa portal' : 'Generate plots first'}
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleExportArdhisasa}
              disabled={plotCount === 0}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Export for Ardhisasa (JSON)
            </Button>
            <Button 
              variant="outline"
              onClick={handleExportFormLRA27}
              disabled={plotCount === 0}
              className="border-primary/50 text-primary hover:bg-primary/10"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Form LRA 27
            </Button>
            <Button 
              variant="outline"
              onClick={handleExportPDF}
              disabled={plotCount === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download RL 7A PDF
            </Button>
            <Button 
              onClick={() => toast.info('Email integration coming soon')}
              disabled={plotCount === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              Send to Client
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
