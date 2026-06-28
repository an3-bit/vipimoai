# VipimoAI Django REST Framework + MySQL Backend

This is the backend server for VipimoAI, built with Django, Django REST Framework, and MySQL. It replaces the original Supabase backend, including database tables, authentication, audit logs, and the AI subdivision edge function.

## Prerequisites

- Python 3.10+
- Docker / Docker Compose for local PostGIS + Redis development
- Optional: local MySQL if you want to run the legacy MySQL backend path

## Setup Instructions

### 1. Local development with PostGIS (recommended)

1. Copy `.env.example` to `.env` and fill values.
2. Ensure `DB_ENGINE=postgis` and `DATABASE_URL` points to the PostGIS service:
   ```env
   DEBUG=True
   SECRET_KEY=django-insecure-vipimoai-backend-secret-key-2026
   DB_ENGINE=postgis
   DATABASE_URL=postgres://vipimoai:vipimoai@postgis:5432/vipimoai
   CELERY_BROKER_URL=redis://redis:6379/0
   CELERY_RESULT_BACKEND=redis://redis:6379/0
   MEDIA_ROOT=/app/media
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```
3. Start the development stack:
   ```bash
   docker-compose -f ../docker-compose.dev.yml up --build
   ```
4. The API will be available at `http://127.0.0.1:8000/`.

### 2. Alternative local SQLite development

If you do not need PostGIS for a given test run, use the default SQLite configuration by leaving `DB_ENGINE` unset or set to `sqlite`.

### 3. Install Python dependencies

If you are running outside Docker, install packages in the `server` folder:
```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Run database migrations

For any supported backend, run:
```bash
python manage.py migrate
```

### 5. Run the development server

Start Django locally:
```bash
python manage.py runserver
```

The API is available at `http://127.0.0.1:8000/`.

## Notes

- The code now supports `sqlite`, `mysql`, and `postgis` backends.
- When `DB_ENGINE` is set to `postgis`, the project uses `django.contrib.gis` and the PostGIS backend.
- The current Docker compose file already brings up `postgis`, `redis`, `web`, and `worker` services.

## PostGIS Migration Plan

This project currently persists raster metadata and extracted geometry as JSON fields.
A dedicated GeoDjango migration is planned to switch the key spatial models to real
PostGIS geometry columns while keeping JSON payloads for compatibility during the
transition.

See `server/spatial_db/MIGRATION_PLAN.md` for the full step-by-step plan.

## API Endpoints

- **Authentication**:
  - `POST /api/register/` - Create a surveyor user profile.
  - `POST /api/token/` - Obtain JWT access & refresh tokens (login).
  - `POST /api/token/refresh/` - Refresh JWT access token.

- **Survey & Project Management (Auth required)**:
  - `GET/POST /api/profiles/` - Retrieve or edit surveyor license & company details.
  - `GET/POST /api/projects/` - Create, view, or update projects.
  - `GET/POST /api/parcels/` - Parent parcel geometry.
  - `GET/POST /api/subdivisions/` - Subdivision configuration settings.
  - `GET/POST /api/plots/` - View generated plot grids.
    - Supports bulk-creation via `POST /api/plots/bulk-create/`.
    - Supports bulk-deletion via `DELETE /api/plots/bulk-delete/`.
  - `GET/POST /api/beacons/` - Beacon point coordinates.
  - `GET/POST /api/exports/` - Survey export files (PDF, CSV, DXF, etc.).
  - `GET/POST /api/activity-logs/` - Audit trails.

- **AI subdivision calculations (Auth required)**:
  - `POST /api/subdivide/` - Performs the rectangular subdivision calculation and integrates optional Gemini/Lovable AI layout recommendations.
