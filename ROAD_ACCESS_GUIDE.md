# Road Access System Guide
## VipimoAI Subdivision Engine for Kenya

> 📋 **Legal Framework:** Land Registration Act (2012), The Survey Act (Cap 299), Physical and Land Use Planning Act (2019)

---

## ⚖️ The Legal Requirement

**Every single plot must have direct access to a public road.** This is the "Zero Landlocked" mandate from Kenya's Land Registration Act (2012).

If even ONE plot in your subdivision doesn't touch a road:
- ❌ Director of Surveys **REJECTS THE ENTIRE SCHEME**
- ❌ No plots can be registered
- ❌ Surveyor is liable for costs and delays

**VipimoAI enforces this automatically.** Any plot without road access is excluded from the final output.

---

## Three Types of Road Access

When VipimoAI subdivides your parcel, each plot gets one of three types of road access:

### 🟢 **Frontage Access** (Direct Boundary)
- Plot directly faces the external/public road
- Plot boundary IS the road edge
- Most valuable plots (high visibility)
- Automatically labeled with green badge

**Visual:** Plot touching the parcel's edge that faces the external road

### 🔵 **Spine Access** (Secondary Road)
- Plot faces an internal spine road (the main circulation road)
- Spine road connects to external road
- Good access and circulation
- Automatically labeled with blue badge

**Visual:** Plots arranged along the internal spine road

### ⚪ **Internal Access** (Rib Roads)
- Plot faces internal rib roads (connecting to spine)
- Rib roads ultimately connect to spine → external road
- Valid but less accessible
- Automatically labeled with gray badge

**Visual:** Plots on smaller cross-streets connecting to spine

---

## How the Engine Ensures Zero Landlocked

### The Algorithm
```
For each plot generated:
1. Check if plot.facingRoad = 'frontage' | 'spine' | 'internal'
2. Check if coordinates.length >= 3
3. If BOTH true: isValid = true (plot is VALID)
4. If EITHER false: isValid = false (plot EXCLUDED)
5. Only VALID plots render on map and are saved
```

### The Result
✅ **ZERO plots without road access**
✅ Every plot can be registered with Title Deed
✅ No Director of Surveys rejection
✅ System ready for mutation form generation

---

## Road Dimensions (Kenyan Legal Minimums)

### 9m Access Roads (LEGAL MINIMUM)
- **Purpose:** Standard residential subdivisions (double-loaded)
- **Width:** 9 meters minimum (cannot go below)
- **Why:** Allows two cars to pass + space for water/power/sewage utilities
- **System Default:** 9m for all rib roads

### 12m Spine Road (Feeder Standard)
- **Purpose:** Main circulation within subdivision
- **Width:** 12 meters minimum
- **Why:** Accommodates heavier traffic, emergency vehicles, utilities
- **System Default:** 12m for spine road

### 15m+ Distributor Road (Commercial/Industrial)
- **Purpose:** Major developments connecting to highways
- **Width:** 15 meters or more
- **When Used:** Large commercial or industrial schemes

### Corner Splays (Safety)
- **Purpose:** Prevent blind spots at road intersections
- **Standard:** 2.5m to 5m truncation (chamfer)
- **System Default:** 3m at all road corners
- **Why:** Safety - surveyor liable for unsafe intersections

---

## Road Surrender (10-15% Rule)

When you subdivide your parcel, a portion becomes PUBLIC ROAD (surrendered to County).

### Calculation Example
```
Total Parcel: 1.00 Ha (10,000 m²)
Road Layout:
  - Spine road: 12m × 500m = 6,000 m²
  - Rib roads:  9m × 560m  = 5,040 m²
Total Road Area: 11,040 m²

Road Surrender: 1.104 Ha (11.04%)
Net Developable: 8.896 Ha (88.96%)
Efficiency: 75% (after overlap and roads)
```

### What This Means
- **1.104 Ha becomes PUBLIC ROAD** (not sold to anyone)
- **8.896 Ha can be sold** to individual plot buyers
- Owner gets payment for 8.896 Ha only
- Road is legally surrendered to County Government

### How VipimoAI Calculates This
```
Sidebar Display:
Road Surrender: 1.10 Ha ← This land is surrendered
Yield Efficiency: 75% ← Shows net developable percentage
Valid Plots: 42 ← Only plots with road access
```

