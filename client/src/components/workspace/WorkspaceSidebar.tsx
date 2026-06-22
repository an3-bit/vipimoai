import { useNavigate } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarContent, SidebarHeader } from '@/components/ui/sidebar';
import { Settings, ArrowLeft } from 'lucide-react';

interface WorkspaceSidebarProps {
  projectName: string;
  totalAreaHa: number;
  totalAreaAcres: number;
  locationName?: string;
  plotSize: string;
  onPlotSizeChange: (value: string) => void;
  inputUnit: 'FEET' | 'METERS' | 'ACRES' | 'HECTARES';
  onInputUnitChange: (unit: 'FEET' | 'METERS' | 'ACRES' | 'HECTARES') => void;
  customWidth: string;
  onCustomWidthChange: (value: string) => void;
  customDepth: string;
  onCustomDepthChange: (value: string) => void;
  roadWidth: string;
  onRoadWidthChange: (value: string) => void;
  riparianBufferEnabled: boolean;
  onRiparianBufferChange: (enabled: boolean) => void;
  riparianHasRiver: boolean;
  riparianRiverPointsCount: number;
  onRiparianClear: () => void;
  showPlotGrid: boolean;
  plotCount: number;
  invalidPlotCount: number;
  roadAreaSqm: number;
  efficiency: number;
  areaQueue?: { value: number; unit: 'ACRES' | 'HECTARES' }[];
  onAreaQueueChange?: (queue: { value: number; unit: 'ACRES' | 'HECTARES' }[]) => void;
}

const FEET_TO_METERS = 0.3048;
const ACRE_TO_SQM = 4046.8564224;
const HA_TO_SQM = 10000;

