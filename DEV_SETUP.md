Development quick start (Docker Compose)

1. Copy `.env.example` to `.env` and fill `SECRET_KEY` and `OPENROUTER_API_KEY`:

```bash
cp .env.example .env
# Edit .env to add your keys
```

2. Build and start dev services (PostGIS, Redis, Django web, Celery worker):

```bash
docker compose -f docker-compose.dev.yml up --build
```

3. Run migrations and create a superuser (if needed):

```bash
# inside the web container (or run via docker compose exec)
python manage.py migrate
python manage.py createsuperuser
```

4. Access the web API at http://localhost:8000/ and monitor Celery logs in the `worker` service.

Notes:
- Media files (transformed rasters and previews) are stored in the `media/` docker volume and mounted into the `web` and `worker` containers.
- To switch to S3 storage later, set `USE_S3=True` and configure AWS env vars in `.env`.
