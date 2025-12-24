import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityLog {
  id: string;
  project_id: string;
  user_id: string;
  action_type: string;
  action_label: string;
  details: Record<string, any> | null;
  created_at: string;
}

export type ActionType = 
  | 'project_created'
  | 'project_updated'
  | 'status_changed'
  | 'subdivision_generated'
  | 'plot_status_changed'
  | 'export_completed'
  | 'river_drawn'
  | 'hazard_scan'
  | 'project_completed'
  | 'project_archived';

export function useActivityLogs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['activity-logs', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ActivityLog[];
    },
  });
}

export function useLogActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      actionType,
      actionLabel,
      details,
    }: {
      projectId: string;
      actionType: ActionType;
      actionLabel: string;
      details?: Record<string, any>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('activity_logs')
        .insert({
          project_id: projectId,
          user_id: user.id,
          action_type: actionType,
          action_label: actionLabel,
          details: details || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ActivityLog;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activity-logs', variables.projectId] });
    },
  });
}