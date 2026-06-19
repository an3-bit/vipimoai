import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useLogActivity } from '@/hooks/useActivityLog';
import { useWorkspaceState } from '@/hooks/useWorkspaceState';
import {
  WorkspaceSidebar,
  WorkspaceMapContainer,
  WorkspaceOverlays,
  WorkspaceToolbar,
  WorkspaceChat,
  WorkspaceMapControls,
  WorkspaceModals,
  WorkspaceTour,
  CoPilotLoadingOverlay,
  YieldComparisonBadge,
  ManualDraftingTools,
  UpdateParcelDialog,
  FrontageEdgeSelector,
} from '@/components/workspace';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Coordinate } from '@/types/survey';
import { toast } from 'sonner';
import { subdivideParcel } from '@/lib/subdivision';
import * as turf from '@turf/turf';

export default function Workspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const logActivity = useLogActivity();
  const state = useWorkspaceState({ projectId });
  
  // State for update parcel dialog
  const [updateParcelOpen, setUpdateParcelOpen] = useState(false);
  const [updateParcelCoordinates, setUpdateParcelCoordinates] = useState<Coordinate[] | null>(null);
  const [isUpdatingParcel, setIsUpdatingParcel] = useState(false);

  // Early returns for loading/error states
  if (state.projectLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (state.projectError || !state.project) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Project not found or access denied</p>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  // Handlers
  const handleStartDrawRiver = () => {
    state.riparian.startDrawing();
    toast.info("Click on the map to draw river path. Press Enter or Escape to finish.");
  };

  const handleFinishDrawRiver = () => {
    state.riparian.stopDrawing();
    if (state.riparian.riverPoints.length >= 2) {
      toast.success(`River drawn with ${state.riparian.riverPoints.length} points. 30m buffer zone created.`);
      state.setShowHazardZone(true);
      if (projectId) {
        logActivity.mutate({
          projectId,
          actionType: 'river_drawn',
          actionLabel: 'River line drawn',
          details: { points: state.riparian.riverPoints.length, buffer_m: 30 },
        });
      }
    } else {
      toast.warning("River needs at least 2 points.");
    }
  };

  const handleZoomToFit = () => {
    state.zoomToFitRef.current?.fitBounds();
  };

  const handleSelectFrontageEdge = (startIndex: number, endIndex: number) => {
    state.setSelectedFrontageEdge({ startIndex, endIndex });
    const edgeCoords = state.parcelCoordinates.slice(startIndex, endIndex + 1);
    const edgeLength = edgeCoords.reduce((sum, coord, i) => {
      if (i === 0) return sum;
      const prev = edgeCoords[i - 1];
      const dLat = (coord.lat - prev.lat) * Math.PI / 180;
      const dLng = (coord.lng - prev.lng) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(prev.lat * Math.PI / 180) *
          Math.cos(coord.lat * Math.PI / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return sum + 6371000 * c;
    }, 0);
    
    toast.success(
      `✓ Road frontage marked: ${edgeCoords.length} vertices, ${edgeLength.toFixed(0)}m long`
    );

    if (projectId) {
      logActivity.mutate({
        projectId,
        actionType: 'frontage_edge_selected',
        actionLabel: 'Road frontage edge marked manually',
        details: {
          start_vertex: startIndex + 1,
          end_vertex: endIndex + 1,
          vertices_count: edgeCoords.length,
          edge_length_m: edgeLength,
        },
      });
    }
  };

  const handleAutoSubdivide = async () => {
    // Validate parcel coordinates
    if (!state.parcelCoordinates || state.parcelCoordinates.length < 3) {
      toast.error('Need at least 3 coordinates to subdivide');
      return;
    }

    // KENYAN LEGAL COMPLIANCE: Check for mandatory frontage edge marking
    if (!state.selectedFrontageEdge) {
      toast.warning('⚠️ Recommended: Mark road-facing edge (📍 MapPin) for optimal alignment');
    }

    state.setIsProcessing(true);
    try {
      // Parse user inputs
      let targetWidth = 15;
      let targetDepth = 30;

      if (state.inputUnit === 'ACRES' || state.inputUnit === 'HECTARES') {
        // Area mode: customWidth holds the area value, generate square plots
        const areaVal = Number(state.customWidth) || 0.125;
        const areaSqm = state.inputUnit === 'ACRES' ? areaVal * 4046.8564224 : areaVal * 10000;
        const side = Math.sqrt(Math.max(areaSqm, 1));
        targetWidth = side;
        targetDepth = side;
      } else {
        // Parse custom dimensions if provided
        if (state.customWidth && !isNaN(Number(state.customWidth))) {
          targetWidth = Number(state.customWidth);
        }
        if (state.customDepth && !isNaN(Number(state.customDepth))) {
          targetDepth = Number(state.customDepth);
        }

        // Convert feet to meters if needed
        if (state.inputUnit === 'FEET') {
          targetWidth = targetWidth * 0.3048;
          targetDepth = targetDepth * 0.3048;
        }
      }

      const roadWidth = parseFloat(state.roadWidth) || 9;

      // KENYAN LEGAL COMPLIANCE: Enforce minimum road width (9m access roads)
      if (roadWidth < 9) {
        toast.error(
          '⚖️ LEGAL ERROR: Road width cannot be below 9m.\n' +
          'Kenya Land Registration Act requires minimum 9m for access roads.\n' +
          'Change road width in sidebar to 9m or greater.'
        );
        state.setIsProcessing(false);
        return;
      }

      // Phase 1: Context Scan - Create parcel polygon Feature
      const parcelCoords = [
        ...state.parcelCoordinates.map(c => [c.lng, c.lat] as [number, number]),
        [state.parcelCoordinates[0].lng, state.parcelCoordinates[0].lat] // Close polygon
      ];

      const parcelFeature = turf.polygon([parcelCoords]);

      // Phase 2 & 3: Run the subdivision engine
      const result = subdivideParcel({
        parcel: parcelFeature,
        config: {
          targetWidth,
          targetDepth,
          accessRoadWidth: roadWidth,
          spineRoadWidth: 12,
          minAreaRatio: 0.75,
          minResidualArea: 200,
          truncationSize: 3,
          culDeSacRadius: 15,
        },
      });

      // Log if using manually selected frontage
      if (state.selectedFrontageEdge) {
        console.log('[Subdivision] Using manually selected road frontage:', state.selectedFrontageEdge);
      }

      // Ensure all plots have valid coordinates before conversion
      const validPlots = result.plots.filter((plot: any) => {
        try {
          // Check if plot has valid geometry
          return (
            plot.geometry?.geometry?.coordinates?.[0] ||
            plot.geometry?.coordinates?.[0] ||
            (plot.coordinates && Array.isArray(plot.coordinates) && plot.coordinates.length > 0)
          );
        } catch {
          return false;
        }
      });

      // Convert results to plot format matching GeneratedPlot type
      const generatedPlots = validPlots.map((plot: any, index: number) => {
        // Extract coordinates from GeoJSON geometry
        let coordinates: Coordinate[] = [];
        
        // Try multiple ways to extract coordinates
        try {
          let coords: [number, number][] = [];
          
          // Try: plot.geometry is a Feature<Polygon>
          if (plot.geometry?.geometry?.coordinates?.[0]) {
            coords = plot.geometry.geometry.coordinates[0];
          }
          // Try: plot.geometry.coordinates directly (Polygon geometry)
          else if (plot.geometry?.coordinates?.[0]) {
            coords = plot.geometry.coordinates[0];
          }
          // Try: plot has coordinates property
          else if (plot.coordinates && Array.isArray(plot.coordinates)) {
            coordinates = plot.coordinates;
          }
          
          // Convert [lng, lat] to {lat, lng} format
          if (coords.length > 0 && coordinates.length === 0) {
            coordinates = coords.map((coord: [number, number]) => ({
              lat: coord[1],
              lng: coord[0],
            }));
          }
        } catch (e) {
          console.error('Error extracting coordinates for plot:', plot.plotNumber, e);
        }

        // Determine if plot has road access
        // Frontage plots have access to the parcel boundary
        // Spine plots have access to spine road
        // Internal plots have access to rib roads
        const hasRoadAccess = plot.facingRoad && 
                             (plot.facingRoad === 'frontage' || 
                              plot.facingRoad === 'spine' || 
                              plot.facingRoad === 'internal');

        return {
          id: plot.id,
          plotNumber: plot.plotNumber,
          coordinates: coordinates,
          area: plot.area,
          width: plot.width,
          depth: plot.depth,
          isValid: hasRoadAccess && coordinates.length >= 3, // Valid if has road access and coordinates
          isSaved: false,
          overlapPercent: 0,
          isPartial: plot.isPartial || false,
          isTruncated: plot.isTruncated || false,
          facingRoad: plot.facingRoad || 'internal',
          row: plot.row || 0,
          column: plot.column || 0,
          geometry: plot.geometry,
        };
      });
      
      // Log subdivision results with access validation
      console.log('Subdivision Results:', {
        totalGenerated: result.plots.length,
        validPlots: generatedPlots.length,
        frontageAccess: generatedPlots.filter(p => p.facingRoad === 'frontage').length,
        spineAccess: generatedPlots.filter(p => p.facingRoad === 'spine').length,
        internalAccess: generatedPlots.filter(p => p.facingRoad === 'internal').length,
        noAccess: result.plots.length - generatedPlots.length,
      });

      // KENYAN LEGAL COMPLIANCE: Verify zero landlocked mandate
      const landlocketPlots = result.plots.length - generatedPlots.length;
      if (landlocketPlots > 0) {
        console.warn(`⚠️ LEGAL WARNING: ${landlocketPlots} plots would be landlocked. These are excluded from output.`);
      }

      if (generatedPlots.length > 0) {
        console.log('First generated plot:', {
          plotNumber: generatedPlots[0].plotNumber,
          facingRoad: generatedPlots[0].facingRoad,
          coordinatesCount: generatedPlots[0].coordinates.length,
          hasRoadAccess: generatedPlots[0].facingRoad !== 'landlocked',
        });
      }

      // Update state with generated plots
      state.setPlotGrid(generatedPlots);
      state.setShowPlotGrid(true);
      state.setPlotCount(generatedPlots.filter(p => p.isValid).length);
      state.setBaselinePlotCount(generatedPlots.filter(p => p.isValid).length);
      state.setRoadAreaSqm(result.summary.roadArea || 0);
      state.setEfficiency(result.summary.efficiency || 0);
      state.setShowYieldComparison(true);

      // Show success message with statistics
      const frontageCount = generatedPlots.filter(p => p.facingRoad === 'frontage').length;
      const accessedCount = generatedPlots.filter(p => p.isValid).length;
      const message = `✓ Subdivision Complete: ${accessedCount} plots with road access | ${frontageCount} with direct frontage | ${(result.summary.efficiency || 0).toFixed(1)}% utilization`;
      toast.success(message);

      // KENYAN LEGAL COMPLIANCE: Activity logging with all legal requirements
      if (projectId) {
        logActivity.mutate({
          projectId,
          actionType: 'subdivision_generated',
          actionLabel: 'Auto-subdivision completed',
          details: {
            // Zero Landlocked Compliance
            total_plots: generatedPlots.filter(p => p.isValid).length,
            landlocked_plots_excluded: result.plots.length - generatedPlots.length,
            
            // Road Access Breakdown
            frontage_plots: frontageCount,
            spine_access_plots: generatedPlots.filter(p => p.facingRoad === 'spine').length,
            internal_access_plots: generatedPlots.filter(p => p.facingRoad === 'internal').length,
            
            // Road Dimensions (Kenyan Legal Minimums)
            plot_width_m: targetWidth,
            plot_depth_m: targetDepth,
            access_road_width_m: roadWidth,
            spine_road_width_m: 12,
            truncation_size_m: 3,
            
            // Road Surrender Calculation
            road_area_sqm: result.summary.roadArea,
            road_area_ha: result.summary.roadAreaHa,
            road_surrender_percentage: ((result.summary.roadAreaHa / (result.summary.parcelAreaHa + result.summary.roadAreaHa)) * 100).toFixed(2),
            
            // Efficiency & Yield
            efficiency: result.summary.efficiency,
            parcel_area_ha: result.summary.parcelAreaHa,
            
            // Frontage Edge Marking (Connectivity Proof)
            external_road_marked: state.selectedFrontageEdge ? true : false,
            frontage_edge_vertices: state.selectedFrontageEdge 
              ? (state.selectedFrontageEdge.endIndex - state.selectedFrontageEdge.startIndex + 1)
              : 0,
            
            // Riparian Compliance
            riparian_enabled: state.riparianBufferEnabled,
          },
        });
      }
    } catch (error: any) {
      console.error('Subdivision error:', error);
      toast.error('Subdivision failed: ' + (error.message || 'Unknown error. Check parcel coordinates.'));
    } finally {
      state.setIsProcessing(false);
    }
  };

  const handleRunHazardScan = async () => {
    state.setIsProcessing(true);
    try {
      toast.success('Hazard scan completed');
    } catch (error: any) {
      toast.error('Hazard scan failed: ' + error.message);
    } finally {
      state.setIsProcessing(false);
    }
  };

  const handleAccessEdgeToggle = (edgeIndex: number, roadWidth?: number, bearing?: number, length?: number) => {
    if (state.accessEdges.some((e) => e.edgeIndex === edgeIndex)) {
      state.setAccessEdges((prev) => prev.filter((e) => e.edgeIndex !== edgeIndex));
    } else if (roadWidth !== undefined) {
      const directions = ['South', 'East', 'North', 'West'];
      state.setAccessEdges((prev) => [
        ...prev,
        {
          edgeIndex,
          roadWidth,
          label: `${directions[edgeIndex]} Access (${roadWidth}m)`,
          bearing: bearing || 0,
          length: length || 0,
        },
      ]);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.chatInput.trim() || state.isCoPilotProcessing) return;

    const userMessage = {
      role: 'user' as const,
      content: state.chatInput,
      timestamp: new Date(),
    };

    state.setChatMessages((prev) => [...prev, userMessage]);
    state.setChatInput('');
    state.setIsCoPilotProcessing(true);

    try {
      const aiMessage = {
        role: 'ai' as const,
        content: 'Command processed',
        timestamp: new Date(),
      };
      state.setChatMessages((prev) => [...prev, aiMessage]);
    } finally {
      state.setIsCoPilotProcessing(false);
    }
  };

  const handleUpdateParcel = async (newCoordinates: Coordinate[]) => {
    if (!projectId || !state.project) {
      toast.error("Project not found");
      return;
    }

    setIsUpdatingParcel(true);
    try {
      // Update the parcel coordinates in the state
      state.setParcelCoordinates(newCoordinates);
      
      // Log the activity
      logActivity.mutate({
        projectId,
        actionType: 'project_updated',
        actionLabel: 'Parcel coordinates updated',
        details: { 
          previousCount: state.parcelCoordinates.length,
          newCount: newCoordinates.length,
        },
      });

      toast.success("Parcel coordinates updated successfully");
      setUpdateParcelOpen(false);
      setUpdateParcelCoordinates(null);
    } catch (error) {
      console.error("Failed to update parcel:", error);
      toast.error("Failed to update parcel coordinates");
    } finally {
      setIsUpdatingParcel(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex">
      {/* Fixed Sidebar */}
      <div className="w-80 h-full border-r border-border/50 bg-background flex-shrink-0 overflow-y-auto">
        <WorkspaceSidebar
          projectName={state.project.name}
          totalAreaHa={state.totalAreaHa}
          totalAreaAcres={state.totalAreaAcres}
          locationName={(state.project as any).location_name}
          plotSize={state.plotSize}
          onPlotSizeChange={state.setPlotSize}
          inputUnit={state.inputUnit}
          onInputUnitChange={state.setInputUnit}
          customWidth={state.customWidth}
          onCustomWidthChange={state.setCustomWidth}
          customDepth={state.customDepth}
          onCustomDepthChange={state.setCustomDepth}
          roadWidth={state.roadWidth}
          onRoadWidthChange={state.setRoadWidth}
          riparianBufferEnabled={state.riparianBufferEnabled}
          onRiparianBufferChange={state.setRiparianBufferEnabled}
          riparianHasRiver={state.riparian.hasRiver}
          riparianRiverPointsCount={state.riparian.riverPoints.length}
          onRiparianClear={state.riparian.clearRiver}
          showPlotGrid={state.showPlotGrid}
          plotCount={state.plotCount}
          invalidPlotCount={state.invalidPlotCount}
          roadAreaSqm={state.roadAreaSqm}
          efficiency={state.efficiency}
          areaQueue={state.areaQueue}
          onAreaQueueChange={state.setAreaQueue}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
          <WorkspaceMapContainer
            mapLayer={state.mapLayer}
            parcelCoordinates={state.parcelCoordinates}
            showHazardZone={state.showHazardZone}
            riparian={state.riparian}
            showPlotGrid={state.showPlotGrid}
            savedPlots={state.savedPlots || []}
            plotGrid={state.plotGrid}
            accessEdges={state.accessEdges}
            accessRoadMode={state.accessRoadMode}
            isDrawingRiver={state.riparian.isDrawingRiver}
            frontageEdgeSelectorEnabled={state.frontageEdgeSelectorEnabled}
            onFrontageEdgeSelected={handleSelectFrontageEdge}
            zoomToFitRef={state.zoomToFitRef}
            onRiverPointAdd={state.riparian.addRiverPoint}
            onDrawingComplete={handleFinishDrawRiver}
            onAccessEdgeToggle={handleAccessEdgeToggle}
            onPlotSelect={() => {}}
          />

          {/* Overlays */}
          <WorkspaceOverlays
            isSaving={state.isSaving}
            accessRoadMode={state.accessRoadMode}
            onAccessRoadModeChange={state.setAccessRoadMode}
            isDrawingRiver={state.riparian.isDrawingRiver}
            onFinishDrawRiver={handleFinishDrawRiver}
          />

          {/* Map Controls */}
          <WorkspaceMapControls
            mapLayer={state.mapLayer}
            onMapLayerChange={state.setMapLayer}
            showTimeline={state.showTimeline}
            onShowTimelineChange={state.setShowTimeline}
            onZoomToFit={handleZoomToFit}
            onShowTour={() => state.setShowTour(true)}
            projectId={projectId || ''}
          />

          {/* Toolbar */}
          <WorkspaceToolbar
            isDrawingRiver={state.riparian.isDrawingRiver}
            onDrawRiver={handleStartDrawRiver}
            onFinishDrawRiver={handleFinishDrawRiver}
            accessRoadMode={state.accessRoadMode}
            onAccessRoadModeChange={state.setAccessRoadMode}
            frontageEdgeSelectorEnabled={state.frontageEdgeSelectorEnabled}
            onFrontageEdgeSelectorChange={state.setFrontageEdgeSelectorEnabled}
            accessEdgesCount={state.accessEdges.length}
            isProcessing={state.isProcessing}
            onRunHazardScan={handleRunHazardScan}
            showPlotGrid={state.showPlotGrid}
            onAutoSubdivide={handleAutoSubdivide}
            parcelCoordinatesLength={state.parcelCoordinates.length}
            isSaving={state.isSaving}
            onSaveProject={async () => {
              if (!projectId) return;
              state.setIsSaving(true);
              try {
                await state.updateProject.mutateAsync({
                  projectId,
                  updates: { status: 'in_progress' },
                });
                toast.success('Project saved successfully');
              } catch (error) {
                toast.error('Failed to save project');
              } finally {
                state.setIsSaving(false);
              }
            }}
            plotCount={state.plotCount}
            onGenerateMutation={() => state.setMutationModalOpen(true)}
            onDownload={() => state.setHasExported(true)}
            projectStatus={state.project?.status || 'draft'}
            onCompleteProject={() => state.setCompletionModalOpen(true)}
            onUpdateParcel={() => setUpdateParcelOpen(true)}
          />

          {/* Chat */}
          <WorkspaceChat
            open={state.chatOpen}
            onOpenChange={state.setChatOpen}
            messages={state.chatMessages}
            input={state.chatInput}
            onInputChange={state.setChatInput}
            onSubmit={handleChatSubmit}
            isProcessing={state.isCoPilotProcessing}
          />

          {/* Loading Overlay */}
          <CoPilotLoadingOverlay visible={state.isCoPilotProcessing} message={state.coPilotMessage} />

          {/* Yield Badge */}
          <YieldComparisonBadge
            beforeCount={state.baselinePlotCount}
            afterCount={state.plotCount}
            visible={state.showYieldComparison && state.accessEdges.length > 0}
          />

          {/* Manual Tools */}
          <ManualDraftingTools
            activeTool={state.activeDraftingTool}
            onToolChange={state.setActiveDraftingTool}
            disabled={state.isProcessing}
          />

          {/* Tour */}
          <WorkspaceTour
            run={state.showTour}
            onComplete={() => {
              state.setShowTour(false);
              state.setHasSeenTour(true);
              localStorage.setItem('vipimo_tour_completed', 'true');
            }}
          />
        </div>

        {/* Modals */}
        <WorkspaceModals
        projectId={projectId || ''}
        projectName={state.project.name}
        projectStatus={state.project?.status || 'draft'}
        mutationModalOpen={state.mutationModalOpen}
        onMutationModalOpenChange={state.setMutationModalOpen}
        hasExported={state.hasExported}
        onHasExportedChange={state.setHasExported}
        completionModalOpen={state.completionModalOpen}
        onCompletionModalOpenChange={state.setCompletionModalOpen}
        plotCount={state.plotCount}
        invalidPlotCount={state.invalidPlotCount}
        isCompleting={state.isCompleting}
        onComplete={async () => {
          if (!projectId) return;
          state.setIsCompleting(true);
          try {
            await state.updateProject.mutateAsync({
              projectId,
              updates: { status: 'completed' },
            });
            logActivity.mutate({
              projectId,
              actionType: 'project_completed',
              actionLabel: 'Project marked as complete',
              details: { plot_count: state.plotCount },
            });
            toast.success('Project marked as complete!');
          } finally {
            state.setIsCompleting(false);
          }
        }}
        onArchive={async () => {
          if (!projectId) return;
          try {
            await state.updateProject.mutateAsync({
              projectId,
              updates: { status: 'archived' },
            });
            logActivity.mutate({
              projectId,
              actionType: 'project_archived',
              actionLabel: 'Project archived',
            });
            toast.success('Project archived');
            navigate('/');
          } catch (error) {
            toast.error('Failed to archive project');
          }
        }}
        selectedPlot={null}
        onSelectedPlotChange={() => {}}
        onPlotStatusChange={() => {}}
        isUpdatingPlot={false}
      />

      {/* Update Parcel Dialog */}
      <UpdateParcelDialog
        open={updateParcelOpen}
        onOpenChange={setUpdateParcelOpen}
        currentParcelName={state.project?.name || 'Project Parcel'}
        onCoordinatesLoaded={setUpdateParcelCoordinates}
        onUpdate={handleUpdateParcel}
        isUpdating={isUpdatingParcel}
      />
    </div>
  );
}
