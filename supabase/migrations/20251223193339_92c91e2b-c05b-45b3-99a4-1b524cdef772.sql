-- Add location_name and total_area_ha columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS location_name text,
ADD COLUMN IF NOT EXISTS total_area_ha numeric;

-- Add project_id directly to plots for simpler queries (optional direct link)
ALTER TABLE public.plots 
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'valid';

-- Create index for faster project-based plot queries
CREATE INDEX IF NOT EXISTS idx_plots_project_id ON public.plots(project_id);

-- Update RLS policy for plots to also allow access via direct project_id
DROP POLICY IF EXISTS "Users can view plots via project" ON public.plots;
CREATE POLICY "Users can view plots via project" 
ON public.plots 
FOR SELECT 
USING (
  (EXISTS (
    SELECT 1 FROM public.projects pr 
    WHERE pr.id = plots.project_id AND pr.user_id = auth.uid()
  ))
  OR
  (EXISTS (
    SELECT 1
    FROM ((subdivisions s
      JOIN parcels p ON ((s.parcel_id = p.id)))
      JOIN projects pr ON ((p.project_id = pr.id)))
    WHERE ((s.id = plots.subdivision_id) AND (pr.user_id = auth.uid()))
  ))
);

DROP POLICY IF EXISTS "Users can insert plots via project" ON public.plots;
CREATE POLICY "Users can insert plots via project" 
ON public.plots 
FOR INSERT 
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.projects pr 
    WHERE pr.id = plots.project_id AND pr.user_id = auth.uid()
  ))
  OR
  (EXISTS (
    SELECT 1
    FROM ((subdivisions s
      JOIN parcels p ON ((s.parcel_id = p.id)))
      JOIN projects pr ON ((p.project_id = pr.id)))
    WHERE ((s.id = plots.subdivision_id) AND (pr.user_id = auth.uid()))
  ))
);

DROP POLICY IF EXISTS "Users can update plots via project" ON public.plots;
CREATE POLICY "Users can update plots via project" 
ON public.plots 
FOR UPDATE 
USING (
  (EXISTS (
    SELECT 1 FROM public.projects pr 
    WHERE pr.id = plots.project_id AND pr.user_id = auth.uid()
  ))
  OR
  (EXISTS (
    SELECT 1
    FROM ((subdivisions s
      JOIN parcels p ON ((s.parcel_id = p.id)))
      JOIN projects pr ON ((p.project_id = pr.id)))
    WHERE ((s.id = plots.subdivision_id) AND (pr.user_id = auth.uid()))
  ))
);

DROP POLICY IF EXISTS "Users can delete plots via project" ON public.plots;
CREATE POLICY "Users can delete plots via project" 
ON public.plots 
FOR DELETE 
USING (
  (EXISTS (
    SELECT 1 FROM public.projects pr 
    WHERE pr.id = plots.project_id AND pr.user_id = auth.uid()
  ))
  OR
  (EXISTS (
    SELECT 1
    FROM ((subdivisions s
      JOIN parcels p ON ((s.parcel_id = p.id)))
      JOIN projects pr ON ((p.project_id = pr.id)))
    WHERE ((s.id = plots.subdivision_id) AND (pr.user_id = auth.uid()))
  ))
);