# 📋 Kenyan Land Subdivision Compliance Checklist
## Pre-Submission Verification (Before LRA 27 Mutation Form)

---

## ✅ ZERO LANDLOCKED MANDATE
**Requirement:** Every plot MUST have direct road access

- [ ] **Sidebar shows:** "X plots with road access"
- [ ] **Sidebar shows:** Access breakdown (🟢 frontage, 🔵 spine, ⚪ internal)
- [ ] **Sidebar shows:** 0 landlocked plots excluded
- [ ] **Toast message displayed:** "X plots with road access"
- [ ] **Activity log has:** `landlocked_plots_excluded: 0`
- [ ] **Each plot on map shows:** Color-coded badge (green/blue/gray)
- [ ] **Click any plot:** Shows "Road Access: FRONTAGE/SPINE/INTERNAL"

**What if this fails:**
- ❌ Don't submit. Adjust plot dimensions to fit more plots with access.
- ❌ Don't submit. Increase parcel area or resize plots.
- ⚠️ System auto-excludes landlocked plots, but ensure you have enough valid plots.

---

## ✅ MINIMUM ROAD WIDTHS
**Requirement:** Cannot go below Kenyan legal minimums

### Access Roads (Rib Roads)
- [ ] Sidebar shows: "Road Width: 9m" (or greater)
- [ ] Cannot be below 9m (system blocks if <9m)
- [ ] Activity log has: `access_road_width_m: 9` (or greater)
- [ ] Toast error shown if user tried <9m: "⚖️ LEGAL ERROR: Road width cannot be below 9m"

### Spine Road
- [ ] Activity log has: `spine_road_width_m: 12` (or greater)
- [ ] Visible on map as main circulation route
- [ ] Perpendicular to external road (if frontage edge marked)

### Corner Splays
- [ ] Activity log has: `truncation_size_m: 3`
- [ ] Visible on corner plots (marked as "📐 Partial" or truncated)
- [ ] Between 2.5-5m standard

**What if this fails:**
- ❌ Submission will be rejected. Increase road width.
- ⚠️ Corner truncation auto-applied. If not showing, check if plots marked as truncated.

---

## ✅ ROAD SURRENDER CALCULATION
**Requirement:** Must calculate and document land surrendered to public

- [ ] Sidebar shows: "Road Surrender: X Ha"
- [ ] Sidebar shows: "Yield Efficiency: X%"
- [ ] Activity log has: `road_area_sqm: XXXXX`
- [ ] Activity log has: `road_area_ha: X.XXX`
- [ ] Activity log has: `road_surrender_percentage: X.XX%`
- [ ] Road surrender percentage between 10-15% (typical)
- [ ] Calculation: Road Area ÷ (Road Area + Parcel Area) × 100

**Example Verification:**
```
Activity Log shows:
- road_area_ha: 1.104
- parcel_area_ha: 8.896
- Calculation: 1.104 ÷ (1.104 + 8.896) × 100 = 11.04% ✓
```

**What if this fails:**
- ⚠️ If efficiency too low (<60%), consider larger plot sizes.
- ⚠️ If efficiency too high (>90%), roads may be too narrow.
- ⚠️ Always show road surrender in mutation form.

---

## ✅ CORNER SPLAYS (TRUNCATION)
**Requirement:** All road intersections must have corner chamfers for safety

- [ ] Map shows corner plots marked differently (truncated)
- [ ] Activity log has: `truncation_size_m: 3`
- [ ] Corner chamfer is 2.5-5m (default 3m)
- [ ] Corner plots show: `isTruncated: true`
- [ ] Mutation form includes: "Corner Splays: 3m truncation at all intersections"

**Verification on Map:**
- Look for corner plots at road intersections
- Should show "📐 Partial" indicator
- Area will be slightly less than other plots (chamfered)

**What if this fails:**
- ⚠️ System auto-applies 3m truncation. If not visible, it may be applied to corner geometry.
- ⚠️ Ensure corner plots are properly registered with truncation dimensions.

---

## ✅ EXTERNAL ROAD CONNECTIVITY
**Requirement:** Must prevent "Island Fallacy" - internal roads must connect to external network

### Frontage Edge Marked (Recommended)
- [ ] Toolbar shows: 📍 MapPin button (available)
- [ ] Used frontage edge selector: `onFrontageEdgeSelected` called
- [ ] Activity log has: `frontage_edge_selected` action
- [ ] Activity log includes:
  - `start_vertex: X`
  - `end_vertex: X`
  - `vertices_count: X`
  - `edge_length_m: XXXX`
