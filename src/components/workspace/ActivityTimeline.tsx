import { useActivityLogs, ActivityLog } from '@/hooks/useActivityLog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, CheckCircle, Grid3X3, MapPin, Download, Waves, 
  AlertTriangle, Archive, FileText, Edit, Loader2, History
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityTimelineProps {
  projectId: string;
}

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'project_created':
      return <MapPin className="h-4 w-4" />;
    case 'project_updated':
      return <Edit className="h-4 w-4" />;
    case 'status_changed':
      return <Clock className="h-4 w-4" />;
    case 'subdivision_generated':
      return <Grid3X3 className="h-4 w-4" />;
    case 'plot_status_changed':
      return <CheckCircle className="h-4 w-4" />;
    case 'export_completed':
      return <Download className="h-4 w-4" />;
    case 'river_drawn':
      return <Waves className="h-4 w-4" />;
    case 'hazard_scan':
      return <AlertTriangle className="h-4 w-4" />;
    case 'project_completed':
      return <CheckCircle className="h-4 w-4" />;
    case 'project_archived':
      return <Archive className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getActionColor = (actionType: string) => {
  switch (actionType) {
    case 'project_created':
      return 'bg-primary/20 text-primary';
    case 'subdivision_generated':
      return 'bg-emerald-500/20 text-emerald-500';
    case 'project_completed':
      return 'bg-success/20 text-success';
    case 'hazard_scan':
      return 'bg-warning/20 text-warning';
    case 'project_archived':
      return 'bg-muted text-muted-foreground';
    case 'export_completed':
      return 'bg-blue-500/20 text-blue-500';
    case 'river_drawn':
      return 'bg-blue-500/20 text-blue-500';
    case 'plot_status_changed':
      return 'bg-amber-500/20 text-amber-500';
    default:
      return 'bg-secondary text-muted-foreground';
  }
};

export function ActivityTimeline({ projectId }: ActivityTimelineProps) {
  const { data: logs, isLoading } = useActivityLogs(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="relative pl-6 space-y-4">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
        
        {logs.map((log, index) => (
          <div key={log.id} className="relative flex gap-3">
            {/* Timeline dot */}
            <div className={`absolute left-[-13px] h-6 w-6 rounded-full flex items-center justify-center ${getActionColor(log.action_type)}`}>
              {getActionIcon(log.action_type)}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-medium">{log.action_label}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </p>
              {log.details && Object.keys(log.details).length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground bg-secondary/50 rounded px-2 py-1">
                  {Object.entries(log.details).map(([key, value]) => (
                    <span key={key} className="mr-3">
                      {key.replace(/_/g, ' ')}: <span className="font-medium">{String(value)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}