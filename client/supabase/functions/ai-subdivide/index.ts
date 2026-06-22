import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Coordinate {
  lat: number;
  lng: number;
}

interface SubdivisionRequest {
  parcelCoordinates: Coordinate[];
  plot_width: number;
  plot_depth: number;
  target_plot_count?: number;
  strategy: 'auto_fit' | 'fixed_count' | 'equal_resize' | 'extract_full';
  orientation_degrees?: number;
  road_setback_m?: number;
  side_setback_m?: number;
  notes?: string;
}

interface Plot {
  plot_number: number;
  coordinates: Coordinate[];
  area_sqm: number;
  width_m: number;
  depth_m: number;
  is_partial: boolean;
}

interface Beacon {
  beacon_number: number;
  latitude: number;
  longitude: number;
  description: string;
}

interface AISuggestion {
  type: 'resize' | 'extract_full' | 'alternative_layout' | 'warning';
  message: string;
  suggested_width?: number;
  suggested_depth?: number;
  suggested_count?: number;
}

// Helper functions for geometry calculations
function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371000; // Earth's radius in meters
  const lat1 = coord1.lat * Math.PI / 180;
  const lat2 = coord2.lat * Math.PI / 180;
  const deltaLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const deltaLng = (coord2.lng - coord1.lng) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function calculatePolygonArea(coordinates: Coordinate[]): number {
  if (coordinates.length < 3) return 0;
  const R = 6371000;
  let total = 0;
  const toRad = (deg: number) => deg * Math.PI / 180;
  
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    const lat1 = toRad(coordinates[i].lat);
    const lng1 = toRad(coordinates[i].lng);
    const lat2 = toRad(coordinates[j].lat);
    const lng2 = toRad(coordinates[j].lng);
    total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(total * R * R / 2);
}

