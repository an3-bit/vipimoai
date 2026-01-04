# Frontage Edge Selector - Marking Road-Facing Boundaries

## Overview
The **Frontage Edge Selector** allows surveyors to manually identify which part of the parcel boundary has road access. This helps the subdivision engine create optimal plot layouts with guaranteed road access.

---

## When to Use

Use the Frontage Edge Selector when:

✅ The parcel boundary is unclear on the map
✅ The subdivision engine needs guidance on which edge faces the road
✅ Multiple edges might have road access (you want to specify the primary one)
✅ You want to ensure optimal plot orientation and road access

---

## Step-by-Step Guide

### 1. Upload Parcel Coordinates
First, upload your parcel boundary coordinates using the **Upload** button (top left in toolbar).

### 2. Click the Frontage Edge Selector Button
In the toolbar, click the **📍 MapPin icon** to activate the frontage edge selector mode.

The button will:
- Turn **blue** when active
- Show tooltip: "Mark Road-Facing Edge"
- Be disabled if no parcel coordinates are loaded

### 3. Select Road-Facing Coordinates
On the map, **click 2 or more coordinates** along the parcel boundary that face the road.

**What happens:**
- **First click:** 🔴 Red marker (start point)
- **Subsequent clicks:** 🔵 Blue markers (selected vertices)
- **Last click:** 🟢 Green marker (end point)
- **Blue dashed line:** Shows the selected edge

### 4. Review Edge Information
A **blue information panel** appears at the bottom of the map showing:

```
Selected: X vertices
Length: XXXX m
```

### 5. Confirm Selection
Click the **Confirm** button in the info panel.

A confirmation dialog appears showing:
- **Start Vertex** - First coordinate number
- **End Vertex** - Last coordinate number
- **Edge Length** - Total length in meters
- **Vertices** - Number of selected points

### 6. Click "Confirm & Continue"
The system will:
- ✓ Save your road frontage selection
- ✓ Disable the selector
- ✓ Show a success message with edge details
- ✓ Log the selection to activity history

---

## Example Workflow

```
Parcel Layout:
┌─────────────────────────────┐
│  4 ─────────────────── 3   │
│  │                        │
│  │    PARCEL INTERIOR    │  ← No access (neighbor land)
│  │                        │
│  1 ═════════════════════ 2   │ ← ROAD (click vertices 1-2)
└─────────────────────────────┘

Steps:
1. Upload parcel (4 vertices)
2. Click MapPin icon to enable selector
3. Click vertex 1 (🔴 red)
4. Click vertex 2 (🟢 green) 
5. Blue dashed line appears showing road edge
6. Click Confirm
7. Confirm dialog shows "Start: 1, End: 2, Length: 150m"
8. Click "Confirm & Continue"
```

---

## Visual Indicators

| Element | Meaning |
|---------|---------|
| 🔴 Red Marker | First selected coordinate (start) |
| 🔵 Blue Marker | Middle selected coordinates |
| 🟢 Green Marker | Last selected coordinate (end) |
| 🔵 Blue Line | Selected edge between coordinates |
| 🔵 Blue Panel | Information and action buttons |

---

## What the Engine Does With This Info

Once you've marked the frontage edge:

1. **Aligns the subdivision grid** perpendicular to your selected edge
2. **Creates plots with direct frontage** to the road
3. **Generates spine roads** perpendicular from your edge
4. **Creates rib roads** connecting to the spine road
5. **Ensures no landlocked plots** by using your road edge as access

**Result:** Optimal plot orientation with guaranteed road access

---

## Tips & Best Practices

### ✓ Do This
- Select the **longest continuous edge** facing the road
- Include **corner vertices** if they face the road
- Select at least **2 coordinates** (minimum requirement)
- Use the **longest road-facing edge** for best results
- Zoom in on the boundary before selecting for accuracy

### ✗ Avoid This
- Don't select edges facing **neighbor land** (non-road side)
- Don't select **random, non-contiguous vertices**
- Don't forget to **confirm your selection** (click Confirm)
- Don't select edges that **don't face any road**

