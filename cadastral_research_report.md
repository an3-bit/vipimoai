VipimoAI: Backend Implementation & Flow Guide

Document Type: Technical Implementation & Logic Outline

Core Stack: Python, Django, GeoDjango, PostgreSQL + PostGIS (pgRouting), Celery + Redis, OpenCV, Vision LLMs, GDAL/OGR

1. Executive Summary

The VipimoAI backend is designed to automate the surveyor's workflow from raw RTK data ingestion to the final legally compliant form generation. To achieve strict legal precision, spatial optimization, and direct government compliance, the backend is built on a Dual-Engine Architecture. This guide outlines the data flow across our Django applications, offering unparalleled value across the two distinct administrative realities in Kenya:

For Paper-Based (Undigitized) Counties: In regions where surveyors rely on physical Registry Index Maps (RIMs) and manila cadastral sheets, a "Ground Truth Gap" exists because open-source satellite imagery is often outdated or obscured. VipimoAI solves this with a Multimodal Cadastral Vision Pipeline. A surveyor snaps a smartphone photo of the physical RIM; VipimoAI uses OpenCV to auto-georeference and stretch the paper map to perfectly match the RTK polygon. Simultaneously, Vision LLMs extract neighboring parcel numbers and road labels, instantly digitizing analog workflows and establishing the paper document as the ultimate legal truth.

For Digitized Counties (e.g., Nairobi / Ardhisasa): Digitized counties employ National Land Information Management Systems (NLIMS) that instantly reject manual CAD files for microscopic (0.001mm) boundary overlaps or slivers. Here, VipimoAI acts as an OGC-Compliant API Spatial Gateway. It automatically pulls live cadastral boundaries and zoning constraints directly from government APIs (via WFS/WMS). By utilizing Shapely to enforce these precise neighbor coordinates as immutable "hard walls," VipimoAI provides a "Zero-Overlap Guarantee." This ensures a 100% topological acceptance rate on Ardhisasa and formats the exact spatial payload (GeoJSON/.shp) required for a 1-click submission.

2. The Dual-Engine Architecture (Enhanced)

VipimoAI bridges the gap between spatial math, human intent, and physical/digital documentation by separating the "Thinking" from the "Doing."

A. The Deterministic Engine (The "Hands")

This engine executes the strict, 64-bit precision mathematical logic. It operates purely on coordinate geometry and never guesses.

Database Layer: PostgreSQL + PostGIS (via GeoDjango) acting as the single source of truth for all spatial queries. Features pgRouting to mathematically prove road connectivity.

Geometry Processing: Shapely (Python) for polygon slicing, buffering, and intersection checks.

Topological/CAD Tools: SciPy (Spatial) for 3D Delaunay Triangulation and Fiona/GDAL for seamless spatial data translation (DXF, Shapefile, GeoJSON).

Image Processing: OpenCV (Python) for edge detection, image skew correction, and geometric feature matching.

B. The Cognitive Engine (The "Smart Brain")

This engine acts as the Digital Surveyor. It interprets context, human intent, uploaded legal imagery, and live government APIs, then dictates the strategic parameters.

Tier 1 (Multimodal & API Reasoning): Vision-capable LLM APIs used to read text off photographed cadastral sheets. Simultaneously, REST/WFS API connectors query digitized county registries (e.g., Ardhisasa NLIMS) for live zoning constraints and master-boundary alignments.

Tier 2 (Machine Learning): Scikit-Learn / XGBoost used to capture "learning deltas" from human overrides.

Tier 3 (Future Custom AI): A fine-tuned open-source Hugging Face model trained via LoRA specifically on the Kenyan Survey Act.

3. Case-Driven Logic & Engine Reasoning

The necessity of the Dual-Engine setup is validated by these core surveying use-cases:

Case Study 1: Precision Derivation (The Slide-Line Logic)

The Scenario: Deriving an exact 0.046 Ha plot from a parent parcel (Points P1, P2, P4, P5).

The Engine Reasoning (math_engine + document_exporter): The backend bypasses manual nudging. The math_engine anchors to the P1-P2 vector and runs a binary search with Shapely, shifting a cut-line until polygon.area == 460.00 sqm. It seamlessly extracts the exact Arc 1960 coordinates, writing them directly to the final matrix. Zero human transcription errors.

Case Study 2: Multi-Target Succession (The Frontage Optimization Logic)

The Scenario: Subdividing a parent parcel into 5.0, 2.0, 1.0, and 1.0 Acre plots. The parcel has a 32m existing road on the East and a 10m road on the South.

