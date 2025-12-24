-- Create activity_logs table for project audit trail
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_label TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_activity_logs_project_id ON public.activity_logs(project_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view activity logs for their own projects
CREATE POLICY "Users can view activity logs of their projects"
ON public.activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = activity_logs.project_id
    AND projects.user_id = auth.uid()
  )
);

-- Users can create activity logs for their own projects
CREATE POLICY "Users can create activity logs in their projects"
ON public.activity_logs
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = activity_logs.project_id
    AND projects.user_id = auth.uid()
  )
);