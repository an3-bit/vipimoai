import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileJson, FileText, Send, CheckCircle, FileOutput } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MutationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plotCount: number;
}

export function MutationFormModal({ open, onOpenChange, plotCount }: MutationFormModalProps) {
  // Generate mock child titles based on plot count
  const generateChildTitles = () => {
    const titles = [];
    for (let i = 1; i <= Math.min(plotCount || 12, 20); i++) {
      titles.push({
        plotNo: i,
        newTitle: `JUJA/BLOCK4/${String(i).padStart(4, '0')}`,
        area: `${(450 + Math.random() * 30).toFixed(0)} sqm`,
        status: Math.random() > 0.1 ? 'Approved' : 'Pending',
      });
    }
    return titles;
  };

  const childTitles = generateChildTitles();

  const handleExport = (format: string) => {
    toast({
      title: `Export Started`,
      description: `Generating ${format.toUpperCase()} file for Ardhisasa submission...`,
    });
    
    setTimeout(() => {
      toast({
        title: 'Export Complete',
        description: `${format.toUpperCase()} file ready for download.`,
      });
    }, 1500);
  };

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
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-6 space-y-6">
            {/* Government Form Header */}
            <div className="border border-border rounded-lg p-6 bg-secondary/30">
              <div className="text-center mb-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Republic of Kenya</p>
                <h2 className="text-lg font-bold mt-1">MINISTRY OF LANDS AND PHYSICAL PLANNING</h2>
                <p className="text-sm text-muted-foreground">Survey of Kenya / Ardhisasa Portal</p>
                <div className="mt-4 inline-block px-4 py-2 bg-primary/10 rounded-lg">
                  <p className="text-xl font-bold text-primary">FORM RL 7A</p>
                  <p className="text-xs text-muted-foreground">Application for Subdivision</p>
                </div>
              </div>

              {/* Mother Title Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Mother Title</p>
                    <p className="font-mono font-semibold">JUJA/BLOCK4/0000</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Registered Owner</p>
                    <p className="font-semibold">Juja Estates Limited</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Original Area</p>
                    <p className="font-mono">16.18 Hectares (40 Acres)</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Survey File Reference</p>
                    <p className="font-mono font-semibold">FR/JUJA/2024/0456</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Licensed Surveyor</p>
                    <p className="font-semibold">LS/2019/0234</p>
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

            {/* Child Titles Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border bg-secondary/30">
                <h3 className="font-semibold">Proposed Child Titles ({childTitles.length})</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="w-16">Plot #</TableHead>
                    <TableHead>New Title Number</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {childTitles.map((title) => (
                    <TableRow key={title.plotNo}>
                      <TableCell className="font-mono">{title.plotNo}</TableCell>
                      <TableCell className="font-mono font-semibold">{title.newTitle}</TableCell>
                      <TableCell>{title.area}</TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                          title.status === 'Approved' 
                            ? 'bg-success/20 text-success' 
                            : 'bg-warning/20 text-warning'
                        }`}>
                          {title.status === 'Approved' && <CheckCircle className="h-3 w-3" />}
                          {title.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border border-border rounded-lg text-center bg-secondary/30">
                <p className="text-2xl font-bold text-primary">{childTitles.length}</p>
                <p className="text-xs text-muted-foreground">Total Plots</p>
              </div>
              <div className="p-4 border border-border rounded-lg text-center bg-secondary/30">
                <p className="text-2xl font-bold text-primary">88%</p>
                <p className="text-xs text-muted-foreground">Land Utilization</p>
              </div>
              <div className="p-4 border border-border rounded-lg text-center bg-secondary/30">
                <p className="text-2xl font-bold text-success">{childTitles.filter(t => t.status === 'Approved').length}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="p-6 border-t border-border/50 flex items-center justify-between bg-secondary/30">
          <p className="text-sm text-muted-foreground">
            Ready for submission to Ardhisasa portal
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleExport('json')}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Export for Ardhisasa (JSON)
            </Button>
            <Button 
              variant="outline"
              onClick={() => handleExport('pdf')}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={() => handleExport('send')}>
              <Send className="h-4 w-4 mr-2" />
              Send to Client
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