function getBoundingBox(coordinates: Coordinate[]) {
  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

// Basic subdivision algorithm
function subdivideRectangular(
  coordinates: Coordinate[],
  plotWidth: number,
  plotDepth: number,
  roadSetback: number,
  sideSetback: number,
  strategy: string,
  targetCount?: number
): { plots: Plot[]; beacons: Beacon[]; suggestions: AISuggestion[] } {
  const bbox = getBoundingBox(coordinates);
  const parcelWidth = calculateDistance(
    { lat: bbox.minLat, lng: bbox.minLng },
    { lat: bbox.minLat, lng: bbox.maxLng }
  );
  const parcelDepth = calculateDistance(
    { lat: bbox.minLat, lng: bbox.minLng },
    { lat: bbox.maxLat, lng: bbox.minLng }
  );

  const effectiveWidth = parcelWidth - (2 * sideSetback);
  const effectiveDepth = parcelDepth - roadSetback;
  const parcelArea = calculatePolygonArea(coordinates);

  let finalPlotWidth = plotWidth;
  let finalPlotDepth = plotDepth;
  const suggestions: AISuggestion[] = [];

  // Calculate max plots that can fit
  const maxPlotsPerRow = Math.floor(effectiveWidth / plotWidth);
  const maxRows = Math.floor(effectiveDepth / plotDepth);
  const maxTotalPlots = maxPlotsPerRow * maxRows;

  // Strategy handling
  if (strategy === 'fixed_count' && targetCount) {
    if (targetCount > maxTotalPlots) {
      suggestions.push({
        type: 'warning',
        message: `Cannot fit ${targetCount} plots. Maximum possible: ${maxTotalPlots} plots.`,
        suggested_count: maxTotalPlots,
      });
    }
  }

  if (strategy === 'equal_resize' && targetCount) {
    // Resize plots to fit exact count
    const plotsPerRow = Math.ceil(Math.sqrt(targetCount));
    const rows = Math.ceil(targetCount / plotsPerRow);
    finalPlotWidth = effectiveWidth / plotsPerRow;
    finalPlotDepth = effectiveDepth / rows;
    
    suggestions.push({
      type: 'resize',
      message: `Plots resized to ${finalPlotWidth.toFixed(1)}m × ${finalPlotDepth.toFixed(1)}m to fit ${targetCount} plots evenly.`,
      suggested_width: finalPlotWidth,
      suggested_depth: finalPlotDepth,
    });
  }

  if (maxTotalPlots === 0) {
    const minPlotArea = plotWidth * plotDepth;
    const suggestedWidth = Math.sqrt(parcelArea / 4 * (plotWidth / plotDepth));
    const suggestedDepth = suggestedWidth * (plotDepth / plotWidth);
    
    suggestions.push({
      type: 'alternative_layout',
      message: `Current plot size (${plotWidth}m × ${plotDepth}m) is too large. Consider ${suggestedWidth.toFixed(1)}m × ${suggestedDepth.toFixed(1)}m for 4 plots.`,
      suggested_width: suggestedWidth,
      suggested_depth: suggestedDepth,
      suggested_count: 4,
    });

    return { plots: [], beacons: [], suggestions };
  }

  // Generate plots
  const plots: Plot[] = [];
  const beacons: Beacon[] = [];
  let beaconCounter = 1;

  const plotsPerRow = strategy === 'equal_resize' && targetCount 
    ? Math.ceil(Math.sqrt(targetCount))
    : maxPlotsPerRow;
  const rows = strategy === 'equal_resize' && targetCount
    ? Math.ceil(targetCount / plotsPerRow)
    : maxRows;

  const latPerMeter = (bbox.maxLat - bbox.minLat) / parcelDepth;
  const lngPerMeter = (bbox.maxLng - bbox.minLng) / parcelWidth;

  const startLng = bbox.minLng + (sideSetback * lngPerMeter);
  const startLat = bbox.minLat + (roadSetback * latPerMeter);

  let plotNumber = 1;
  const maxPlots = strategy === 'fixed_count' && targetCount 
    ? Math.min(targetCount, maxTotalPlots)
    : plotsPerRow * rows;

  for (let row = 0; row < rows && plotNumber <= maxPlots; row++) {
    for (let col = 0; col < plotsPerRow && plotNumber <= maxPlots; col++) {
      const plotMinLat = startLat + (row * finalPlotDepth * latPerMeter);
      const plotMaxLat = plotMinLat + (finalPlotDepth * latPerMeter);
      const plotMinLng = startLng + (col * finalPlotWidth * lngPerMeter);
      const plotMaxLng = plotMinLng + (finalPlotWidth * lngPerMeter);

      const plotCoordinates: Coordinate[] = [
        { lat: plotMinLat, lng: plotMinLng },
        { lat: plotMinLat, lng: plotMaxLng },
        { lat: plotMaxLat, lng: plotMaxLng },
        { lat: plotMaxLat, lng: plotMinLng },
      ];

      const plotArea = calculatePolygonArea(plotCoordinates);

      plots.push({
        plot_number: plotNumber,
        coordinates: plotCoordinates,
        area_sqm: plotArea,
        width_m: finalPlotWidth,
        depth_m: finalPlotDepth,
        is_partial: false,
      });

      // Add beacons for this plot
      plotCoordinates.forEach((coord, idx) => {
        beacons.push({
          beacon_number: beaconCounter++,
          latitude: coord.lat,
          longitude: coord.lng,
          description: `Plot ${plotNumber} - Corner ${idx + 1}`,
        });
      });

      plotNumber++;
    }
  }

  // Check for leftover space
  const usedWidth = plotsPerRow * finalPlotWidth;
  const usedDepth = rows * finalPlotDepth;
  const remainderWidth = effectiveWidth - usedWidth;
  const remainderDepth = effectiveDepth - usedDepth;

  if (remainderWidth > 5 || remainderDepth > 5) {
    suggestions.push({
      type: 'extract_full',
      message: `${plots.length} full plots extracted. Remaining space: ${remainderWidth.toFixed(1)}m width, ${remainderDepth.toFixed(1)}m depth.`,
      suggested_count: plots.length,
    });
  }

  return { plots, beacons, suggestions };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SubdivisionRequest = await req.json();
    console.log('Subdivision request:', JSON.stringify(body, null, 2));

    const {
      parcelCoordinates,
      plot_width,
      plot_depth,
      target_plot_count,
      strategy = 'auto_fit',
      orientation_degrees = 0,
      road_setback_m = 0,
      side_setback_m = 0,
      notes,
    } = body;

    if (!parcelCoordinates || parcelCoordinates.length < 3) {
      return new Response(
        JSON.stringify({ error: 'At least 3 coordinates required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!plot_width || !plot_depth || plot_width <= 0 || plot_depth <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid plot dimensions required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate parcel metrics
    const parcelArea = calculatePolygonArea(parcelCoordinates);
    const bbox = getBoundingBox(parcelCoordinates);
    const parcelWidth = calculateDistance(
      { lat: bbox.minLat, lng: bbox.minLng },
      { lat: bbox.minLat, lng: bbox.maxLng }
    );
    const parcelDepth = calculateDistance(
      { lat: bbox.minLat, lng: bbox.minLng },
      { lat: bbox.maxLat, lng: bbox.minLng }
    );

    console.log(`Parcel: ${parcelArea.toFixed(2)} sqm, ${parcelWidth.toFixed(2)}m x ${parcelDepth.toFixed(2)}m`);

    // Use AI for complex analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiAnalysis = null;

    if (LOVABLE_API_KEY) {
      try {
        const aiPrompt = `You are a land surveying expert. Analyze this subdivision request and provide optimization suggestions.

Parcel Details:
- Total Area: ${parcelArea.toFixed(2)} sq meters
- Approximate Width: ${parcelWidth.toFixed(2)} meters
- Approximate Depth: ${parcelDepth.toFixed(2)} meters
- Coordinates: ${parcelCoordinates.length} vertices

Requested Subdivision:
- Plot Size: ${plot_width}m × ${plot_depth}m (${plot_width * plot_depth} sq meters per plot)
- Strategy: ${strategy}
- Target Plot Count: ${target_plot_count || 'Auto-fit'}
- Road Setback: ${road_setback_m}m
- Side Setback: ${side_setback_m}m
- Orientation: ${orientation_degrees}°
- Notes: ${notes || 'None'}

Provide a JSON response with:
1. "feasibility": boolean - can the requested subdivision work?
2. "max_plots": number - maximum plots that can fit
3. "efficiency_percent": number - land utilization percentage
4. "recommendations": array of strings - optimization tips
5. "alternative_layouts": array of {width, depth, count, description}

Keep response concise and actionable.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a professional land surveyor AI. Respond only with valid JSON.' },
              { role: 'user', content: aiPrompt }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            // Try to parse JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                aiAnalysis = JSON.parse(jsonMatch[0]);
                console.log('AI Analysis:', aiAnalysis);
              } catch (e) {
                console.log('Could not parse AI response as JSON');
              }
            }
          }
        } else {
          const errorText = await aiResponse.text();
          console.error('AI API error:', aiResponse.status, errorText);
        }
      } catch (aiError) {
        console.error('AI analysis failed:', aiError);
      }
    }

    // Perform geometric subdivision
    const { plots, beacons, suggestions } = subdivideRectangular(
      parcelCoordinates,
      plot_width,
      plot_depth,
      road_setback_m,
      side_setback_m,
      strategy,
      target_plot_count
    );

    // Add AI recommendations to suggestions
    if (aiAnalysis?.recommendations) {
      aiAnalysis.recommendations.forEach((rec: string) => {
        suggestions.push({
          type: 'alternative_layout',
          message: rec,
        });
      });
    }

    if (aiAnalysis?.alternative_layouts) {
      aiAnalysis.alternative_layouts.forEach((alt: any) => {
        suggestions.push({
          type: 'alternative_layout',
          message: alt.description || `Alternative: ${alt.width}m × ${alt.depth}m for ${alt.count} plots`,
          suggested_width: alt.width,
          suggested_depth: alt.depth,
          suggested_count: alt.count,
        });
      });
    }

    const response = {
      success: true,
      parcel: {
        area_sqm: parcelArea,
        width_m: parcelWidth,
        depth_m: parcelDepth,
        coordinates: parcelCoordinates,
      },
      subdivision: {
        strategy,
        plot_width,
        plot_depth,
        road_setback_m,
        side_setback_m,
        orientation_degrees,
        target_plot_count,
      },
      results: {
        total_plots: plots.length,
        plots,
        beacons,
        efficiency_percent: aiAnalysis?.efficiency_percent || ((plots.length * plot_width * plot_depth) / parcelArea * 100),
      },
      suggestions,
      ai_analysis: aiAnalysis,
    };

    console.log(`Generated ${plots.length} plots with ${beacons.length} beacons`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Subdivision error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