- [ ] Toast shows: "✓ Road frontage marked: X vertices, XXXm long"
- [ ] Sidebar confirms: Edge marking completed

### No Island Detected
- [ ] Subdivision connects to parcel boundary
- [ ] Spine road runs perpendicular to boundary (if edge marked)
- [ ] Clear path visible: Boundary → Spine → Rib roads → Plots
- [ ] External road connectivity proven

**If Frontage Edge Not Marked:**
- ⚠️ System shows warning: "⚠️ Recommended: Mark road-facing edge (📍 MapPin)"
- ⚠️ Can still subdivide, but proof of connectivity unclear
- ⚠️ Director may ask for clarification

**What if this fails:**
- ❌ Don't submit without marking external road connection
- ⚠️ Use Frontage Edge Selector to explicitly mark it
- ⚠️ If no external road exists, document easement/wayleave (Section 98, LRA)

---

## ✅ PLOT DETAILS VERIFICATION
**Requirement:** Each plot must have complete information

For EACH plot (at least first 10):
- [ ] Click plot on map
- [ ] Verify displays:
  - ✓ Plot Number
  - ✓ Road Access: (🟢 FRONTAGE / 🔵 SPINE / ⚪ INTERNAL)
  - ✓ Area (m² and Ha)
  - ✓ Dimensions (Width × Depth)
  - ✓ Road Connection explanation
  - ✓ Coordinates (at least 3, typically 6+ shown)
- [ ] No plot shows "Road Access: LANDLOCKED"
- [ ] All coordinates in 6-decimal format (-X.XXXXXX°, XX.XXXXXX°)

**Example Plot Popup:**
```
Plot Number: 5
Road Access: 🟢 FRONTAGE
Area: 450 m² | 0.045 Ha
Dimensions: 15m × 30m
Road Connection: Direct access to external public road

Coordinates:
1. (-1.3521°, 36.7784°)
2. (-1.3520°, 36.7785°)
[... 4 more vertices]
```

**What if this fails:**
- ❌ Don't submit plots with missing information
- ⚠️ System should auto-generate all this data
- ⚠️ Verify plot coordinates have sufficient precision

---

## ✅ ACTIVITY LOG COMPLETENESS
**Requirement:** Full audit trail for Director review

- [ ] Activity log shows: `subdivision_generated` action
- [ ] Timestamp recorded
- [ ] All details fields populated:
  - ✓ `total_plots: X`
  - ✓ `landlocked_plots_excluded: X`
  - ✓ `frontage_plots: X`
  - ✓ `spine_access_plots: X`
  - ✓ `internal_access_plots: X`
  - ✓ `access_road_width_m: X`
  - ✓ `spine_road_width_m: X`
  - ✓ `truncation_size_m: X`
  - ✓ `road_area_sqm: XXXXX`
  - ✓ `road_area_ha: X.XXX`
  - ✓ `road_surrender_percentage: X.XX%`
  - ✓ `efficiency: X.X%`
  - ✓ `parcel_area_ha: X.XXX`
  - ✓ `external_road_marked: true/false`
  - ✓ `frontage_edge_vertices: X` (if marked)
  - ✓ `riparian_enabled: true/false`

- [ ] If frontage edge marked:
  - ✓ Activity log shows: `frontage_edge_selected` action
  - ✓ Includes: `start_vertex`, `end_vertex`, `vertices_count`, `edge_length_m`

**What if this fails:**
- ⚠️ Logs auto-generated by system
- ⚠️ If missing data, check that all steps were completed
- ⚠️ Director may request logs as evidence of compliance

---

## ✅ MUTATION FORM READINESS
**Requirement:** System must be ready to generate LRA 27

Before clicking "Generate Mutation Form":
- [ ] All above checks PASSED ✓
- [ ] Valid plots: X (showing in sidebar)
- [ ] Landlocked plots: 0 (confirmed)
- [ ] Road dimensions: Verified as legal (9m+)
- [ ] Road surrender: Calculated and shown
- [ ] Frontage edge: Marked (or acknowledged as not marked)
- [ ] Activity log: Complete with all details
- [ ] Plot details: All show road access type
- [ ] Efficiency: Between 60-90% (reasonable)

**Then click:** "Generate Mutation" → "Export PDF"

---

## ✅ DIRECTOR SUBMISSION PREPARATION
**Requirement:** Mutation form must include all required legal compliance information

**Mutation Form Must Include:**

### Section 1: Parcel Information
- [ ] Original parcel coordinates
- [ ] Parcel total area
- [ ] Parcel location (county, district)
- [ ] Frontage edge location (marked coordinates)

