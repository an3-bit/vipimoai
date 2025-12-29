/**
 * SmartSubdivisionOverlay - Visual Feedback Component
 * Displays frontage (green), spine (blue), and road network on the map
 */

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, LineString, FeatureCollection, Polygon } from 'geojson';
import type { SubdivisionOutput } from '@/lib/subdivision';

interface SmartSubdivisionOverlayProps {
  subdivisionResult: SubdivisionOutput | null;
  showFrontage?: boolean;
  showSpine?: boolean;
  showRoads?: boolean;
  showPlots?: boolean;
}

export function SmartSubdivisionOverlay({
  subdivisionResult,
  showFrontage = true,
  showSpine = true,
  showRoads = true,
  showPlots = true
}: SmartSubdivisionOverlayProps) {
  const map = useMap();

  useEffect(() => {
    if (!subdivisionResult) return;

    const layers: L.Layer[] = [];

    // Draw frontage line (thick green)
    if (showFrontage && subdivisionResult.visualization.frontage) {
      const frontageCoords = subdivisionResult.visualization.frontage.geometry.coordinates.map(
        coord => [coord[1], coord[0]] as L.LatLngTuple
      );
      
      const frontageLayer = L.polyline(frontageCoords, {
        color: '#22C55E',
        weight: 8,
        opacity: 0.9,
        lineCap: 'round',
        dashArray: undefined
      });

      // Add label
      const midpoint = frontageCoords[Math.floor(frontageCoords.length / 2)];
      const props = subdivisionResult.visualization.frontage.properties || {};
      
      const label = L.marker(midpoint, {
        icon: L.divIcon({
          className: 'frontage-label',
          html: `
            <div style="
              background: #22C55E;
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
              ${props.label || 'Existing Road Detected'}
            </div>
          `,
          iconSize: [200, 30],
          iconAnchor: [100, 15]
        })
      });

      frontageLayer.addTo(map);
      label.addTo(map);
      layers.push(frontageLayer, label);
    }

    // Draw spine road (thick blue centerline)
    if (showSpine && subdivisionResult.visualization.spine) {
      const spineCoords = subdivisionResult.visualization.spine.geometry.coordinates.map(
        coord => [coord[1], coord[0]] as L.LatLngTuple
      );
      
      // Background (wider, lighter)
      const spineBackground = L.polyline(spineCoords, {
        color: '#93C5FD',
        weight: 14,
        opacity: 0.6,
        lineCap: 'round'
      });

      // Centerline (narrow, darker)
      const spineCenterline = L.polyline(spineCoords, {
        color: '#3B82F6',
        weight: 4,
        opacity: 1,
        lineCap: 'round',
        dashArray: '10, 5'
      });

      // Add label
      const spineLabel = L.marker(spineCoords[Math.floor(spineCoords.length / 2)], {
        icon: L.divIcon({
          className: 'spine-label',
          html: `
            <div style="
              background: #3B82F6;
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
              Main Spine Road (12m)
            </div>
          `,
          iconSize: [150, 24],
          iconAnchor: [75, 12]
        })
      });

      spineBackground.addTo(map);
      spineCenterline.addTo(map);
      spineLabel.addTo(map);
      layers.push(spineBackground, spineCenterline, spineLabel);
    }

    // Draw rib roads (gray)
    if (showRoads && subdivisionResult.visualization.roads) {
      subdivisionResult.visualization.roads.features.forEach(road => {
        if (road.properties?.type === 'rib') {
          const coords = road.geometry.coordinates.map(
            coord => [coord[1], coord[0]] as L.LatLngTuple
          );
          
          const ribRoad = L.polyline(coords, {
            color: '#6B7280',
            weight: 6,
            opacity: 0.7,
            lineCap: 'round'
          });

          ribRoad.addTo(map);
          layers.push(ribRoad);
        }
      });
    }

    // Draw plots
    if (showPlots && subdivisionResult.visualization.plots) {
      subdivisionResult.visualization.plots.features.forEach(plot => {
        const coords = plot.geometry.coordinates[0].map(
          coord => [coord[1], coord[0]] as L.LatLngTuple
        );
        
        const props = plot.properties || {};
        const fillColor = props.fillColor || '#3B82F6';
        
        const plotPolygon = L.polygon(coords, {
          color: fillColor,
          weight: 2,
          opacity: 0.9,
          fillColor: fillColor,
          fillOpacity: 0.3
        });

        // Add plot number label
        const centroid = plotPolygon.getBounds().getCenter();
        const plotLabel = L.marker(centroid, {
          icon: L.divIcon({
            className: 'plot-label',
            html: `
              <div style="
                background: ${fillColor};
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 700;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              ">
                ${props.plotNumber || ''}
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        });

        plotPolygon.bindTooltip(`
          <strong>Plot ${props.plotNumber}</strong><br/>
          Area: ${(props.area / 10000).toFixed(4)} Ha<br/>
          ${props.width}m × ${props.depth}m<br/>
          Facing: ${props.facingRoad}
          ${props.isPartial ? '<br/><em>Partial plot</em>' : ''}
          ${props.isTruncated ? '<br/><em>Truncated at intersection</em>' : ''}
        `);

        plotPolygon.addTo(map);
        plotLabel.addTo(map);
        layers.push(plotPolygon, plotLabel);
      });
    }

    // Cleanup on unmount
    return () => {
      layers.forEach(layer => {
        map.removeLayer(layer);
      });
    };
  }, [map, subdivisionResult, showFrontage, showSpine, showRoads, showPlots]);

  return null;
}

export default SmartSubdivisionOverlay;
