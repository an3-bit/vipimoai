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

// Generate Form LRA 27 Mutation Form PDF - ARDHISASA SYSTEM EXPORT
export async function generateFormLRA27(data: ExportData): Promise<Blob> {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth(); // 210
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297

  // PAGE 1: FORM LRA 27
  // Header
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text('REPUBLIC OF KENYA', pageWidth / 2, 12, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('THE LAND REGISTRATION ACT', pageWidth / 2, 18, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('(Section 23)', pageWidth / 2, 23, { align: 'center' });
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('MUTATION FORM (FORM LRA 27)', pageWidth / 2, 32, { align: 'center' });
  
  // Outer Border Box for page 1
  pdf.setLineWidth(0.3);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(10, 38, pageWidth - 20, pageHeight - 50);

  // Divider lines and Sections
  pdf.line(10, 80, pageWidth - 10, 80);
  pdf.line(10, 115, pageWidth - 10, 115);
  pdf.line(10, 160, pageWidth - 10, 160);
  pdf.line(10, 215, pageWidth - 10, 215);

  // Section A: Particulars of Land
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('SECTION A: PARTICULARS OF LAND', 14, 44);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`1. Registry Index Map Sheet: Juja / Kiambu Block 1`, 14, 52);
  pdf.text(`2. Mother Parcel Title Number: ${data.project.name.toUpperCase().replace(/\s+/g, '/')}/0000`, 14, 58);
  pdf.text(`3. Original Area: ${(data.parcel.areaSqm / 10000).toFixed(4)} Ha`, 14, 64);
  pdf.text(`4. Registered Owner: ${data.project.clientName || 'N/A'}`, 14, 70);
  pdf.text(`5. Location: Nairobi / Central Kenya`, 14, 76);

  // Section B: Application for Subdivision
  pdf.setFont('helvetica', 'bold');
  pdf.text('SECTION B: APPLICATION FOR SUBDIVISION', 14, 86);
  pdf.setFont('helvetica', 'normal');
  pdf.text('I/We, being the registered owner(s) of the parcel of land described above, hereby apply', 14, 93);
  pdf.text('to subdivide the parcel as shown in the mutation survey diagram attached hereto.', 14, 98);
  pdf.text('Signature of Owner: ________________________         Date: ________________________', 14, 107);

  // Section C: Surveyor\'s Certificate
  pdf.setFont('helvetica', 'bold');
  pdf.text('SECTION C: SURVEYOR\'S CERTIFICATE', 14, 121);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`I certify that I have surveyed the subdivision shown on the mutation diagram and that the`, 14, 128);
  pdf.text(`beacons are in accordance with the Survey Act. The resulting child titles are described below.`, 14, 133);
  pdf.text(`Licensed Surveyor: ${data.project.surveyorLicense || 'LS/2024/XXXX'}`, 14, 142);
  pdf.text(`Signature & Seal: __________________________         Date: ${data.project.date}`, 14, 149);

  // Section D: Subdivision Particulars (Child Titles Table)
  pdf.setFont('helvetica', 'bold');
  pdf.text('SECTION D: PROPOSED SUBDIVISION PARTICULARS', 14, 166);
  
  const motherTitle = data.project.name.toUpperCase().replace(/\s+/g, '/');
  const tableRows = data.plots.map(plot => {
    const areaHa = plot.area_sqm / 10000;
    return [
      `Plot ${plot.plot_number}`,
      `${motherTitle}/${String(plot.plot_number).padStart(4, '0')}`,
      `${areaHa.toFixed(4)} Ha`,
      `${plot.area_sqm.toFixed(1)} m²`,
      plot.is_partial ? 'Partial' : 'Full'
    ];
  });

  autoTable(pdf, {
    startY: 172,
    head: [['Plot No.', 'Proposed Title No.', 'Area (Ha)', 'Area (sqm)', 'Status']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [0, 80, 60], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14, right: 14 }
  });

  // Section E: Land Registrar\'s Registration
  pdf.setFont('helvetica', 'bold');
  pdf.text('SECTION E: FOR OFFICIAL USE BY LAND REGISTRAR', 14, 221);
  pdf.setFont('helvetica', 'normal');
  pdf.text('This subdivision is approved and child titles registered accordingly.', 14, 228);
  pdf.text('Land Registrar: ___________________________         Date: ________________________', 14, 237);
  pdf.text('Seal / Stamp:', 14, 246);

  // PAGE 2: MUTATION SURVEY DIAGRAM
  pdf.addPage();
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('MUTATION SURVEY DIAGRAM', pageWidth / 2, 15, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Mother Title: ${motherTitle}/0000`, 20, 22);
  pdf.text(`Surveyor: ${data.project.surveyorLicense || 'LS/2024/XXXX'}`, 120, 22);

  // Border Box for Diagram Page
  pdf.setLineWidth(0.4);
  pdf.rect(10, 28, pageWidth - 20, pageHeight - 45);

  const parentCoords = data.parcel.coordinates;
  const lats = parentCoords.map(c => c.lat);
  const lngs = parentCoords.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Map to left-side drawing viewport:
  // viewport: x in [15, 135] (width 120), y in [35, 245] (height 210)
  const vMinX = 15;
  const vMaxX = 135;
  const vMinY = 35;
  const vMaxY = 245;

  const getPageCoords = (lat: number, lng: number) => {
    // Keep aspect ratio
    const latDist = (maxLat - minLat) * 111320;
    const lngDist = (maxLng - minLng) * 111320 * Math.cos(((maxLat + minLat) / 2) * Math.PI / 180);
    const aspect = lngDist / (latDist || 1);

    const vWidth = vMaxX - vMinX;
    const vHeight = vMaxY - vMinY;

    let w = vWidth;
    let h = vWidth / aspect;
    if (h > vHeight) {
      h = vHeight;
      w = vHeight * aspect;
    }

    const startX = vMinX + (vWidth - w) / 2;
    const startY = vMinY + (vHeight - h) / 2;

    const xPct = (lng - minLng) / (maxLng - minLng || 1);
    const yPct = (maxLat - lat) / (maxLat - minLat || 1);

    return {
      x: startX + xPct * w,
      y: startY + yPct * h
    };
  };

  // Draw parent boundary (thick lines)
  pdf.setLineWidth(0.6);
  pdf.setDrawColor(0, 0, 0);
  for (let i = 0; i < parentCoords.length; i++) {
    const p1 = parentCoords[i];
    const p2 = parentCoords[(i + 1) % parentCoords.length];
    const pt1 = getPageCoords(p1.lat, p1.lng);
    const pt2 = getPageCoords(p2.lat, p2.lng);
    pdf.line(pt1.x, pt1.y, pt2.x, pt2.y);
  }

  // Draw child plot boundaries (medium lines)
  pdf.setLineWidth(0.3);
  pdf.setDrawColor(50, 50, 50);
  data.plots.forEach(plot => {
    const coords = plot.coordinates;
    for (let i = 0; i < coords.length; i++) {
      const p1 = coords[i];
      const p2 = coords[(i + 1) % coords.length];
      const pt1 = getPageCoords(p1.lat, p1.lng);
      const pt2 = getPageCoords(p2.lat, p2.lng);
      pdf.line(pt1.x, pt1.y, pt2.x, pt2.y);
    }
  });

  // Calculate and draw segment distances along the boundaries
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(100, 0, 0); // dark red for distances

  const drawnEdges: string[] = [];
  
  const getEdgeKey = (p1: Coordinate, p2: Coordinate) => {
    const id1 = `${p1.lat.toFixed(6)},${p1.lng.toFixed(6)}`;
    const id2 = `${p2.lat.toFixed(6)},${p2.lng.toFixed(6)}`;
    return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
  };

  const drawSegmentLength = (p1: Coordinate, p2: Coordinate) => {
    const key = getEdgeKey(p1, p2);
    if (drawnEdges.includes(key)) return;
    drawnEdges.push(key);

    const utm1 = wgs84ToUTM(p1.lat, p1.lng);
    const utm2 = wgs84ToUTM(p2.lat, p2.lng);
    const d = Math.sqrt(Math.pow(utm2.easting - utm1.easting, 2) + Math.pow(utm2.northing - utm1.northing, 2));
    if (d < 5.0) return;

    const pt1 = getPageCoords(p1.lat, p1.lng);
    const pt2 = getPageCoords(p2.lat, p2.lng);

    const mx = (pt1.x + pt2.x) / 2;
    const my = (pt1.y + pt2.y) / 2;

    const dx = pt2.x - pt1.x;
    const dy = pt2.y - pt1.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 1e-3) return;
    const ux = dx/len;
    const uy = dy/len;
    const nx = -uy;
    const ny = ux;

    const lx = mx + 2.5 * nx;
    const ly = my + 2.5 * ny;

    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;

    pdf.text(`${d.toFixed(2)}m`, lx, ly, { angle: angle, align: 'center' });
  };

  data.plots.forEach(plot => {
    const coords = plot.coordinates;
    for (let i = 0; i < coords.length; i++) {
      drawSegmentLength(coords[i], coords[(i + 1) % coords.length]);
    }
  });

  // Label beacons (P1, P2... P12)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(0, 0, 0);

  const uniqueBeacons: { lat: number; lng: number; num: number }[] = [];
  
  data.beacons.forEach(b => {
    const exists = uniqueBeacons.some(u => Math.abs(u.lat - b.latitude) < 1e-7 && Math.abs(u.lng - b.longitude) < 1e-7);
    if (!exists) {
      uniqueBeacons.push({ lat: b.latitude, lng: b.longitude, num: b.beacon_number });
    }
  });

  uniqueBeacons.forEach(b => {
    const pt = getPageCoords(b.lat, b.lng);
    pdf.setLineWidth(0.1);
    pdf.circle(pt.x, pt.y, 0.6, 'S');
    pdf.text(`P${b.num}`, pt.x + 1.2, pt.y - 1.2);
  });

  // Draw plot names and areas in Hectares in center of each plot
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 80, 60);

  data.plots.forEach(plot => {
    const pLats = plot.coordinates.map(c => c.lat);
    const pLngs = plot.coordinates.map(c => c.lng);
    const avgLat = pLats.reduce((a, b) => a + b, 0) / pLats.length;
    const avgLng = pLngs.reduce((a, b) => a + b, 0) / pLngs.length;
    
    const pt = getPageCoords(avgLat, avgLng);
    const areaHa = plot.area_sqm / 10000;
    
    pdf.text(`Plot ${plot.plot_number}`, pt.x, pt.y - 1, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(`${areaHa.toFixed(4)} Ha`, pt.x, pt.y + 2.5, { align: 'center' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
  });

  // Draw North Arrow and Scale annotation
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);

  const nx_base = 25;
  const ny_base = 230;
  pdf.line(nx_base, ny_base, nx_base, ny_base - 12);
  pdf.line(nx_base, ny_base - 12, nx_base - 3, ny_base - 8);
  pdf.line(nx_base, ny_base - 12, nx_base + 3, ny_base - 8);
  pdf.text('N', nx_base, ny_base - 14, { align: 'center' });

  pdf.text('SCALE 1: 5000', 45, ny_base - 8);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.text('ALL DISTANCES ARE IN METERS', 45, ny_base - 4);

  // Draw Coordinate Table on the right
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('COORDINATES IN UTM (ARC 1960)', 142, 35);

  const tableHeaders = [['PT', 'NORTHING (m)', 'EASTING (m)']];
  const tableData = uniqueBeacons.map(b => {
    const utm = wgs84ToUTM(b.lat, b.lng);
    return [
      `P${b.num}`,
      utm.northing.toFixed(3),
      utm.easting.toFixed(3)
    ];
  });

  autoTable(pdf, {
    startY: 38,
    head: tableHeaders,
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [50, 50, 50], fontSize: 7, cellPadding: 1 },
    styles: { fontSize: 6.5, cellPadding: 1 },
    margin: { left: 142, right: 10 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 23 },
      2: { cellWidth: 23 }
    }
  });

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Generated by VipimoAI for Ardhisasa Portal | Form LRA 27 Page 2 of 2', pageWidth / 2, pageHeight - 8, { align: 'center' });

  return pdf.output('blob');
}