### Section 2: Road Layout
- [ ] Spine road: 12m width (documented)
- [ ] Rib roads: 9m width (documented)
- [ ] Corner splays: 3m truncation (documented)
- [ ] External connectivity: Proven via frontage edge
- [ ] Road network diagram (visual)

### Section 3: Plot Schedule
- [ ] For each plot:
  - ✓ Plot number
  - ✓ Area (m² and Ha)
  - ✓ Dimensions (width × depth)
  - ✓ Road access type (FRONTAGE/SPINE/INTERNAL)
  - ✓ Full coordinates (6-decimal precision)
  - ✓ Truncation details (if applicable)

### Section 4: Road Surrender Declaration
- [ ] Total road area: X Ha
- [ ] Road surrender percentage: X%
- [ ] Surrendered to: County/National Government
- [ ] Impact on yield: Efficiency X% calculated

### Section 5: Zero Landlocked Compliance
- [ ] ☑ All X plots have road access
- [ ] ☑ Frontage plots: X
- [ ] ☑ Spine access plots: X
- [ ] ☑ Internal access plots: X
- [ ] ☑ Landlocked plots: 0

### Section 6: Minimum Standards Compliance
- [ ] ☑ Access roads: 9m (legal minimum met)
- [ ] ☑ Spine road: 12m (feeder standard met)
- [ ] ☑ Corner splays: 3m (safety standard met)
- [ ] ☑ External connectivity: Proven

### Section 7: Surveyor Certification
- [ ] Surveyor name
- [ ] License number
- [ ] Signature block
- [ ] Date signed
- [ ] Surveyor contact information

### Section 8: Director of Surveys Block (Left Blank)
- [ ] Date received
- [ ] Space for approval/rejection
- [ ] Reference number
- [ ] Director signature and stamp

**What if this fails:**
- ❌ Don't submit incomplete form
- ⚠️ All information must be verified before exporting
- ⚠️ Errors will cause rejection and delays

---

## 🚨 COMMON REJECTION REASONS (How to Avoid)

| Issue | Prevention | Verification |
|-------|-----------|--------------|
| **Landlocked plots** | System validates all plots | Sidebar shows 0 landlocked |
| **Roads < 9m** | System blocks if <9m | Activity log shows ≥9m |
| **No corner splays** | System auto-applies | Activity log shows 3m truncation |
| **No road area** | System calculates | Sidebar shows road surrender Ha |
| **No external connection** | Mark frontage edge | Activity log shows edge marked |
| **Missing coordinates** | System generates | Click plot and verify all coords |
| **Unclear road hierarchy** | System differentiates spine (12m) vs rib (9m) | Activity log shows both |
| **Surveyor not certified** | Add signature block | Mutation form has sign block |
| **Residual fragments** | System auto-merges | Verify plot count is reasonable |
| **No Director block** | Template includes space | PDF export includes space |

---

## 📞 QUALITY ASSURANCE CONTACTS

Before submitting, contact:

1. **County Planning Office**
   - Verify local requirements match system
   - Check for county-specific standards
   - Get pre-approval if possible

2. **Director of Surveys Office**
   - Clarify any ambiguous requirements
   - Ask about recent rejections to avoid
   - Verify submission format

3. **Professional Surveying Colleague**
   - Review subdivision for reasonableness
   - Check calculations
   - Verify road layout makes sense

4. **VipimoAI System**
   - Verify all checks PASSED
   - Confirm activity log complete
   - Export mutation form

---

## ✅ FINAL SIGN-OFF

Before submission, sign below:

```
PROJECT INFORMATION:
Project Name: _________________________
Parcel Location: _______________________
Total Area: _________ Ha
Surveyor: _____________________________
License #: _____________________________
Date: __________________________________

COMPLIANCE VERIFICATION:
☐ All checks above PASSED
☐ Activity log reviewed and complete
☐ Frontage edge marked (or documented as N/A)
☐ Road dimensions verified as legal
☐ Plot details verified on map
☐ Mutation form generated
☐ PDF exported
☐ Ready for Director submission

Surveyor Signature: ____________________
Date: __________________________________
```

---

## 📖 REFERENCE DOCUMENTS

- **KENYA_LEGAL_COMPLIANCE.md** - Full legal framework
- **ROAD_ACCESS_GUIDE.md** - System operation guide
- **FRONTAGE_EDGE_SELECTOR_GUIDE.md** - Edge marking instructions

---

**Expected Outcome with Proper Compliance: FIRST-TIME APPROVAL ✓**

Submit with confidence when all checks are PASSED.
