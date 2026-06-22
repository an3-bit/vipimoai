from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    RegisterView, ProfileViewSet, ProjectViewSet, ParcelViewSet,
    SubdivisionViewSet, PlotViewSet, BeaconViewSet, ExportViewSet,
    ActivityLogViewSet, AISubdivisionView
)

router = DefaultRouter()
router.register(r'profiles', ProfileViewSet, basename='profile')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'parcels', ParcelViewSet, basename='parcel')
router.register(r'subdivisions', SubdivisionViewSet, basename='subdivision')
router.register(r'plots', PlotViewSet, basename='plot')
router.register(r'beacons', BeaconViewSet, basename='beacon')
router.register(r'exports', ExportViewSet, basename='export')
router.register(r'activity-logs', ActivityLogViewSet, basename='activity-log')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('subdivide/', AISubdivisionView.as_view(), name='ai_subdivide'),
    path('', include(router.urls)),
]
