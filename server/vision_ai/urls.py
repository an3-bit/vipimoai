from django.urls import path
from .views import RIMCreateView, RIMUploadView, VisionIngestView, TaskStatusView

urlpatterns = [
    path('rims/', RIMCreateView.as_view(), name='rims-create'),
    path('rims/<int:pk>/upload/', RIMUploadView.as_view(), name='rims-upload'),
    path('ingest/', VisionIngestView.as_view(), name='vision-ingest'),
    path('tasks/<str:task_id>/', TaskStatusView.as_view(), name='task-status'),
]
