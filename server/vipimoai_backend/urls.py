from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/rtk/', include('rtk_core.urls')),
    path('api/', include('vision_ai.urls')),
    path('api/spatial-db/', include('spatial_db.urls')),
    path('api/brain/', include('brain.urls')),
]