### In Mutation Form
The LRA 27 must show:
- Original parcel area
- Road area (road surrender)
- Net developable area
- All road dimensions

---

## Preventing "The Island Fallacy"

### What Is An Island?
A subdivision with:
- ✅ Internal roads (spine + rib roads)
- ❌ NO connection to external gazetted road
- ❌ Completely enclosed/isolated

### The Consequence
- **REJECTED** by Director of Surveys
- Reason: Landlocked subdivision cannot be registered
- **Most common rejection reason**

### How VipimoAI Prevents This

**Use the Frontage Edge Selector (📍 MapPin Tool):**

1. **Upload your parcel coordinates**
2. **Click 📍 MapPin button** in toolbar
3. **Click 2+ vertices** on the parcel boundary **facing the external road**
4. **Confirm** the selection
5. **Auto Subdivide** will align spine road perpendicular to this frontage edge

### Why This Works
- ✅ You explicitly mark WHERE the external road is
- ✅ Spine road aligns perpendicular to external road
- ✅ Rib roads connect to spine
- ✅ All plots have clear road connectivity
- ✅ Mutation form shows clear external connection
- ✅ Director of Surveys sees: NO ISLAND ✓

---

## Configuration Parameters

```typescript
// Inside handleAutoSubdivide()
const config = {
  targetWidth: 15,           // Plot width in meters
  targetDepth: 30,           // Plot depth in meters
  accessRoadWidth: 9,        // Rib roads - LEGAL MINIMUM
  spineRoadWidth: 12,        // Spine road - Feeder standard
  minAreaRatio: 0.75,        // Minimum viable plot ratio
  minResidualArea: 200,      // Minimum residual area (m²)
  truncationSize: 3,         // Corner chamfer (2.5-5m standard)
  culDeSacRadius: 15,        // Cul-de-sac radius (if used)
};
```

### Changing Dimensions
In the **Sidebar**, you can adjust:
- **Plot Width:** Default 15m (can change)
- **Plot Depth:** Default 30m (can change)
- **Road Width:** Default 9m (CANNOT go below - legal minimum)

### If Road Width < 9m
```
⚖️ LEGAL ERROR: Road width cannot be below 9m.
Kenya Land Registration Act requires minimum 9m for access roads.
Change road width in sidebar to 9m or greater.
```
Subdivision will be blocked until you fix this.

---

## Quality Metrics

### Efficiency Percentage
Shows what percentage of parcel becomes sellable plots (vs road/overlap).

```
Efficiency = (Valid Plot Area) / (Total Parcel Area) × 100

Typical: 70-80%
- <70%: Too much road or overlap
- >85%: May indicate too-narrow roads or risky layout
```

### Valid Plot Count
Only plots with:
- ✅ Road access (frontage/spine/internal)
- ✅ 3+ coordinates
- ✅ Minimum size (>200m²)

Excluded:
- ❌ Landlocked plots (no road)
- ❌ Residual fragments
- ❌ Overlapping areas

### Road Access Breakdown
```
Sidebar shows:
Total Plots with Road Access: 42
├─ Frontage: 8 (direct external road)
├─ Spine: 18 (internal main road)
└─ Internal: 16 (rib roads)
```

---

## Plot Information (Click on Any Plot)

When you click a plot on the map, you see:

```
📍 PLOT DETAILS
━━━━━━━━━━━━━━━
Plot Number: 1
Road Access: 🟢 FRONTAGE

Area: 450 m²  |  0.045 Ha
Dimensions: 15m × 30m

Road Connection:
Direct access to external public road
(marked via Frontage Edge Selector)

Coordinates:
1. (-1.3521°, 36.7784°)
2. (-1.3520°, 36.7785°)
3. (-1.3519°, 36.7783°)
[... showing first 6 vertices]
```

### Road Access Explanation
- 🟢 **Frontage:** "This plot is on the parcel boundary facing the external road"
- 🔵 **Spine:** "This plot faces the main internal circulation road which connects to external road"
- ⚪ **Internal:** "This plot is accessible via internal rib roads connecting to the spine road"

---

## Equal Plots Feature

When "Equal Plots" option is enabled:
- All plots are same size (target width × target depth)
- Provides fairness and equal land distribution
- Residuals are either merged or marked non-sellable
- Easier for buyer comparison

When disabled:
- Plots vary based on parcel shape
- May create different sizes
- Maximizes plot count
- Some plots may be truncated (chamfered)

