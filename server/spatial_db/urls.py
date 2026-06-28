from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import RIMRasterViewSet, RIMExtractedFeatureViewSet, TruthOverrideViewSet

router = DefaultRouter()
router.register('rims', RIMRasterViewSet)
router.register('features', RIMExtractedFeatureViewSet)
router.register('overrides', TruthOverrideViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
