import { Button } from '@/components/ui/button';
import {
  Upload,
  Waves,
  Route,
  AlertTriangle,
  Grid3X3,
  Loader2,
  Save,
  FileText,
  Download,
  CheckCircle,
  MapPin,
} from 'lucide-react';

interface WorkspaceToolbarProps {
  onUpdateParcel: () => void;
  isDrawingRiver: boolean;
  onDrawRiver: () => void;
  onFinishDrawRiver: () => void;
  accessRoadMode: boolean;
  onAccessRoadModeChange: (mode: boolean) => void;
  frontageEdgeSelectorEnabled: boolean;
  onFrontageEdgeSelectorChange: (enabled: boolean) => void;
  accessEdgesCount: number;
  isProcessing: boolean;
  onRunHazardScan: () => void;
  showPlotGrid: boolean;
  onAutoSubdivide: () => void;
  parcelCoordinatesLength: number;
  isSaving: boolean;
  onSaveProject: () => void;
  plotCount: number;
  onGenerateMutation: () => void;
  onDownload: () => void;
  projectStatus: string;
  onCompleteProject: () => void;
}

export function WorkspaceToolbar({
  onUpdateParcel,
  isDrawingRiver,
  onDrawRiver,
  onFinishDrawRiver,
  accessRoadMode,
  onAccessRoadModeChange,
  frontageEdgeSelectorEnabled,
  onFrontageEdgeSelectorChange,
  accessEdgesCount,
  isProcessing,
  onRunHazardScan,
  showPlotGrid,
  onAutoSubdivide,
  parcelCoordinatesLength,
  isSaving,
  onSaveProject,
  plotCount,
  onGenerateMutation,
  onDownload,
  projectStatus,
  onCompleteProject,
}: WorkspaceToolbarProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
      <div className="glass-panel rounded-xl p-2 flex items-center gap-2">
        {/* Update Parcel Coordinates */}
        <button
          className="tool-btn"
          title="Update Parcel Coordinates"
          onClick={onUpdateParcel}
        >
          <Upload className="h-5 w-5" />
        </button>

        {/* Draw River */}
        <button
          className={`tool-btn ${isDrawingRiver ? 'active' : ''}`}
          onClick={isDrawingRiver ? onFinishDrawRiver : onDrawRiver}
          title={isDrawingRiver ? 'Finish Drawing' : 'Draw River'}
        >
          <Waves className="h-5 w-5" />
        </button>

        {/* Access Road Selector */}
        <button
          className={`tool-btn ${accessRoadMode ? 'active' : ''} ${accessEdgesCount > 0 ? 'text-emerald-500' : ''}`}
          onClick={() => onAccessRoadModeChange(!accessRoadMode)}
          title={accessEdgesCount > 0 ? `Access Roads: ${accessEdgesCount} selected` : 'Mark Access Roads'}
        >
          <Route className="h-5 w-5" />
        </button>

        {/* Frontage Edge Selector */}
        <button
          className={`tool-btn ${frontageEdgeSelectorEnabled ? 'active text-blue-500' : ''}`}
          onClick={() => onFrontageEdgeSelectorChange(!frontageEdgeSelectorEnabled)}
          disabled={parcelCoordinatesLength === 0}
          title="Mark Road-Facing Edge - Click 2+ coordinates on parcel boundary facing the road"
        >
          <MapPin className="h-5 w-5" />
        </button>

        {/* Hazard Scan */}
        <button
          className={`tool-btn ${showPlotGrid ? 'active' : ''}`}
          onClick={onRunHazardScan}
          disabled={isProcessing}
          title="Run Hazard Scan"
        >
          {isProcessing && !isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle className="h-5 w-5" />}
        </button>

        {/* Auto Subdivide */}
        <button
          className={`tool-btn ${showPlotGrid ? 'active' : ''}`}
          onClick={onAutoSubdivide}
          disabled={isProcessing || parcelCoordinatesLength === 0}
          title="Auto-Subdivide"
        >
          {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Grid3X3 className="h-5 w-5" />}
        </button>

        <div className="w-px h-8 bg-border mx-1" />

        {/* Save Button */}
        <button
          className={`tool-btn ${isSaving ? '' : 'hover:text-success'}`}
          onClick={onSaveProject}
          disabled={isSaving}
          title="Save Project"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        </button>

        {/* Generate Mutation */}
        <button
          className="tool-btn"
          onClick={onGenerateMutation}
          title="Generate Mutation Form"
          disabled={plotCount === 0}
        >
          <FileText className="h-5 w-5" />
        </button>

        {/* Download */}
        <button className="tool-btn" title="Export Data" onClick={onDownload}>
          <Download className="h-5 w-5" />
        </button>

        <div className="w-px h-8 bg-border mx-1" />

        {/* Complete Project */}
        <button
          className={`tool-btn ${projectStatus === 'completed' ? 'text-success' : 'hover:text-success'}`}
          onClick={onCompleteProject}
          title={projectStatus === 'completed' ? 'Project Completed' : 'Complete Project'}
          disabled={plotCount === 0}
        >
          <CheckCircle className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
