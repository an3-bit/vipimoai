-- Make subdivision_id nullable for direct project-based plots
ALTER TABLE public.plots 
ALTER COLUMN subdivision_id DROP NOT NULL;