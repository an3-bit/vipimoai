from rest_framework import viewsets, permissions
from .models import RIMRaster, RIMExtractedFeature, TruthOverride
from .serializers import RIMRasterSerializer, RIMExtractedFeatureSerializer, TruthOverrideSerializer


class RIMRasterViewSet(viewsets.ModelViewSet):
    queryset = RIMRaster.objects.all().order_by('-processed_at')
    serializer_class = RIMRasterSerializer
    permission_classes = [permissions.IsAuthenticated]


class RIMExtractedFeatureViewSet(viewsets.ModelViewSet):
    queryset = RIMExtractedFeature.objects.all()
    serializer_class = RIMExtractedFeatureSerializer
    permission_classes = [permissions.IsAuthenticated]


class TruthOverrideViewSet(viewsets.ModelViewSet):
    queryset = TruthOverride.objects.all()
    serializer_class = TruthOverrideSerializer
    permission_classes = [permissions.IsAuthenticated]