---

## Integration With Auto-Subdivide

After marking the frontage edge:

1. Set your desired **plot dimensions** in the sidebar
   - Plot Width: 15m (default)
   - Plot Depth: 30m (default)
   - Road Width: 9m (default)

2. Click the **Auto Subdivide** button (🗂️ grid icon)

3. The engine will:
   - Use your marked edge as primary frontage
   - Generate plots perpendicular to your edge
   - Create optimal road layout
   - Show results on the map

4. View **plot details** by clicking any plot on the map

---

## What If I Make a Mistake?

### To Deselect a Coordinate
- **Click the coordinate again** - it will turn gray and be removed

### To Start Over
- Click the **Cancel** button in the info panel
- All selections will be cleared
- The selector will remain active for a new selection

### To Exit Without Selecting
- Click the **MapPin icon again** to deactivate the selector
- Your selection will be discarded

---

## Troubleshooting

### Problem: Button is Disabled
**Cause:** No parcel coordinates loaded
**Solution:** Upload parcel coordinates first using the Upload button

### Problem: Can't Click Coordinates
**Cause:** Selector not activated
**Solution:** Click the MapPin icon in the toolbar to turn it blue

### Problem: Confirm Button is Grayed Out
**Cause:** Need at least 2 coordinates selected
**Solution:** Click at least 2 coordinates before confirming

### Problem: Selection Doesn't Show on Map
**Cause:** Vertices selected but selector still waiting for confirmation
**Solution:** Click the Confirm button in the blue info panel

---

## Activity Log

Every frontage edge selection is logged with:
- 📍 Start vertex number
- 📍 End vertex number  
- 📏 Number of vertices selected
- 📐 Edge length in meters
- ⏰ Timestamp

View in the **Activity Timeline** (in the Workspace Modals).

---

## Coordinate System

The system uses:
- **Latitude/Longitude (WGS84)** for storage and display
- **6 decimal places** precision in popups
- **Meters** for distance calculations (Haversine formula)

When you select an edge, distances are calculated using the **great circle distance** formula for accuracy.

---

## Advanced Features

### Boundary Visualization
- Parcel boundary shown with **4px weight, 15% opacity**
- Selected edge highlighted with **blue dashed line**
- All selected vertices marked with color-coded markers

### Edge Information
The system automatically calculates:
- **Edge length** - Distance between first and last selected vertex
- **Vertex count** - Number of selected coordinates
- **Coordinates** - Full lat/lng for each vertex
- **Bearing** - Direction perpendicular to the road (used for alignment)

---

## Next Steps

1. ✅ Upload parcel coordinates
2. ✅ Mark road-facing edge with frontage selector
3. ⏭️ Set plot dimensions in sidebar
4. ⏭️ Click Auto Subdivide
5. ⏭️ View generated plots on map
6. ⏭️ Save subdivision
7. ⏭️ Generate Mutation Form (LRA 27)

---

## FAQ

**Q: Do I have to use the frontage selector?**
A: No, it's optional. The engine can detect road access automatically. Use it when you want to guide the subdivision for better results.

**Q: Can I select multiple non-contiguous edges?**
A: No, the selector requires a continuous sequence of coordinates. If the parcel has multiple road-facing edges, select the longest/primary one.

**Q: What if my parcel has multiple road frontages?**
A: Select the edge that will be your **primary access road**. The system will use this for the main spine road orientation.

**Q: Does selecting an edge guarantee those plots get frontage access?**
A: Yes, plots touching your selected edge will have direct frontage. All other plots will access via spine/rib roads.

**Q: Can I change my selection after confirming?**
A: Yes, activate the selector again and make a new selection. The new one will replace the previous selection.

---

## Technical Details

- Selections are stored in workspace state as: `{ startIndex, endIndex }`
- Distance calculated using **Haversine formula** (6371km Earth radius)
- Coordinates converted from **GeoJSON [lng, lat]** to **{lat, lng}** format
- Activity logged with full edge details for audit trail
