from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from spatial_db.models import TruthOverride
from .services import interpret_truth_overrides


class StrategyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rim_id = request.query_params.get('rim_id')
        if not rim_id:
            return Response({'error': 'rim_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rim_id_int = int(rim_id)
        except (TypeError, ValueError):
            return Response({'error': 'rim_id must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        overrides = list(
            TruthOverride.objects.filter(rim_id=rim_id_int).values('geometry', 'attributes')
        )

        strategy = interpret_truth_overrides(overrides)
        return Response(strategy)
