# VipimoAI Django REST Framework + MySQL Backend

This is the backend server for VipimoAI, built with Django, Django REST Framework, and MySQL. It replaces the original Supabase backend, including database tables, authentication, audit logs, and the AI subdivision edge function.

## Prerequisites

- Python 3.10+
- MySQL Server running locally or remotely

## Setup Instructions

1. **Database Configuration**:
   - Create a MySQL database named `vipimoai` (or adjust the name in `.env`).
     ```sql
     CREATE DATABASE vipimoai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
     ```

2. **Configure Environment Variables**:
   - Open the `.env` file in the root of the server folder and configure your database credentials:
     ```env
     DEBUG=True
     SECRET_KEY=django-insecure-vipimoai-backend-secret-key-2026
     DB_NAME=vipimoai
     DB_USER=root
     DB_PASSWORD=your_mysql_password
     DB_HOST=127.0.0.1
     DB_PORT=3306
     LOVABLE_API_KEY=your_optional_lovable_api_key
     ```

3. **Install Dependencies**:
   - The virtual environment `venv` is already created. You can activate it and install the requirements if running on a new machine:
     ```bash
     venv\Scripts\activate
     pip install -r requirements.txt
     ```

4. **Run Database Migrations**:
   - Execute the following command to create all tables in MySQL:
     ```bash
     python manage.py migrate
     ```

5. **Run the Development Server**:
   - Start the development server:
     ```bash
     python manage.py runserver
     ```
   - The API will be available at `http://127.0.0.1:8000/`.

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
