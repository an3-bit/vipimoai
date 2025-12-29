/**
 * SubdivisionSummaryPanel - Displays subdivision statistics and recommendations
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  MapPin, 
  Grid3X3, 
  Route, 
  Lightbulb,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import type { SubdivisionOutput } from '@/lib/subdivision';

interface SubdivisionSummaryPanelProps {
  result: SubdivisionOutput | null;
}

export function SubdivisionSummaryPanel({ result }: SubdivisionSummaryPanelProps) {
  if (!result) return null;

  const { summary, frontageAnalysis } = result;

  return (
    <Card className="border-border/50 bg-background/95 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Grid3X3 className="h-5 w-5 text-primary" />
          Smart Subdivision Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Access Type Badge */}
        <div className="flex items-center gap-2">
          <Badge 
            variant={frontageAnalysis.status === 'PRIMARY_ACCESS' ? 'default' : 'secondary'}
            className={frontageAnalysis.status === 'PRIMARY_ACCESS' 
              ? 'bg-green-500/20 text-green-700 border-green-500/30' 
              : 'bg-amber-500/20 text-amber-700 border-amber-500/30'
            }
          >
            {frontageAnalysis.status === 'PRIMARY_ACCESS' ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Road Frontage Detected</>
            ) : (
              <><AlertTriangle className="h-3 w-3 mr-1" /> Landlocked Parcel</>
            )}
          </Badge>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<MapPin className="h-4 w-4" />}
            label="Parcel Area"
            value={`${summary.parcelAreaHa.toFixed(3)} Ha`}
          />
          <StatCard
            icon={<Grid3X3 className="h-4 w-4" />}
            label="Total Plots"
            value={summary.totalPlots.toString()}
            highlight
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Efficiency"
            value={`${summary.efficiency.toFixed(1)}%`}
          />
          <StatCard
            icon={<Route className="h-4 w-4" />}
            label="Road Area"
            value={`${summary.roadAreaHa.toFixed(3)} Ha`}
          />
        </div>

        {/* Saved Area (if any) */}
        {summary.savedArea > 0 && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">
                Area Saved: {summary.savedAreaHa.toFixed(3)} Ha
              </span>
            </div>
            <p className="text-xs text-green-600/80 mt-1">
              By using existing road frontage instead of creating a perimeter road
            </p>
          </div>
        )}

        {/* Average Plot Size */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="text-sm text-muted-foreground">Average Plot Size</div>
          <div className="text-lg font-semibold">
            {summary.averagePlotSize.toFixed(0)} sqm
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({summary.averagePlotSizeHa.toFixed(4)} Ha)
            </span>
          </div>
        </div>

        {/* Recommendations */}
        {summary.recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Recommendations
            </div>
            <ul className="space-y-1">
              {summary.recommendations.map((rec, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  highlight = false 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-semibold ${highlight ? 'text-primary' : ''}`}>
        {value}
      </div>
    </div>
  );
}

export default SubdivisionSummaryPanel;
