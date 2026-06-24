from django.urls import path
from .views import StrategyView

urlpatterns = [
    path('strategy/', StrategyView.as_view(), name='brain-strategy'),
]
