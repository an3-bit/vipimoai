import {
  MutationFormModal,
  ProjectCompletionModal,
  PlotStatusCard,
} from "@/components/workspace";
import { RIMUploadModal } from "@/components/workspace";

interface WorkspaceModalsProps {
  projectId: string;
  projectName: string;
  projectStatus: string;
  mutationModalOpen: boolean;
  onMutationModalOpenChange: (open: boolean) => void;
  hasExported: boolean;
  onHasExportedChange: (exported: boolean) => void;
  completionModalOpen: boolean;
  onCompletionModalOpenChange: (open: boolean) => void;
  plotCount: number;
  invalidPlotCount: number;
  isCompleting: boolean;
  onComplete: () => Promise<void>;
  onArchive: () => Promise<void>;
  selectedPlot: any | null;
  onSelectedPlotChange: (plot: any | null) => void;
  onPlotStatusChange: (newStatus: string) => void;
  isUpdatingPlot: boolean;
  rimUploadOpen?: boolean;
  onRimUploadOpenChange?: (open: boolean) => void;
  projectCenter?: { lat: number; lng: number } | null;
}

export function WorkspaceModals({
  projectId,
  projectName,
  projectStatus,
  mutationModalOpen,
  onMutationModalOpenChange,
  hasExported,
  onHasExportedChange,
  completionModalOpen,
  onCompletionModalOpenChange,
  plotCount,
  invalidPlotCount,
  isCompleting,
  onComplete,
  onArchive,
  selectedPlot,
  onSelectedPlotChange,
  onPlotStatusChange,
  isUpdatingPlot,
  rimUploadOpen = false,
  onRimUploadOpenChange = () => {},
  projectCenter = null,
}: WorkspaceModalsProps) {
  return (
    <>
      {/* Mutation Form Modal */}
      <MutationFormModal
        open={mutationModalOpen}
        onOpenChange={(open) => {
          onMutationModalOpenChange(open);
          if (!open) onHasExportedChange(true);
        }}
        projectId={projectId}
        projectName={projectName}
      />

      {/* Project Completion Modal */}
      <ProjectCompletionModal
        open={completionModalOpen}
        onOpenChange={onCompletionModalOpenChange}
        projectName={projectName}
        plotCount={plotCount}
        invalidPlotCount={invalidPlotCount}
        hasExported={hasExported}
        isCompleting={isCompleting}
        onComplete={onComplete}
        onArchive={onArchive}
      />

      {/* Plot Status Card */}
      <PlotStatusCard
        open={!!selectedPlot}
        onOpenChange={(open) => !open && onSelectedPlotChange(null)}
        plotNumber={selectedPlot?.plot_number || 0}
        areaSqm={selectedPlot?.area_sqm || 0}
        currentStatus={selectedPlot?.status || "available"}
        isUpdating={isUpdatingPlot}
        onStatusChange={onPlotStatusChange}
      />

      {/* RIM Upload Modal */}
      <RIMUploadModal
        open={rimUploadOpen || false}
        onOpenChange={onRimUploadOpenChange}
        projectId={projectId}
        center={projectCenter}
      />
    </>
  );
}
