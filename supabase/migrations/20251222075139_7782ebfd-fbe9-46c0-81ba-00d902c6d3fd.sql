-- Create enum for project status
CREATE TYPE public.project_status AS ENUM ('draft', 'in_progress', 'completed', 'archived');

-- Create enum for subdivision strategy
CREATE TYPE public.subdivision_strategy AS ENUM ('auto_fit', 'fixed_count', 'equal_resize', 'extract_full');

-- Projects table (survey jobs)
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    client_name TEXT,
    client_email TEXT,
    status project_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parent parcels table
CREATE TABLE public.parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Parent Parcel',
    coordinates JSONB NOT NULL, -- Array of {lat, lng} points
    crs TEXT DEFAULT 'EPSG:4326',
    area_sqm NUMERIC,
    perimeter_m NUMERIC,
    centroid JSONB, -- {lat, lng}
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subdivisions table (the subdivision configuration)
CREATE TABLE public.subdivisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
    plot_width NUMERIC NOT NULL,
    plot_depth NUMERIC NOT NULL,
    target_plot_count INTEGER,
    strategy subdivision_strategy NOT NULL DEFAULT 'auto_fit',
    orientation_degrees NUMERIC DEFAULT 0,
    road_setback_m NUMERIC DEFAULT 0,
    side_setback_m NUMERIC DEFAULT 0,
    notes TEXT,
    ai_suggestions JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated plots table
CREATE TABLE public.plots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subdivision_id UUID NOT NULL REFERENCES public.subdivisions(id) ON DELETE CASCADE,
    plot_number INTEGER NOT NULL,
    coordinates JSONB NOT NULL, -- Array of {lat, lng} corner points
    area_sqm NUMERIC NOT NULL,
    width_m NUMERIC,
    depth_m NUMERIC,
    is_partial BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Beacons table (corner points with coordinates)
CREATE TABLE public.beacons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
    beacon_number INTEGER NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    easting NUMERIC,
    northing NUMERIC,
    description TEXT
);

-- Exports table (generated files)
CREATE TABLE public.exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    export_type TEXT NOT NULL, -- 'pdf', 'csv', 'dxf', 'geojson', 'kml'
    file_url TEXT,
    file_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subdivisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beacons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view their own projects" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);

-- Parcels policies (access through project ownership)
CREATE POLICY "Users can view parcels of their projects" ON public.parcels
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = parcels.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can create parcels in their projects" ON public.parcels
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects WHERE id = parcels.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can update parcels in their projects" ON public.parcels
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = parcels.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can delete parcels in their projects" ON public.parcels
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = parcels.project_id AND user_id = auth.uid())
    );

-- Subdivisions policies
CREATE POLICY "Users can view subdivisions of their parcels" ON public.subdivisions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parcels p
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE p.id = subdivisions.parcel_id AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create subdivisions in their parcels" ON public.subdivisions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.parcels p
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE p.id = subdivisions.parcel_id AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update subdivisions in their parcels" ON public.subdivisions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.parcels p
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE p.id = subdivisions.parcel_id AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete subdivisions in their parcels" ON public.subdivisions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.parcels p
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE p.id = subdivisions.parcel_id AND pr.user_id = auth.uid()
        )
    );

-- Plots policies
CREATE POLICY "Users can view plots of their subdivisions" ON public.plots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.subdivisions s
            JOIN public.parcels p ON s.parcel_id = p.id
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE s.id = plots.subdivision_id AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create plots in their subdivisions" ON public.plots
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.subdivisions s
            JOIN public.parcels p ON s.parcel_id = p.id
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE s.id = plots.subdivision_id AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update plots in their subdivisions" ON public.plots
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.subdivisions s
            JOIN public.parcels p ON s.parcel_id = p.id
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE s.id = plots.subdivision_id AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete plots in their subdivisions" ON public.plots
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.subdivisions s
            JOIN public.parcels p ON s.parcel_id = p.id
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE s.id = plots.subdivision_id AND pr.user_id = auth.uid()
        )
    );

-- Beacons policies
CREATE POLICY "Users can view beacons of their plots" ON public.beacons
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.plots pl
            JOIN public.subdivisions s ON pl.subdivision_id = s.id
            JOIN public.parcels p ON s.parcel_id = p.id
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE pl.id = beacons.plot_id AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create beacons in their plots" ON public.beacons
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.plots pl
            JOIN public.subdivisions s ON pl.subdivision_id = s.id
            JOIN public.parcels p ON s.parcel_id = p.id
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE pl.id = beacons.plot_id AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update beacons in their plots" ON public.beacons
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.plots pl
            JOIN public.subdivisions s ON pl.subdivision_id = s.id
            JOIN public.parcels p ON s.parcel_id = p.id
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE pl.id = beacons.plot_id AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete beacons in their plots" ON public.beacons
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.plots pl
            JOIN public.subdivisions s ON pl.subdivision_id = s.id
            JOIN public.parcels p ON s.parcel_id = p.id
            JOIN public.projects pr ON p.project_id = pr.id
            WHERE pl.id = beacons.plot_id AND pr.user_id = auth.uid()
        )
    );

-- Exports policies
CREATE POLICY "Users can view exports of their projects" ON public.exports
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = exports.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can create exports in their projects" ON public.exports
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects WHERE id = exports.project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can delete exports in their projects" ON public.exports
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = exports.project_id AND user_id = auth.uid())
    );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subdivisions_updated_at
    BEFORE UPDATE ON public.subdivisions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();