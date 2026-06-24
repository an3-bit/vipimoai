import { useState, useCallback } from "react";
import {
  Settings,
  Wand2,
  RotateCw,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Coordinate,
  SubdivisionFormData,
  AISuggestion,
  Plot,
  Beacon,
} from "@/types/survey";
import { useAISubdivision } from "@/hooks/useSurvey";
import { toast } from "sonner";

interface SubdivisionFormProps {
  parcelCoordinates: Coordinate[];
  onSubdivisionComplete: (
    plots: Plot[],
    beacons: Beacon[],
    suggestions: AISuggestion[],
  ) => void;
  /** STEP 2: Total area in hectares from backend */
  totalAreaHa?: number;
  /** STEP 2: Frontage edges selected by user */
  selectedFrontageEdge?: { startIndex: number; endIndex: number } | null;
}

const FEET_TO_METERS = 0.3048;

export function SubdivisionForm({
  parcelCoordinates,
  onSubdivisionComplete,
  totalAreaHa,
  selectedFrontageEdge,
}: SubdivisionFormProps) {
  // Preset and unit state
  const [plotPreset, setPlotPreset] = useState("50x100ft");
  const [inputUnit, setInputUnit] = useState<"FEET" | "METERS">("FEET");

  // STEP 2: Multi-target areas input (comma-separated: "5.0, 2.0, 1.0")
  const [multiTargetAreasInput, setMultiTargetAreasInput] = useState("");
  const [targetAreaUnit, setTargetAreaUnit] = useState<"hectares" | "acres">(
    "hectares",
  );

  const [formData, setFormData] = useState<SubdivisionFormData>({
    plot_width: 15.24, // Will be calculated from preset
    plot_depth: 30.48,
    strategy: "auto_fit",
    orientation_degrees: 0,
    road_setback_m: 5,
    side_setback_m: 3,
  });

  const aiSubdivision = useAISubdivision();

  // Get dimensions in meters based on preset or custom input
  const getDimensionsInMeters = useCallback(() => {
    switch (plotPreset) {
      case "50x100ft":
        return { width: 50 * FEET_TO_METERS, depth: 100 * FEET_TO_METERS };
      case "40x80ft":
        return { width: 40 * FEET_TO_METERS, depth: 80 * FEET_TO_METERS };
      case "100x100ft":
        return { width: 100 * FEET_TO_METERS, depth: 100 * FEET_TO_METERS };
      case "custom":
        return {
          width:
            inputUnit === "FEET"
              ? formData.plot_width * FEET_TO_METERS
              : formData.plot_width,
          depth:
            inputUnit === "FEET"
              ? formData.plot_depth * FEET_TO_METERS
              : formData.plot_depth,
        };
      default:
        return { width: 15.24, depth: 30.48 };
    }
  }, [plotPreset, formData.plot_width, formData.plot_depth, inputUnit]);

  // STEP 2: Parse multi-target areas from comma-separated string
  const parseMultiTargetAreas = useCallback(() => {
    if (!multiTargetAreasInput.trim()) return [];

    const values = multiTargetAreasInput
      .split(",")
      .map((v) => parseFloat(v.trim()))
      .filter((v) => !isNaN(v) && v > 0);

    return values.map((value) => ({
      value,
      unit: targetAreaUnit.toUpperCase() as "HECTARES" | "ACRES",
    }));
  }, [multiTargetAreasInput, targetAreaUnit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parcelCoordinates.length < 3) {
      toast.error("Please upload a parcel first");
      return;
    }

    try {
      // Determine strategy and payload
      const strategy = multiTargetAreasInput.trim()
        ? "succession"
        : formData.strategy;
      const targetAreas = multiTargetAreasInput.trim()
        ? parseMultiTargetAreas()
        : undefined;

      // Validate multi-target areas if provided
      if (
        strategy === "succession" &&
        (!targetAreas || targetAreas.length === 0)
      ) {
        toast.error(
          'Please enter target areas (e.g., "5.0, 2.0, 1.0") for succession strategy',
        );
        return;
      }

      // Get dimensions in meters for rectangular strategies
      const { width, depth } = getDimensionsInMeters();

      // Build frontage_edges array
      const frontageEdges = selectedFrontageEdge
        ? [
            {
              start_index: selectedFrontageEdge.startIndex,
              end_index: selectedFrontageEdge.endIndex,
            },
          ]
        : [];

      const result = await aiSubdivision.mutateAsync({
        parcelCoordinates,
        formData: {
          ...formData,
          plot_width: strategy === "succession" ? undefined : width,
          plot_depth: strategy === "succession" ? undefined : depth,
          strategy,
          target_areas: targetAreas,
          frontage_edges: frontageEdges,
        } as any,
      });

      if (result.success) {
        const plots: Plot[] = result.results.plots.map((p: any) => ({
          id: crypto.randomUUID(),
          plot_number: p.plot_number,
          coordinates: p.coordinates,
          area_sqm: p.area_sqm,
          width_m: p.width_m,
          depth_m: p.depth_m,
          is_partial: p.is_partial,
        }));

        const beacons: Beacon[] = result.results.beacons.map((b: any) => ({
          id: crypto.randomUUID(),
          beacon_number: b.beacon_number,
          latitude: b.latitude,
          longitude: b.longitude,
          description: b.description,
        }));

        onSubdivisionComplete(plots, beacons, result.suggestions || []);
        toast.success(
          `Generated ${plots.length} plots with ${beacons.length} beacons`,
        );
      } else {
        toast.error(result.error || "Subdivision failed");
      }
    } catch (error) {
      console.error("Subdivision error:", error);
      toast.error("Failed to subdivide parcel");
    }
  };

  const updateField = <K extends keyof SubdivisionFormData>(
    field: K,
    value: SubdivisionFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card variant="glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-survey-primary" />
          Subdivision Setup
        </CardTitle>
        <CardDescription>
          Configure plot dimensions and subdivision strategy
          {totalAreaHa && ` — Parcel: ${totalAreaHa.toFixed(4)} hectares`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* STEP 2: Multi-Target Areas Section (NEW) */}
          <div className="space-y-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-amber-900">
              <TrendingUp className="h-4 w-4" />
              STEP 2: Multi-Target Subdivision (Succession)
            </h4>
            <p className="text-xs text-amber-800">
              Enter comma-separated target areas to create plots with specific
              sizes. Example: "5.0, 2.0, 1.0"
            </p>

            <div className="space-y-2">
              <Label htmlFor="multi_target_areas">Target Areas</Label>
              <Input
                id="multi_target_areas"
                type="text"
                placeholder="e.g., 5.0, 2.0, 1.0, 1.0"
                value={multiTargetAreasInput}
                onChange={(e) => setMultiTargetAreasInput(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-amber-900">Unit:</Label>
              <div className="flex rounded-md border border-amber-300 overflow-hidden">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    targetAreaUnit === "hectares"
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 hover:bg-amber-200"
                  }`}
                  onClick={() => setTargetAreaUnit("hectares")}
                >
                  Hectares
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    targetAreaUnit === "acres"
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 hover:bg-amber-200"
                  }`}
                  onClick={() => setTargetAreaUnit("acres")}
                >
                  Acres
                </button>
              </div>
            </div>

            {multiTargetAreasInput.trim() && (
              <div className="text-xs text-amber-800">
                ✓ {parseMultiTargetAreas().length} target areas will be used
                {selectedFrontageEdge &&
                  ` • Frontage edges: Index ${selectedFrontageEdge.startIndex}-${selectedFrontageEdge.endIndex}`}
              </div>
            )}
          </div>

          {/* Traditional Subdivision (shown if multi-target not filled) */}
          {!multiTargetAreasInput.trim() && (
            <>
              {/* Plot Dimensions */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-survey-accent" />
                  Plot Dimensions
                </h4>

                {/* Preset Dropdown */}
                <div className="space-y-2">
                  <Label>Size Preset</Label>
                  <Select
                    value={plotPreset}
                    onValueChange={(v) => {
                      setPlotPreset(v);
                      if (v !== "custom") setInputUnit("FEET");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50x100ft">
                        50 × 100 ft (Standard)
                      </SelectItem>
                      <SelectItem value="40x80ft">
                        40 × 80 ft (Compact)
                      </SelectItem>
                      <SelectItem value="100x100ft">
                        100 × 100 ft (Quarter Acre)
                      </SelectItem>
                      <SelectItem value="custom">Custom Dimensions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom dimensions with unit toggle */}
                {plotPreset === "custom" && (
                  <>
                    {/* Unit Toggle */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Unit:
                      </Label>
                      <div className="flex rounded-md border border-border/50 overflow-hidden">
                        <button
                          type="button"
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            inputUnit === "FEET"
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary/50 hover:bg-secondary"
                          }`}
                          onClick={() => setInputUnit("FEET")}
                        >
                          Feet
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            inputUnit === "METERS"
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary/50 hover:bg-secondary"
                          }`}
                          onClick={() => setInputUnit("METERS")}
                        >
                          Meters
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="plot_width">
                          Width ({inputUnit === "FEET" ? "ft" : "m"})
                        </Label>
                        <Input
                          id="plot_width"
                          type="number"
                          min={5}
                          max={500}
                          step={1}
                          value={formData.plot_width}
                          onChange={(e) =>
                            updateField(
                              "plot_width",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="font-mono"
                          placeholder={inputUnit === "FEET" ? "50" : "15.24"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="plot_depth">
                          Depth ({inputUnit === "FEET" ? "ft" : "m"})
                        </Label>
                        <Input
                          id="plot_depth"
                          type="number"
                          min={5}
                          max={500}
                          step={1}
                          value={formData.plot_depth}
                          onChange={(e) =>
                            updateField(
                              "plot_depth",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="font-mono"
                          placeholder={inputUnit === "FEET" ? "100" : "30.48"}
                        />
                      </div>
                    </div>

                    {/* Conversion preview */}
                    <p className="text-xs text-muted-foreground">
                      {inputUnit === "FEET" ? (
                        <>
                          ≈ {(formData.plot_width * FEET_TO_METERS).toFixed(2)}m
                          × {(formData.plot_depth * FEET_TO_METERS).toFixed(2)}m
                        </>
                      ) : (
                        <>
                          ≈ {(formData.plot_width / FEET_TO_METERS).toFixed(1)}
                          ft ×{" "}
                          {(formData.plot_depth / FEET_TO_METERS).toFixed(1)}ft
                        </>
                      )}
                    </p>
                  </>
                )}

                {/* Area display for presets */}
                {plotPreset !== "custom" && (
                  <p className="text-xs text-muted-foreground">
                    Plot area:{" "}
                    {(() => {
                      const { width, depth } = getDimensionsInMeters();
                      return `${(width * depth).toFixed(0)} m² (${((width * depth) / 10000).toFixed(3)} Ha)`;
                    })()}
                  </p>
                )}
              </div>

              {/* Strategy Selection */}
              <div className="space-y-2">
                <Label>Subdivision Strategy</Label>
                <Select
                  value={formData.strategy}
                  onValueChange={(v) =>
                    updateField(
                      "strategy",
                      v as SubdivisionFormData["strategy"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto_fit">
                      <div className="flex items-center gap-2">
                        <Wand2 className="h-4 w-4" />
                        Auto-fit (Maximum plots)
                      </div>
                    </SelectItem>
                    <SelectItem value="fixed_count">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Fixed Count
                      </div>
                    </SelectItem>
                    <SelectItem value="equal_resize">
                      <div className="flex items-center gap-2">
                        <RotateCw className="h-4 w-4" />
                        Equal Resize
                      </div>
                    </SelectItem>
                    <SelectItem value="extract_full">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Extract Full Only
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target Count (for fixed_count and equal_resize) */}
              {(formData.strategy === "fixed_count" ||
                formData.strategy === "equal_resize") && (
                <div className="space-y-2">
                  <Label htmlFor="target_count">Target Plot Count</Label>
                  <Input
                    id="target_count"
                    type="number"
                    min={1}
                    max={100}
                    value={formData.target_plot_count || ""}
                    onChange={(e) =>
                      updateField(
                        "target_plot_count",
                        parseInt(e.target.value) || undefined,
                      )
                    }
                    placeholder="Number of plots"
                    className="font-mono"
                  />
                </div>
              )}

              {/* Setbacks */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-survey-accent" />
                  Setbacks
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="road_setback">Road Setback (m)</Label>
                    <Input
                      id="road_setback"
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      value={formData.road_setback_m}
                      onChange={(e) =>
                        updateField(
                          "road_setback_m",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="side_setback">Side Setback (m)</Label>
                    <Input
                      id="side_setback"
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      value={formData.side_setback_m}
                      onChange={(e) =>
                        updateField(
                          "side_setback_m",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Orientation */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Orientation (degrees)</Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {formData.orientation_degrees}°
                  </span>
                </div>
                <Slider
                  value={[formData.orientation_degrees]}
                  onValueChange={([v]) => updateField("orientation_degrees", v)}
                  min={0}
                  max={180}
                  step={5}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Special requirements, access roads, etc."
                  value={formData.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  className="h-20"
                />
              </div>
            </>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="survey"
            className="w-full"
            disabled={aiSubdivision.isPending || parcelCoordinates.length < 3}
          >
            {aiSubdivision.isPending ? (
              <>
                <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Subdivision
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