---

## Workflow Summary

### Step 1: Upload Parcel
- Enter parcel coordinates (at least 3 points)
- System validates polygon

### Step 2: Mark Road (Recommended)
- Click 📍 MapPin button
- Select 2+ vertices on road-facing boundary
- Confirms: "This edge faces the external road"

### Step 3: Configure Dimensions
- Set Plot Width (default 15m)
- Set Plot Depth (default 30m)
- Road Width (minimum 9m)

### Step 4: Run Auto Subdivide
- Click 🗂️ (Grid icon)
- System validates:
  - ✅ Zero landlocked check
  - ✅ Minimum road width enforcement
  - ✅ Corner splays applied
  - ✅ Road surrender calculated

### Step 5: Review Results
- Sidebar shows: Valid plots, frontage breakdown, efficiency, road area
- Map shows: Color-coded plots by access type
- Click any plot: See detailed road access info

### Step 6: Generate Mutation Form
- When ready, click "Generate Mutation" (LRA 27)
- System includes:
  - All road dimensions
  - External road connectivity proof
  - Zero landlocked compliance
  - Road surrender calculation
  - Plot details with coordinates

### Step 7: Submit to Director
- Export PDF from VipimoAI
- Add surveyor signature
- Submit to Director of Surveys office
- **Expected outcome: FIRST-TIME APPROVAL** ✓

---

## Activity Logging

Every action is logged for audit trail:

```json
{
  "action": "subdivision_generated",
  "timestamp": "2025-01-04T15:30:00Z",
  "details": {
    "total_plots": 42,
    "landlocked_plots_excluded": 0,
    "frontage_plots": 8,
    "spine_access_plots": 18,
    "internal_access_plots": 16,
    "access_road_width_m": 9,
    "spine_road_width_m": 12,
    "truncation_size_m": 3,
    "road_area_ha": 1.104,
    "efficiency": "75.2%",
    "external_road_marked": true
  }
}
```

This log is saved for your records and can be referenced if Director has questions.

---

## Kenyan Legal Context

For full legal framework, see: **KENYA_LEGAL_COMPLIANCE.md**

Key points:
- 📋 **Land Registration Act (2012):** Zero Landlocked Mandate
- 📋 **The Survey Act (Cap 299):** Road standards and surveyor duties
- 📋 **Physical and Land Use Planning Act (2019):** Development standards
- 📋 **Director of Surveys Manual:** Technical specifications

---

## Common Questions

### Q: Can I have roads narrower than 9m?
**A:** No. Kenya law requires minimum 9m for access roads. VipimoAI will block subdivision if you try.

### Q: What if my parcel doesn't touch an external road?
**A:** Mark the edge where you PLAN to connect with an easement or wayleave (Section 98, LRA). Use Frontage Edge Selector to show intended connection point.

### Q: Why does my efficiency drop below 70%?
**A:** Your parcel shape or size may make subdivision inefficient. Consider larger plot sizes or wider parcel area.

### Q: Can I exclude some plots from the output?
**A:** Yes, manually deselect plots before saving. Only selected plots are registered.

### Q: What if system says "Island Fallacy"?
**A:** Use Frontage Edge Selector to mark which part of boundary faces external road. This proves connectivity.

### Q: Can I use narrower rib roads for cost savings?
**A:** No. 9m is LEGAL MINIMUM. Narrower roads will cause Director rejection. Not worth the risk.

### Q: How much road surrender is normal?
**A:** Typically 10-15% depending on parcel size and shape. Smaller parcels = higher percentage.

---

## Next Steps

1. ✅ **Review KENYA_LEGAL_COMPLIANCE.md** for full legal framework
2. ✅ **Mark frontage edge** using 📍 MapPin tool
3. ✅ **Run auto subdivide** with legal minimums
4. ✅ **Review plot details** on map
5. ✅ **Generate mutation form** (LRA 27)
6. ✅ **Submit to Director of Surveys**

---

## Support

For issues or questions:
- Check KENYA_LEGAL_COMPLIANCE.md for legal details
- Review FRONTAGE_EDGE_SELECTOR_GUIDE.md for marking edge
- Consult county planning office for local variations
- Contact licensed surveying professional for complex cases

**System guarantee: With proper workflow, expect first-time approval from Director of Surveys.**
