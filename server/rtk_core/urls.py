from django.urls import path
from .views import RTKIngestView, CoordinateIngestView

urlpatterns = [
    path('ingest/', RTKIngestView.as_view(), name='rtk-ingest'),
    path('ingest-coordinates/', CoordinateIngestView.as_view(), name='coordinate-ingest'),
]
