from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.core.files.storage import default_storage
from django.conf import settings

from spatial_db.models import RIMRaster
from core.models import ActivityLog, Project
from django.conf import settings
from vision.tasks import georeference_and_extract
from .serializers import RIMCreateSerializer, RIMUploadSerializer, VisionIngestSerializer
from celery.result import AsyncResult


class TaskStatusView(APIView):
        """GET /api/tasks/<task_id>/ — returns basic Celery task status and result.

        Response contract (200):
            {
                 "task_id": "<id>",
                 "state": "PENDING|STARTED|SUCCESS|FAILURE",
                 "result": <result_or_null>
            }
        """

        permission_classes = [permissions.IsAuthenticated]

        def get(self, request, task_id):
                ar = AsyncResult(task_id)
                data = {
                        'task_id': task_id,
                        'state': ar.state,
                        'result': ar.result if ar.ready() else None,
                }
                return Response(data, status=status.HTTP_200_OK)


class RIMCreateView(APIView):
    """POST /api/rims/  — create RIM metadata record.

    Response contract (201):
      {
        "id": <rim_id>,
        "message": "created",
        "data": { <submitted metadata echoed> }
      }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RIMCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        rim = RIMRaster.objects.create(
            uploaded_by=request.user if request.user and request.user.is_authenticated else None,
            file_path='',
            preview_path=None,
            crs=data.get('crs', 'EPSG:21037'),
            bbox=data.get('bbox'),
        )

        # Audit log (if project specified)
        try:
            if data.get('project_id'):
                try:
                    proj = Project.objects.get(id=data.get('project_id'))
                except Exception:
                    proj = None
            else:
                proj = None

            if proj and request.user and request.user.is_authenticated:
                ActivityLog.objects.create(
                    project=proj,
                    user=request.user,
                    action_type='rim.create',
                    action_label='RIM metadata created',
                    details={'rim_id': rim.id, 'payload': data},
                )
        except Exception:
            # Do not fail request if audit logging breaks
            pass

        return Response({
            'id': rim.id,
            'message': 'created',
            'data': data,
        }, status=status.HTTP_201_CREATED)


class RIMUploadView(APIView):
    """POST /api/rims/{id}/upload/ — receive multipart upload and attach to RIM.

    Response contract (200):
      {
        "rim_id": <int>,
        "file_url": "<media-relative-path>",
        "preview_url": "<preview-path-if-generated>",
        "tie_points": <echoed tie_points or null>
      }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            rim = RIMRaster.objects.get(pk=pk)
        except RIMRaster.DoesNotExist:
            return Response({'error': 'rim_not_found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RIMUploadSerializer(data=request.data, files=request.FILES)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = serializer.validated_data['file']
        tie_points = serializer.validated_data.get('tie_points')

        # Validate file size and content type
        max_bytes = getattr(settings, 'RIM_MAX_UPLOAD_SIZE', 50 * 1024 * 1024)  # 50 MB default
        content_type = getattr(file, 'content_type', '')
        allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff']
        if content_type and content_type not in allowed:
            return Response({'error': 'invalid_file_type', 'allowed': allowed}, status=status.HTTP_400_BAD_REQUEST)

        if hasattr(file, 'size') and file.size > max_bytes:
            return Response({'error': 'file_too_large', 'max_bytes': max_bytes}, status=status.HTTP_400_BAD_REQUEST)

        # Save to default storage under rims/
        filename = default_storage.save(f"rims/{file.name}", file)
        # Get a path we can hand to the vision worker (absolute when possible)
        try:
            absolute_path = default_storage.path(filename)
        except Exception:
            # Fallback: construct from MEDIA_ROOT
            media_root = getattr(settings, 'MEDIA_ROOT', None)
            absolute_path = f"{media_root}/{filename}" if media_root else filename

        # Attach to model
        rim.file_path = filename
        rim.preview_path = filename
        rim.save(update_fields=['file_path', 'preview_path'])

        # Audit log entry
        try:
            if request.user and request.user.is_authenticated:
                ActivityLog.objects.create(
                    project=(rim.uploaded_by.projects.first() if rim.uploaded_by else None),
                    user=request.user,
                    action_type='rim.upload',
                    action_label='RIM image uploaded',
                    details={'rim_id': rim.id, 'file': filename, 'tie_points': tie_points},
                )
        except Exception:
            pass

        return Response({
            'rim_id': rim.id,
            'file_url': filename,
            'preview_url': rim.preview_path,
            'tie_points': tie_points if tie_points is not None else None,
        }, status=status.HTTP_200_OK)


class VisionIngestView(APIView):
    """POST /api/vision/ingest/ — trigger async georeference + extraction.

    Request body (application/json): { rim_id | image_path, polygon, crs, options }

    Response contract (202):
      {
        "task_id": "<celery-task-id>",
        "status": "accepted",
        "task_url": "/api/tasks/<task_id>/"
      }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = VisionIngestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Determine image path: prefer rim.file_path when rim_id supplied
        image_path = data.get('image_path')
        if data.get('rim_id'):
            try:
                rim = RIMRaster.objects.get(pk=data['rim_id'])
                # use storage path where the file lives
                try:
                    image_path = default_storage.path(rim.file_path)
                except Exception:
                    image_path = rim.file_path
            except RIMRaster.DoesNotExist:
                return Response({'error': 'rim_not_found'}, status=status.HTTP_404_NOT_FOUND)

        polygon = data.get('polygon') or []
        crs = data.get('crs', 'EPSG:21037')

        # Enqueue Celery task (vision.tasks.georeference_and_extract)
        # The heavy work happens inside the task; placeholder logic is in vision.tasks
        task = georeference_and_extract.delay(image_path, polygon, crs, request.user.id if request.user and request.user.is_authenticated else None)

        return Response({
            'task_id': task.id,
            'status': 'accepted',
            'task_url': f"/api/tasks/{task.id}/",
        }, status=status.HTTP_202_ACCEPTED)
