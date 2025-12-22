import { useState } from 'react';
import { Settings, Wand2, RotateCw, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Coordinate, SubdivisionFormData, AISuggestion, Plot, Beacon } from '@/types/survey';
import { useAISubdivision } from '@/hooks/useSurvey';
import { toast } from 'sonner';

interface SubdivisionFormProps {
  parcelCoordinates: Coordinate[];
  onSubdivisionComplete: (plots: Plot[], beacons: Beacon[], suggestions: AISuggestion[]) => void;
}

export function SubdivisionForm({ parcelCoordinates, onSubdivisionComplete }: SubdivisionFormProps) {
  const [formData, setFormData] = useState<SubdivisionFormData>({
    plot_width: 50,
    plot_depth: 100,
    strategy: 'auto_fit',
    orientation_degrees: 0,
    road_setback_m: 5,
    side_setback_m: 3,
  });

  const aiSubdivision = useAISubdivision();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parcelCoordinates.length < 3) {
      toast.error('Please upload a parcel first');
      return;
    }

    try {
      const result = await aiSubdivision.mutateAsync({
        parcelCoordinates,
        formData,
      });

      if (result.success) {
        const plots: Plot[] = result.results.plots.map((p: any) => ({
          id: crypto.randomUUID(),
          plot_number: p.plot_number,
          coordinates: p.coordinates,
          area_sqm: p.area_sqm,
          width_m: p.width_m,
          depth_m: p.depth_m,
          is_partial: p.is_partial,
        }));

        const beacons: Beacon[] = result.results.beacons.map((b: any) => ({
          id: crypto.randomUUID(),
          beacon_number: b.beacon_number,
          latitude: b.latitude,
          longitude: b.longitude,
          description: b.description,
        }));

        onSubdivisionComplete(plots, beacons, result.suggestions || []);
        toast.success(`Generated ${plots.length} plots with ${beacons.length} beacons`);
      } else {
        toast.error(result.error || 'Subdivision failed');
      }
    } catch (error) {
      console.error('Subdivision error:', error);
      toast.error('Failed to subdivide parcel');
    }
  };

  const updateField = <K extends keyof SubdivisionFormData>(
    field: K,
    value: SubdivisionFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-survey-primary" />
          Subdivision Setup
        </CardTitle>
        <CardDescription>
          Configure plot dimensions and subdivision strategy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plot Dimensions */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-survey-accent" />
              Plot Dimensions
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plot_width">Width (m)</Label>
                <Input
                  id="plot_width"
                  type="number"
                  min={5}
                  max={500}
                  step={1}
                  value={formData.plot_width}
                  onChange={(e) => updateField('plot_width', parseFloat(e.target.value) || 0)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plot_depth">Depth (m)</Label>
                <Input
                  id="plot_depth"
                  type="number"
                  min={5}
                  max={500}
                  step={1}
                  value={formData.plot_depth}
                  onChange={(e) => updateField('plot_depth', parseFloat(e.target.value) || 0)}
                  className="font-mono"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Plot area: {(formData.plot_width * formData.plot_depth).toLocaleString()} m²
            </p>
          </div>

          {/* Strategy Selection */}
          <div className="space-y-2">
            <Label>Subdivision Strategy</Label>
            <Select
              value={formData.strategy}
              onValueChange={(v) => updateField('strategy', v as SubdivisionFormData['strategy'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto_fit">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    Auto-fit (Maximum plots)
                  </div>
                </SelectItem>
                <SelectItem value="fixed_count">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Fixed Count
                  </div>
                </SelectItem>
                <SelectItem value="equal_resize">
                  <div className="flex items-center gap-2">
                    <RotateCw className="h-4 w-4" />
                    Equal Resize
                  </div>
                </SelectItem>
                <SelectItem value="extract_full">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Extract Full Only
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target Count (for fixed_count and equal_resize) */}
          {(formData.strategy === 'fixed_count' || formData.strategy === 'equal_resize') && (
            <div className="space-y-2">
              <Label htmlFor="target_count">Target Plot Count</Label>
              <Input
                id="target_count"
                type="number"
                min={1}
                max={100}
                value={formData.target_plot_count || ''}
                onChange={(e) => updateField('target_plot_count', parseInt(e.target.value) || undefined)}
                placeholder="Number of plots"
                className="font-mono"
              />
            </div>
          )}

          {/* Setbacks */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-survey-accent" />
              Setbacks
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="road_setback">Road Setback (m)</Label>
                <Input
                  id="road_setback"
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={formData.road_setback_m}
                  onChange={(e) => updateField('road_setback_m', parseFloat(e.target.value) || 0)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="side_setback">Side Setback (m)</Label>
                <Input
                  id="side_setback"
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={formData.side_setback_m}
                  onChange={(e) => updateField('side_setback_m', parseFloat(e.target.value) || 0)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* Orientation */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Orientation (degrees)</Label>
              <span className="text-sm font-mono text-muted-foreground">
                {formData.orientation_degrees}°
              </span>
            </div>
            <Slider
              value={[formData.orientation_degrees]}
              onValueChange={([v]) => updateField('orientation_degrees', v)}
              min={0}
              max={180}
              step={5}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Special requirements, access roads, etc."
              value={formData.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              className="h-20"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="survey"
            className="w-full"
            disabled={aiSubdivision.isPending || parcelCoordinates.length < 3}
          >
            {aiSubdivision.isPending ? (
              <>
                <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Subdivision
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
