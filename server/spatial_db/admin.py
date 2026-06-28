from django.contrib import admin
from .models import RIMRaster, RIMExtractedFeature, TruthOverride

@admin.register(RIMRaster)
class RIMRasterAdmin(admin.ModelAdmin):
    list_display = ('id', 'uploaded_by', 'crs', 'processed_at')
    readonly_fields = ('processed_at',)

@admin.register(RIMExtractedFeature)
class RIMExtractedFeatureAdmin(admin.ModelAdmin):
    list_display = ('id', 'rim', 'feature_type', 'value', 'confidence')

@admin.register(TruthOverride)
class TruthOverrideAdmin(admin.ModelAdmin):
    list_display = ('id', 'rim', 'immutable', 'created_at')
    readonly_fields = ('created_at',)