export function WorkspaceSidebar({
  projectName,
  totalAreaHa,
  totalAreaAcres,
  locationName,
  plotSize,
  onPlotSizeChange,
  inputUnit,
  onInputUnitChange,
  customWidth,
  onCustomWidthChange,
  customDepth,
  onCustomDepthChange,
  roadWidth,
  onRoadWidthChange,
  riparianBufferEnabled,
  onRiparianBufferChange,
  riparianHasRiver,
  riparianRiverPointsCount,
  onRiparianClear,
  showPlotGrid,
  plotCount,
  invalidPlotCount,
  roadAreaSqm,
  efficiency,
  areaQueue = [],
  onAreaQueueChange,
}: WorkspaceSidebarProps) {
  const navigate = useNavigate();

  const getDimensionsInMeters = () => {
    switch (plotSize) {
      case '50x100ft':
        return { width: 50 * FEET_TO_METERS, depth: 100 * FEET_TO_METERS };
      case '40x80ft':
        return { width: 40 * FEET_TO_METERS, depth: 80 * FEET_TO_METERS };
      case '100x100ft':
        return { width: 100 * FEET_TO_METERS, depth: 100 * FEET_TO_METERS };
      case 'custom':
        const w = parseFloat(customWidth) || 50;
        const d = parseFloat(customDepth) || 100;
        if (inputUnit === 'ACRES' || inputUnit === 'HECTARES') {
          // Area mode: customWidth holds the area value; produce a square plot
          const areaSqm = inputUnit === 'ACRES' ? w * ACRE_TO_SQM : w * HA_TO_SQM;
          const side = Math.sqrt(Math.max(areaSqm, 1));
          return { width: side, depth: side };
        }
        return {
          width: inputUnit === 'FEET' ? w * FEET_TO_METERS : w,
          depth: inputUnit === 'FEET' ? d * FEET_TO_METERS : d,
        };
      default:
        return { width: 15.24, depth: 30.48 };
    }
  };

  const isAreaMode = inputUnit === 'ACRES' || inputUnit === 'HECTARES';

  return (
    <>
      <SidebarHeader className="border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Subdivision Parameters
            </h3>
          </div>
          <button
            onClick={() => navigate('/')}
            className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Project Info */}
          <div className="p-3 bg-secondary/50 rounded-lg border border-border/50">
            <p className="font-semibold text-sm mb-1">{projectName}</p>
            <p className="text-xs text-muted-foreground">
              {totalAreaHa.toFixed(2)} Ha / {totalAreaAcres.toFixed(1)} Acres
              {locationName && ` • ${locationName}`}
            </p>
          </div>

          {/* Plot Size Preset */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Plot Size Target</Label>
            <Select
              value={plotSize}
              onValueChange={(v) => {
                onPlotSizeChange(v);
                if (v !== 'custom') onInputUnitChange('FEET');
              }}
            >
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50x100ft">50 × 100 ft (Standard)</SelectItem>
                <SelectItem value="40x80ft">40 × 80 ft (Compact)</SelectItem>
                <SelectItem value="100x100ft">100 × 100 ft (Quarter Acre)</SelectItem>
                <SelectItem value="custom">Custom Dimensions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Dimensions with Unit Toggle */}
          {plotSize === 'custom' && (
            <div className="space-y-3">
              {/* Unit Toggle */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Input Mode:</Label>
                <div className="grid grid-cols-4 rounded-md border border-border/50 overflow-hidden">
                  {(['FEET', 'METERS', 'ACRES', 'HECTARES'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                        inputUnit === u
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/50 hover:bg-secondary'
                      }`}
                      onClick={() => onInputUnitChange(u)}
                    >
                      {u === 'FEET' ? 'ft' : u === 'METERS' ? 'm' : u === 'ACRES' ? 'Acres' : 'Ha'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {isAreaMode
                    ? 'Area mode: enter target plot area (square plots generated).'
                    : 'Dimension mode: enter width × depth.'}
                </p>
              </div>

              {/* Inputs */}
              {isAreaMode ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Plot Area ({inputUnit === 'ACRES' ? 'acres' : 'ha'})
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={customWidth}
                      onChange={(e) => onCustomWidthChange(e.target.value)}
                      className="bg-secondary/50"
                      placeholder={inputUnit === 'ACRES' ? '0.125' : '0.05'}
                    />
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      disabled={!onAreaQueueChange}
                      onClick={() => {
                        const v = parseFloat(customWidth);
                        if (!v || v <= 0 || !onAreaQueueChange) return;
                        onAreaQueueChange([...areaQueue, { value: v, unit: inputUnit as 'ACRES' | 'HECTARES' }]);
                        onCustomWidthChange('');
                      }}
                    >
                      + Add
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const v = parseFloat(customWidth) || 0;
                      const sqm = inputUnit === 'ACRES' ? v * ACRE_TO_SQM : v * HA_TO_SQM;
                      const side = Math.sqrt(Math.max(sqm, 0));
                      return `≈ ${sqm.toFixed(0)} m² · square ${side.toFixed(1)}m × ${side.toFixed(1)}m`;
                    })()}
                  </p>

                  {areaQueue.length > 0 && (
                    <div className="space-y-1 p-2 rounded-md bg-secondary/40 border border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium">
                          Plot Queue ({areaQueue.length})
                        </p>
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                          onClick={() => onAreaQueueChange?.([])}
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {areaQueue.map((q, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs px-2 py-1 rounded bg-background/60"
                          >
                            <span>
                              #{i + 1} · {q.value} {q.unit === 'ACRES' ? 'ac' : 'ha'}
                            </span>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                onAreaQueueChange?.(areaQueue.filter((_, idx) => idx !== i))
                              }
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground pt-1">
                        Click "Auto-Subdivide" to create all queued plots in one go.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Width ({inputUnit === 'FEET' ? 'ft' : 'm'})
                      </Label>
                      <Input
                        type="number"
                        value={customWidth}
                        onChange={(e) => onCustomWidthChange(e.target.value)}
                        className="bg-secondary/50"
                        placeholder={inputUnit === 'FEET' ? '50' : '15.24'}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Depth ({inputUnit === 'FEET' ? 'ft' : 'm'})
                      </Label>
                      <Input
                        type="number"
                        value={customDepth}
                        onChange={(e) => onCustomDepthChange(e.target.value)}
                        className="bg-secondary/50"
                        placeholder={inputUnit === 'FEET' ? '100' : '30.48'}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inputUnit === 'FEET' ? (
                      <>
                        ≈ {((parseFloat(customWidth) || 0) * FEET_TO_METERS).toFixed(2)}m ×{' '}
                        {((parseFloat(customDepth) || 0) * FEET_TO_METERS).toFixed(2)}m
                      </>
                    ) : (
                      <>
                        ≈ {((parseFloat(customWidth) || 0) / FEET_TO_METERS).toFixed(1)}ft ×{' '}
                        {((parseFloat(customDepth) || 0) / FEET_TO_METERS).toFixed(1)}ft
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Plot Area Display for Presets */}
          {plotSize !== 'custom' && (
            <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-xs text-muted-foreground">
                Plot Area:{' '}
                {(() => {
                  const dims = getDimensionsInMeters();
                  const areaSqm = dims.width * dims.depth;
                  const areaHa = areaSqm / 10000;
                  return `${areaSqm.toFixed(0)} m² (${areaHa.toFixed(3)} Ha)`;
                })()}
              </p>
            </div>
          )}

          {/* Road Width */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Road Width (m)</Label>
            <Input
              value={roadWidth}
              onChange={(e) => onRoadWidthChange(e.target.value)}
              className="bg-secondary/50"
            />
          </div>

          {/* Riparian Buffer Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Riparian Buffer</Label>
              <p className="text-xs text-muted-foreground">
                {riparianHasRiver ? 'River drawn (30m buffer active)' : 'Draw river to enable'}
              </p>
            </div>
            <Switch
              checked={riparianBufferEnabled}
              onCheckedChange={onRiparianBufferChange}
              disabled={!riparianHasRiver}
            />
          </div>

          {/* River Info */}
          {riparianHasRiver && (
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-blue-400">River: {riparianRiverPointsCount} points</span>
                <button
                  onClick={onRiparianClear}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          {showPlotGrid && (
            <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valid Plots:</span>
                <span className="font-mono font-semibold text-primary">{plotCount}</span>
              </div>
              {invalidPlotCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invalid (Riparian):</span>
                  <span className="font-mono font-semibold text-destructive">{invalidPlotCount}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Road Surrender:</span>
                <span className="font-mono font-semibold text-muted-foreground">
                  {(roadAreaSqm / 10000).toFixed(4)} Ha
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Yield Efficiency:</span>
                <span
                  className={`font-mono font-semibold ${
                    efficiency >= 70 ? 'text-primary' : efficiency >= 50 ? 'text-amber-500' : 'text-destructive'
                  }`}
                >
                  {efficiency}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-mono font-semibold text-success">Saved ✓</span>
              </div>

              {/* Plot Status Legend */}
              <div className="pt-2 border-t border-border/50 mt-2">
                <p className="text-xs text-muted-foreground mb-2">Plot Status (tap to change):</p>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-emerald-500"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-amber-500"></div>
                    <span>Reserved</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-rose-500"></div>
                    <span>Sold</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SidebarContent>
    </>
  );
}
