import os
import json
import requests
from rest_framework import viewsets, permissions, status, decorators
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.db import models
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Profile, Project, Parcel, Subdivision, Plot, Beacon, Export, ActivityLog
from .serializers import (
    UserSerializer, ProfileSerializer, ProjectSerializer, ParcelSerializer, 
    SubdivisionSerializer, PlotSerializer, BeaconSerializer, ExportSerializer, ActivityLogSerializer
)
from .geometry import subdivide_rectangular, calculate_polygon_area, get_bounding_box, calculate_distance

# User Registration View
class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "success": True,
                "message": "User registered successfully",
                "user": UserSerializer(user).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# Profile ViewSet
class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)

    def get_object(self):
        profile, created = Profile.objects.get_or_create(user=self.request.user)
        return profile

# Project ViewSet
class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# Parcel ViewSet
class ParcelViewSet(viewsets.ModelViewSet):
    serializer_class = ParcelSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Parcel.objects.filter(project__user=self.request.user)

# Subdivision ViewSet
class SubdivisionViewSet(viewsets.ModelViewSet):
    serializer_class = SubdivisionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Subdivision.objects.filter(parcel__project__user=self.request.user)

# Plot ViewSet
class PlotViewSet(viewsets.ModelViewSet):
    serializer_class = PlotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Plot.objects.filter(
            models.Q(project__user=user) | 
            models.Q(subdivision__parcel__project__user=user)
        ).distinct()

    @decorators.action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        """Allows bulk insertion of plots for a project."""
        plots_data = request.data.get('plots', [])
        project_id = request.data.get('project_id')
        
        if not project_id:
            return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            project = Project.objects.get(id=project_id, user=request.user)
        except Project.DoesNotExist:
            return Response({"error": "Project not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
            
        inserted_plots = []
        for plot_item in plots_data:
            plot = Plot.objects.create(
                project=project,
                plot_number=plot_item['plot_number'],
                coordinates=plot_item['coordinates'],
                area_sqm=plot_item['area_sqm'],
                status=plot_item.get('status', 'valid'),
                is_partial=plot_item.get('is_partial', False),
                width_m=plot_item.get('width_m'),
                depth_m=plot_item.get('depth_m'),
            )
            inserted_plots.append(PlotSerializer(plot).data)
            
        return Response(inserted_plots, status=status.HTTP_201_CREATED)

    @decorators.action(detail=False, methods=['delete'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Bulk delete plots for a project."""
        project_id = request.query_params.get('project_id') or request.data.get('project_id')
        
        if not project_id:
            return Response({"error": "project_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            project = Project.objects.get(id=project_id, user=request.user)
        except Project.DoesNotExist:
            return Response({"error": "Project not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
            
        Plot.objects.filter(project=project).delete()
        return Response({"success": True, "message": "Plots deleted successfully"}, status=status.HTTP_200_OK)

# Beacon ViewSet
class BeaconViewSet(viewsets.ModelViewSet):
    serializer_class = BeaconSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Beacon.objects.filter(
            models.Q(plot__project__user=self.request.user) | 
            models.Q(plot__subdivision__parcel__project__user=self.request.user)
        ).distinct()

# Export ViewSet
class ExportViewSet(viewsets.ModelViewSet):
    serializer_class = ExportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Export.objects.filter(project__user=self.request.user)

# ActivityLog ViewSet
class ActivityLogViewSet(viewsets.ModelViewSet):
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ActivityLog.objects.filter(project__user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# AI Subdivision optimization view
class AISubdivisionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        parcel_coordinates = data.get('parcelCoordinates')
        plot_width = data.get('plot_width')
        plot_depth = data.get('plot_depth')
        target_plot_count = data.get('target_plot_count')
        strategy = data.get('strategy', 'auto_fit')
        orientation_degrees = data.get('orientation_degrees', 0.0)
        road_setback_m = data.get('road_setback_m', 0.0)
        side_setback_m = data.get('side_setback_m', 0.0)
        notes = data.get('notes', '')

        if not parcel_coordinates or len(parcel_coordinates) < 3:
            return Response({'error': 'At least 3 coordinates required'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Run geometric calculations
        parcel_area = calculate_polygon_area(parcel_coordinates)
        bbox = get_bounding_box(parcel_coordinates)
        parcel_width = calculate_distance(
            {'lat': bbox['minLat'], 'lng': bbox['minLng']},
            {'lat': bbox['minLat'], 'lng': bbox['maxLng']}
        )
        parcel_depth = calculate_distance(
            {'lat': bbox['minLat'], 'lng': bbox['minLng']},
            {'lat': bbox['maxLat'], 'lng': bbox['minLng']}
        )

        plots = []
        beacons = []
        suggestions = []
        ai_analysis = None
        crs_name = data.get('crs_name', 'EPSG:21037')

        if strategy == 'succession':
            raw_target_areas = data.get('target_areas', [])
            if not raw_target_areas:
                return Response({'error': 'target_areas array is required for succession strategy'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Convert targets to square meters
            target_areas_sqm = []
            for item in raw_target_areas:
                if isinstance(item, dict):
                    val = float(item.get('value', 0))
                    unit = item.get('unit', 'SQM').upper()
                    if unit == 'HECTARES' or unit == 'HA':
                        target_areas_sqm.append(val * 10000.0)
                    elif unit == 'ACRES' or unit == 'AC':
                        target_areas_sqm.append(val * 4046.8564)
                    else:
                        target_areas_sqm.append(val)
                else:
                    target_areas_sqm.append(float(item))

            from .geometry import solve_succession_subdivision
            plots, beacons = solve_succession_subdivision(parcel_coordinates, target_areas_sqm, crs_name)
            
            total_plot_area = sum([p['area_sqm'] for p in plots])
            efficiency = (total_plot_area / parcel_area) * 100 if parcel_area > 0 else 0
        else:
            if not plot_width or not plot_depth or float(plot_width) <= 0 or float(plot_depth) <= 0:
                return Response({'error': 'Valid plot dimensions required'}, status=status.HTTP_400_BAD_REQUEST)

            sub_results = subdivide_rectangular(
                parcel_coordinates,
                plot_width,
                plot_depth,
                road_setback_m,
                side_setback_m,
                strategy,
                target_plot_count
            )

            plots = sub_results['plots']
            beacons = sub_results['beacons']
            suggestions = sub_results['suggestions']

            # Call Lovable AI API if key is present
            lovable_api_key = os.getenv('LOVABLE_API_KEY')
            if lovable_api_key:
                try:
                    ai_prompt = (
                        f"You are a land surveying expert. Analyze this subdivision request and provide optimization suggestions.\n\n"
                        f"Parcel Details:\n"
                        f"- Total Area: {parcel_area:.2f} sq meters\n"
                        f"- Approximate Width: {parcel_width:.2f} meters\n"
                        f"- Approximate Depth: {parcel_depth:.2f} meters\n"
                        f"- Coordinates: {len(parcel_coordinates)} vertices\n\n"
                        f"Requested Subdivision:\n"
                        f"- Plot Size: {plot_width}m x {plot_depth}m ({float(plot_width)*float(plot_depth)} sq meters per plot)\n"
                        f"- Strategy: {strategy}\n"
                        f"- Target Plot Count: {target_plot_count or 'Auto-fit'}\n"
                        f"- Road Setback: {road_setback_m}m\n"
                        f"- Side Setback: {side_setback_m}m\n"
                        f"- Orientation: {orientation_degrees}°\n"
                        f"- Notes: {notes or 'None'}\n\n"
                        f"Provide a JSON response with:\n"
                        f"1. \"feasibility\": boolean - can the requested subdivision work?\n"
                        f"2. \"max_plots\": number - maximum plots that can fit\n"
                        f"3. \"efficiency_percent\": number - land utilization percentage\n"
                        f"4. \"recommendations\": array of strings - optimization tips\n"
                        f"5. \"alternative_layouts\": array of {{width, depth, count, description}}\n\n"
                        f"Keep response concise and actionable. Respond only with valid JSON."
                    )

                    headers = {
                        'Authorization': f'Bearer {lovable_api_key}',
                        'Content-Type': 'application/json',
                    }
                    body = {
                        'model': 'google/gemini-2.5-flash',
                        'messages': [
                            {'role': 'system', 'content': 'You are a professional land surveyor AI. Respond only with valid JSON.'},
                            {'role': 'user', 'content': ai_prompt}
                        ]
                    }
                    
                    ai_response = requests.post(
                        'https://ai.gateway.lovable.dev/v1/chat/completions',
                        headers=headers,
                        json=body,
                        timeout=10
                    )

                    if ai_response.status_code == 200:
                        ai_data = ai_response.json()
                        content = ai_data.get('choices', [{}])[0].get('message', {}).get('content', '')
                        if content:
                            import re
                            json_match = re.search(r'\{[\s\S]*\}', content)
                            if json_match:
                                try:
                                    ai_analysis = json.loads(json_match.group(0))
                                except json.JSONDecodeError:
                                    pass
                except Exception as e:
                    pass

            if ai_analysis:
                if 'recommendations' in ai_analysis:
                    for rec in ai_analysis['recommendations']:
                        suggestions.append({
                            'type': 'alternative_layout',
                            'message': rec
                        })
                if 'alternative_layouts' in ai_analysis:
                    for alt in ai_analysis['alternative_layouts']:
                        suggestions.append({
                            'type': 'alternative_layout',
                            'message': alt.get('description', f"Alternative: {alt.get('width')}m x {alt.get('depth')}m for {alt.get('count')} plots"),
                            'suggested_width': alt.get('width'),
                            'suggested_depth': alt.get('depth'),
                            'suggested_count': alt.get('count'),
                        })

            efficiency = ai_analysis.get('efficiency_percent') if ai_analysis else ((len(plots) * float(plot_width) * float(plot_depth)) / parcel_area * 100)

        response_data = {
            'success': True,
            'parcel': {
                'area_sqm': parcel_area,
                'width_m': parcel_width,
                'depth_m': parcel_depth,
                'coordinates': parcel_coordinates,
            },
            'subdivision': {
                'strategy': strategy,
                'plot_width': plot_width,
                'plot_depth': plot_depth,
                'road_setback_m': road_setback_m,
                'side_setback_m': side_setback_m,
                'orientation_degrees': orientation_degrees,
                'target_plot_count': target_plot_count,
                'crs_name': crs_name,
                'frontage_edges': frontage_edges,
                'target_areas': data.get('target_areas', []),
            },
            'results': {
                'total_plots': len(plots),
                'plots': plots,
                'beacons': beacons,
                'efficiency_percent': efficiency,
            },
            'suggestions': suggestions,
            'ai_analysis': ai_analysis,
        }

        return Response(response_data, status=status.HTTP_200_OK)
