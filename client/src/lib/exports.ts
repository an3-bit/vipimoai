import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Coordinate, Plot, Beacon } from '@/types/survey';
import { formatArea, calculateArea, calculatePerimeter, sqmToHectares } from '@/lib/geometry';
import { wgs84ToUTM, formatForArdhisasa } from '@/lib/coordinates';

interface ExportData {
  project: {
    name: string;
    clientName?: string;
    date: string;
    motherTitle?: string;
    surveyorLicense?: string;
  };
  parcel: {
    coordinates: Coordinate[];
    areaSqm: number;
    perimeterM: number;
  };
  plots: Plot[];
  beacons: Beacon[];
}

// Generate PDF mutation map and beacon list - ARDHISASA COMPLIANT
export async function generatePDF(data: ExportData): Promise<Blob> {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  
  // REPUBLIC OF KENYA HEADER - ARDHISASA STANDARD
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('REPUBLIC OF KENYA', pageWidth / 2, 15, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('THE LAND REGISTRATION ACT', pageWidth / 2, 22, { align: 'center' });
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('(Cap 300 Laws of Kenya)', pageWidth / 2, 28, { align: 'center' });
  
  // Form Reference
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('FORM RL 7A - APPLICATION FOR SUBDIVISION', pageWidth / 2, 38, { align: 'center' });
  
  // Title
  pdf.setFontSize(16);
  pdf.text('MUTATION MAP', pageWidth / 2, 48, { align: 'center' });
  
  // Horizontal line
  pdf.setLineWidth(0.5);
  pdf.line(20, 52, pageWidth - 20, 52);
  
  // Project info
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const motherTitle = data.project.motherTitle || `${data.project.name.toUpperCase().replace(/\s+/g, '/')}/0000`;
  const areaHa = sqmToHectares(data.parcel.areaSqm);
  
  pdf.text(`Mother Title: ${motherTitle}`, 20, 62);
  pdf.text(`Status: CLOSED (Pending Mutation)`, 120, 62);
  
  if (data.project.clientName) {
    pdf.text(`Registered Owner: ${data.project.clientName}`, 20, 69);
  }
  pdf.text(`Survey Date: ${data.project.date}`, 120, 69);
  
  pdf.text(`Original Area: ${areaHa.toFixed(4)} Ha`, 20, 76);
  pdf.text(`Licensed Surveyor: ${data.project.surveyorLicense || 'LS/2024/XXXX'}`, 120, 76);
  
  // Parcel Summary
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PARCEL SUMMARY', 20, 90);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Total Area: ${areaHa.toFixed(4)} Ha (${data.parcel.areaSqm.toFixed(2)} m²)`, 20, 98);
  pdf.text(`Perimeter: ${data.parcel.perimeterM.toFixed(2)} m`, 20, 105);
  pdf.text(`Boundary Vertices: ${data.parcel.coordinates.length}`, 120, 98);
  pdf.text(`Total Plots: ${data.plots.length}`, 120, 105);
  pdf.text(`Total Beacons: ${data.beacons.length}`, 120, 112);
  
  // Parcel Boundary Coordinates Table with Northing/Easting
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PARCEL BOUNDARY COORDINATES (Arc 1960 / UTM Zone 37N)', 20, 128);
  
  const parcelCoordData = data.parcel.coordinates.map((coord, idx) => {
    const utm = wgs84ToUTM(coord.lat, coord.lng);
    return [
      `BK${idx + 1}`,
      utm.northing.toFixed(3),
      utm.easting.toFixed(3),
      coord.lat.toFixed(8),
      coord.lng.toFixed(8),
    ];
  });
  
  autoTable(pdf, {
    startY: 133,
    head: [['Beacon ID', 'Northing (m)', 'Easting (m)', 'Latitude', 'Longitude']],
    body: parcelCoordData,
    theme: 'grid',
    headStyles: { fillColor: [0, 100, 80], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
  });
  
  // Plot Summary Table - AREAS IN HECTARES
  pdf.addPage();
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PROPOSED CHILD TITLES', 20, 20);
  
  const plotData = data.plots.map(plot => {
    const plotAreaHa = sqmToHectares(plot.area_sqm);
    return [
      `Plot ${plot.plot_number}`,
      `${motherTitle.replace('/0000', '')}/${String(plot.plot_number).padStart(4, '0')}`,
      `${plotAreaHa.toFixed(4)} Ha`,
      plot.width_m ? `${plot.width_m.toFixed(2)} m` : '-',
      plot.depth_m ? `${plot.depth_m.toFixed(2)} m` : '-',
      plot.is_partial ? 'Partial' : 'Full',
    ];
  });
  
  autoTable(pdf, {
    startY: 25,
    head: [['Plot #', 'New Title Number', 'Area (Ha)', 'Width', 'Depth', 'Type']],
    body: plotData,
    theme: 'grid',
    headStyles: { fillColor: [0, 100, 80], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
  });
  
  // Beacon Coordinate List with UTM
  pdf.addPage();
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BEACON COORDINATE LIST (Arc 1960 / UTM Zone 37N)', 20, 20);
  
  const beaconData = data.beacons.map(beacon => {
    const utm = wgs84ToUTM(beacon.latitude, beacon.longitude);
    return [
      `BK${beacon.beacon_number}`,
      utm.northing.toFixed(3),
      utm.easting.toFixed(3),
      beacon.latitude.toFixed(8),
      beacon.longitude.toFixed(8),
      beacon.description || '-',
    ];
  });
  
  autoTable(pdf, {
    startY: 25,
    head: [['Beacon ID', 'Northing (m)', 'Easting (m)', 'Latitude', 'Longitude', 'Description']],
    body: beaconData,
    theme: 'grid',
    headStyles: { fillColor: [0, 100, 80], fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 32 },
      4: { cellWidth: 32 },
      5: { cellWidth: 'auto' },
    },
  });
  
  // Individual Plot Details with UTM coordinates
  if (data.plots.length > 0 && data.plots.length <= 20) {
    pdf.addPage();
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INDIVIDUAL PLOT COORDINATES', 20, 20);
    
    let yPos = 30;
    
    data.plots.forEach((plot) => {
      if (yPos > 260) {
        pdf.addPage();
        yPos = 20;
      }
      
      const plotAreaHa = sqmToHectares(plot.area_sqm);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Plot ${plot.plot_number} (${plotAreaHa.toFixed(4)} Ha)`, 20, yPos);
      yPos += 5;
      
      const plotCoords = plot.coordinates.map((coord, idx) => {
        const utm = wgs84ToUTM(coord.lat, coord.lng);
        return [
          `Corner ${idx + 1}`,
          utm.northing.toFixed(3),
          utm.easting.toFixed(3),
          coord.lat.toFixed(8),
          coord.lng.toFixed(8),
        ];
      });
      
      autoTable(pdf, {
        startY: yPos,
        head: [['Corner', 'Northing', 'Easting', 'Latitude', 'Longitude']],
        body: plotCoords,
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50], fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 1 },
        margin: { left: 20 },
      });
      
      yPos = (pdf as any).lastAutoTable.finalY + 10;
    });
  }
  
  // Footer on all pages
  const pageCount = pdf.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      `Generated by VipimoAI for Ardhisasa Portal | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pdf.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  return pdf.output('blob');
}

// Generate GeoJSON export
export function generateGeoJSON(data: ExportData): string {
  const features: any[] = [];
  const areaHa = sqmToHectares(data.parcel.areaSqm);
  
  // Parent parcel polygon
  features.push({
    type: 'Feature',
    properties: {
      name: 'Parent Parcel',
      area_ha: areaHa,
      area_sqm: data.parcel.areaSqm,
      perimeter_m: data.parcel.perimeterM,
      type: 'parcel',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        ...data.parcel.coordinates.map(c => [c.lng, c.lat]),
        [data.parcel.coordinates[0].lng, data.parcel.coordinates[0].lat],
      ]],
    },
  });
  
  // Subdivision plots
  data.plots.forEach(plot => {
    const plotAreaHa = sqmToHectares(plot.area_sqm);
    features.push({
      type: 'Feature',
      properties: {
        name: `Plot ${plot.plot_number}`,
        plot_number: plot.plot_number,
        area_ha: plotAreaHa,
        area_sqm: plot.area_sqm,
        width_m: plot.width_m,
        depth_m: plot.depth_m,
        is_partial: plot.is_partial,
        type: 'plot',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          ...plot.coordinates.map(c => [c.lng, c.lat]),
          [plot.coordinates[0].lng, plot.coordinates[0].lat],
        ]],
      },
    });
  });
  
  // Beacons as points with UTM coordinates
  data.beacons.forEach(beacon => {
    const utm = wgs84ToUTM(beacon.latitude, beacon.longitude);
    features.push({
      type: 'Feature',
      properties: {
        name: `BK${beacon.beacon_number}`,
        beacon_number: beacon.beacon_number,
        beacon_id: `BK${beacon.beacon_number}`,
        northing: utm.northing,
        easting: utm.easting,
        description: beacon.description,
        type: 'beacon',
      },
      geometry: {
        type: 'Point',
        coordinates: [beacon.longitude, beacon.latitude],
      },
    });
  });
  
  const geojson = {
    type: 'FeatureCollection',
    name: data.project.name,
    crs: {
      type: 'name',
      properties: {
        name: 'urn:ogc:def:crs:OGC:1.3:CRS84',
      },
    },
    features,
  };
  
  return JSON.stringify(geojson, null, 2);
}

// Generate KML export
export function generateKML(data: ExportData): string {
  const coordsToKML = (coords: Coordinate[]): string => {
    return coords.map(c => `${c.lng},${c.lat},0`).join(' ');
  };
  
  const areaHa = sqmToHectares(data.parcel.areaSqm);
  let placemarks = '';
  
  // Parent parcel
  const parcelCoords = coordsToKML([...data.parcel.coordinates, data.parcel.coordinates[0]]);
  placemarks += `
    <Placemark>
      <name>Parent Parcel</name>
      <description>
        Area: ${areaHa.toFixed(4)} Ha
        Perimeter: ${data.parcel.perimeterM.toFixed(2)} m
      </description>
      <Style>
        <LineStyle>
          <color>ff0000ff</color>
          <width>3</width>
        </LineStyle>
        <PolyStyle>
          <color>400000ff</color>
        </PolyStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${parcelCoords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
  
  // Plots folder
  placemarks += `
    <Folder>
      <name>Plots</name>`;
  
  data.plots.forEach(plot => {
    const plotCoords = coordsToKML([...plot.coordinates, plot.coordinates[0]]);
    const plotAreaHa = sqmToHectares(plot.area_sqm);
    placemarks += `
      <Placemark>
        <name>Plot ${plot.plot_number}</name>
        <description>
          Area: ${plotAreaHa.toFixed(4)} Ha
          Width: ${plot.width_m?.toFixed(2) || '-'} m
          Depth: ${plot.depth_m?.toFixed(2) || '-'} m
        </description>
        <Style>
          <LineStyle>
            <color>ff00ff00</color>
            <width>2</width>
          </LineStyle>
          <PolyStyle>
            <color>4000ff00</color>
          </PolyStyle>
        </Style>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${plotCoords}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>`;
  });
  
  placemarks += `
    </Folder>`;
  
  // Beacons folder
  placemarks += `
    <Folder>
      <name>Beacons</name>`;
  
  data.beacons.forEach(beacon => {
    const utm = wgs84ToUTM(beacon.latitude, beacon.longitude);
    placemarks += `
      <Placemark>
        <name>BK${beacon.beacon_number}</name>
        <description>
          Northing: ${utm.northing.toFixed(3)} m
          Easting: ${utm.easting.toFixed(3)} m
          ${beacon.description || ''}
        </description>
        <Style>
          <IconStyle>
            <color>ff00d4aa</color>
            <scale>0.8</scale>
            <Icon>
              <href>http://maps.google.com/mapfiles/kml/paddle/wht-circle.png</href>
            </Icon>
          </IconStyle>
        </Style>
        <Point>
          <coordinates>${beacon.longitude},${beacon.latitude},0</coordinates>
        </Point>
      </Placemark>`;
  });
  
  placemarks += `
    </Folder>`;
  
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${data.project.name}</name>
    <description>Subdivision export - ${data.project.clientName || 'No client'}</description>
    ${placemarks}
  </Document>
</kml>`;
  
  return kml;
}

// Generate CSV beacon list - ARDHISASA FORMAT with Northing/Easting
export function generateBeaconCSV(data: ExportData): string {
  let csv = 'Beacon_ID,Northing,Easting,Latitude,Longitude,Description\n';
  
  data.beacons.forEach(beacon => {
    const utm = wgs84ToUTM(beacon.latitude, beacon.longitude);
    csv += `BK${beacon.beacon_number},${utm.northing.toFixed(3)},${utm.easting.toFixed(3)},${beacon.latitude.toFixed(8)},${beacon.longitude.toFixed(8)},"${beacon.description || ''}"\n`;
  });
  
  return csv;
}

// Generate Ardhisasa-compliant JSON export
export function generateArdhisasaJSON(data: ExportData): string {
  const motherTitle = data.project.motherTitle || `${data.project.name.toUpperCase().replace(/\s+/g, '/')}/0000`;
  const areaHa = sqmToHectares(data.parcel.areaSqm);
  
  const ardhisasaData = {
    metadata: {
      format: 'Ardhisasa Portal v2.0',
      exportDate: new Date().toISOString(),
      generatedBy: 'VipimoAI',
      crs: 'Arc 1960 / UTM Zone 37N',
    },
    motherTitle: {
      titleNumber: motherTitle,
      status: 'CLOSED',
      registeredOwner: data.project.clientName || 'N/A',
      area_ha: areaHa,
      area_sqm: data.parcel.areaSqm,
      perimeter_m: data.parcel.perimeterM,
      surveyDate: data.project.date,
      surveyorLicense: data.project.surveyorLicense || 'LS/2024/XXXX',
    },
    boundaryBeacons: data.parcel.coordinates.map((coord, idx) => {
      const utm = wgs84ToUTM(coord.lat, coord.lng);
      return {
        Beacon_ID: `BK${idx + 1}`,
        Northing: parseFloat(utm.northing.toFixed(3)),
        Easting: parseFloat(utm.easting.toFixed(3)),
        Latitude: coord.lat,
        Longitude: coord.lng,
      };
    }),
    childTitles: data.plots.map(plot => {
      const plotAreaHa = sqmToHectares(plot.area_sqm);
      return {
        plotNumber: plot.plot_number,
        newTitleNumber: `${motherTitle.replace('/0000', '')}/${String(plot.plot_number).padStart(4, '0')}`,
        Area_Ha: parseFloat(plotAreaHa.toFixed(4)),
        Area_Sqm: plot.area_sqm,
        width_m: plot.width_m,
        depth_m: plot.depth_m,
        type: plot.is_partial ? 'Partial' : 'Full',
        corners: plot.coordinates.map((coord, idx) => {
          const utm = wgs84ToUTM(coord.lat, coord.lng);
          return {
            corner: idx + 1,
            Beacon_ID: `BK${plot.plot_number}-${idx + 1}`,
            Northing: parseFloat(utm.northing.toFixed(3)),
            Easting: parseFloat(utm.easting.toFixed(3)),
            Latitude: coord.lat,
            Longitude: coord.lng,
          };
        }),
      };
    }),
    allBeacons: data.beacons.map(beacon => {
      const utm = wgs84ToUTM(beacon.latitude, beacon.longitude);
      return {
        Beacon_ID: `BK${beacon.beacon_number}`,
        Northing: parseFloat(utm.northing.toFixed(3)),
        Easting: parseFloat(utm.easting.toFixed(3)),
        Latitude: beacon.latitude,
        Longitude: beacon.longitude,
        description: beacon.description || '',
      };
    }),
    summary: {
      totalPlots: data.plots.length,
      totalBeacons: data.beacons.length,
      totalArea_Ha: areaHa,
      averagePlotSize_Ha: data.plots.length > 0 
        ? parseFloat((areaHa / data.plots.length).toFixed(4)) 
        : 0,
    },
  };
  
  return JSON.stringify(ardhisasaData, null, 2);
}

// Download helper
export function downloadFile(content: Blob | string, filename: string, mimeType?: string) {
  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type: mimeType || 'text/plain' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
