import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Project, Parcel, Subdivision, Plot, Beacon, Coordinate, SubdivisionFormData } from '@/types/survey';
import { calculatePolygonArea, calculatePerimeter, calculateCentroid } from '@/lib/geometry';
import { toast } from 'sonner';

// Projects
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          parcels (
            id,
            coordinates,
            centroid,
            area_sqm
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Project[];
    },
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          parcels (
            *,
            subdivisions (
              *,
              plots (
                *,
                beacons (*)
              )
            )
          )
        `)
        .eq('id', projectId)
        .single();

      if (error) throw error;
      return data as unknown as Project;
    },
  });
}

// Fetch plots directly by project_id
export function useProjectPlots(projectId: string | undefined) {
  return useQuery({
    queryKey: ['plots', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plots')
        .select('*')
        .eq('project_id', projectId)
        .order('plot_number', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (project: { 
      name: string; 
      description?: string; 
      client_name?: string; 
      client_email?: string;
      location_name?: string;
      total_area_ha?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...project,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create project: ' + error.message);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      updates 
    }: { 
      projectId: string; 
      updates: { 
        name?: string; 
        status?: 'draft' | 'in_progress' | 'completed' | 'archived'; 
        location_name?: string; 
        total_area_ha?: number;
      } 
    }) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
    },
    onError: (error) => {
      toast.error('Failed to update project: ' + error.message);
    },
  });
}

export function useCreateParcel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, coordinates, name }: { projectId: string; coordinates: Coordinate[]; name?: string }) => {
      const area_sqm = calculatePolygonArea(coordinates);
      const perimeter_m = calculatePerimeter(coordinates);
      const centroid = calculateCentroid(coordinates);

      const { data, error } = await supabase
        .from('parcels')
        .insert({
          project_id: projectId,
          name: name || 'Parent Parcel',
          coordinates: coordinates as unknown as any,
          area_sqm,
          perimeter_m,
          centroid: centroid as unknown as any,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Parcel;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
      toast.success('Parcel created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create parcel: ' + error.message);
    },
  });
}

// Create plots directly linked to a project
export function useCreatePlots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      projectId, 
      plots 
    }: { 
      projectId: string; 
      plots: { 
        plot_number: number; 
        coordinates: { lat: number; lng: number }[]; 
        area_sqm: number;
        status?: string;
      }[] 
    }) => {
      const plotsToInsert = plots.map(plot => ({
        project_id: projectId,
        plot_number: plot.plot_number,
        coordinates: plot.coordinates as unknown as any,
        area_sqm: plot.area_sqm,
        status: plot.status || 'valid',
        subdivision_id: null as any, // Now nullable
      }));

      const { data, error } = await supabase
        .from('plots')
        .insert(plotsToInsert as any)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plots', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
      toast.success('Plots saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save plots: ' + error.message);
    },
  });
}

// Delete all plots for a project (for re-subdivision)
export function useDeleteProjectPlots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('plots')
        .delete()
        .eq('project_id', projectId);

      if (error) throw error;
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['plots', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error) => {
      toast.error('Failed to delete plots: ' + error.message);
    },
  });
}

// Update single plot status
export function useUpdatePlotStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      plotId, 
      status,
      projectId,
    }: { 
      plotId: string; 
      status: 'available' | 'reserved' | 'sold';
      projectId: string;
    }) => {
      const { data, error } = await supabase
        .from('plots')
        .update({ status })
        .eq('id', plotId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plots', variables.projectId] });
      toast.success(`Plot marked as ${variables.status}`);
    },
    onError: (error) => {
      toast.error('Failed to update plot status: ' + error.message);
    },
  });
}

export function useAISubdivision() {
  return useMutation({
    mutationFn: async ({ 
      parcelCoordinates, 
      formData 
    }: { 
      parcelCoordinates: Coordinate[]; 
      formData: SubdivisionFormData 
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-subdivide', {
        body: { 
          parcelCoordinates,
          ...formData,
        },
      });

      if (error) throw error;
      return data;
    },
    onError: (error) => {
      toast.error('AI subdivision failed: ' + error.message);
    },
  });
}