The Engine Reasoning (cognitive_engine): A "dumb" script would drop a 9m road through the middle. Instead, our cognitive_engine identifies existing frontages and outputs a JSON strategy: {"strategy": "anchor_small_plots_to_existing_roads"}. The math_engine stacks the smaller plots against the existing roads.

The Result: 100% land utilization without sacrificing internal acreage to new roads.

4. End-to-End Implementation Flow

When a surveyor triggers a subdivision, the Django backend executes the following modular pipeline:

Step 1a: Ingestion & Projection (rtk_ingestion/ app)

Action: Receives raw RTK WGS84 coordinates via WebSockets or a CSV/DXF file upload.

Logic: GeoDjango instantly validates and re-projects the coordinates into the designated local Coordinate Reference System (e.g., UTM Arc 1960).

Step 1b: Cadastral Vision Ingestion (For Paper-Based Counties)

Action: The surveyor uploads a smartphone photo of the physical Registry Index Map (RIM).

Logic: OpenCV detects skewed boundaries, matches them to the RTK polygon, and applies an "Affine Transformation." The Vision LLM extracts metadata: "Found adjacent parcel numbers: '7001' (South) and '373' (West)."

Step 1c: OGC-Compliant Registry Sync (For Digitized Counties like Nairobi) (ENHANCED)

Action: The system queries the county GIS API (e.g., Ardhisasa NLIMS) using OGC standards like WFS (Web Feature Service).

Logic (Live Zoning Enforcement): Retrieves metadata like {"zone": "Karen", "min_plot_size": "0.2 Ha"}. If a user asks for a 0.045 Ha plot, the engine blocks the action based on live municipal law.

Logic (The "Zero-Overlap" Guarantee): Retrieves the precise vector coordinates of the neighboring parcels from the government database. Shapely uses these exact government boundaries as an immutable constraint, guaranteeing the generated subdivision will not overlap a neighbor by even a millimeter, thus preventing automated system rejections.

Step 2: Context Assembly & The "Truth Override" (spatial_db/ app)

Action: The system compiles constraints from OSM, Vision Data, and Digital County APIs.

Logic: The Hierarchy of Truth. Government API Data > Scanned Physical RIM > OSM/Satellite Data. The backend enforces constraints based on the highest available tier of legal truth.

Step 3: Strategic Reasoning (cognitive_engine/ app)

Action: The enriched context and user targets are formatted into an LLM prompt.

Logic: The AI Brain evaluates the constraints and returns an actionable JSON strategy, pre-populating adjacency data and ensuring zoning compliance.

Step 4: Mathematical Execution (math_engine/ app)

Action: Python consumes the JSON strategy.

Logic: Shapely executes the vector sweeps and precise area subdivisions. pgRouting verifies that the internal subdivision roads topologically connect to the main county highway network.

Guardrail Constraint: No plot is committed without passing plot.within(mother_parcel). Complex tasks are offloaded to Celery + Redis workers.

Step 5: Compliance Formatting (document_exporter/ app)

Action: Compiles the successful geometric layers into standardized output files.

Logic (Paper Flow): Generates the formatted Form LRA 27 PDF, automatically injecting neighboring parcel numbers extracted by the Vision Engine.

Logic (Digital Flow - ENHANCED): For digitized counties, bypasses the PDF entirely. Utilizing open-source GDAL/OGR bindings, the backend generates a rigorously formatted GeoJSON, GML, or .shp (Shapefile) spatial payload ready for instant 1-click submission into the Ardhisasa/County portal.

6. Open-Source Ecosystem Interoperability (NEW)

To maintain maximum value and scalability, the VipimoAI backend relies on established open-source geospatial standards:

GDAL/Fiona: Ensures we can ingest and export any proprietary CAD format without paying licensing fees.

GeoServer (Optional Microservice): Can be deployed alongside Django to serve our live optimized subdivisions directly to external web-maps via WMS/WFS protocols.

pgRouting: Extends PostGIS to guarantee that our generated layouts never produce legally "landlocked" geometries.

7. Security & Performance Considerations

Celery + Redis Offloading: Tasks like OpenCV Skew Correction, Registry API fetching, and recursive Shapely subdivisions are routed strictly to background queues, allowing seamless WebSocket communication to the frontend.

Data Immutability: Uploaded RIM photos, API payloads, and human overrides are securely logged. They never overwrite the original raw RTK telemetry, preserving the absolute legal chain of custody.