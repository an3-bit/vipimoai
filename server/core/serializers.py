from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile, Project, Parcel, Subdivision, Plot, Beacon, Export, ActivityLog

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['full_name', 'license_number', 'company_name', 'company_address', 'phone_number', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(required=False)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'profile']
        read_only_fields = ['id']

    def create(self, validated_data):
        profile_data = validated_data.pop('profile', {})
        # Create user
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        
        # Profile is created via signals, update fields
        profile = user.profile
        for field, value in profile_data.items():
            setattr(profile, field, value)
        profile.save()
        
        return user


class CoordinateSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class TargetAreaEntrySerializer(serializers.Serializer):
    value = serializers.FloatField()
    unit = serializers.CharField(default='SQM')


class FrontageEdgeSerializer(serializers.Serializer):
    start_index = serializers.IntegerField(min_value=0)
    end_index = serializers.IntegerField(min_value=0)
    coordinates = serializers.ListField(child=CoordinateSerializer(), required=False, allow_empty=True)

    def validate(self, data):
        if data['end_index'] < data['start_index']:
            raise serializers.ValidationError('end_index must be greater than or equal to start_index.')
        return data


class AISubdivisionRequestSerializer(serializers.Serializer):
    parcelCoordinates = serializers.ListField(child=CoordinateSerializer(), min_length=3)
    strategy = serializers.ChoiceField(choices=['auto_fit', 'fixed_count', 'equal_resize', 'succession'], default='auto_fit')
    plot_width = serializers.FloatField(required=False, allow_null=True)
    plot_depth = serializers.FloatField(required=False, allow_null=True)
    target_plot_count = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    road_setback_m = serializers.FloatField(required=False, default=0.0)
    side_setback_m = serializers.FloatField(required=False, default=0.0)
    orientation_degrees = serializers.FloatField(required=False, default=0.0)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    crs_name = serializers.CharField(required=False, default='EPSG:21037')
    target_areas = serializers.ListField(child=TargetAreaEntrySerializer(), required=False, allow_empty=True)
    frontage_edges = serializers.ListField(child=FrontageEdgeSerializer(), required=False, allow_empty=True)

    def validate(self, data):
        strategy = data.get('strategy', 'auto_fit')
        if strategy != 'succession':
            if data.get('plot_width') is None or data.get('plot_depth') is None:
                raise serializers.ValidationError('plot_width and plot_depth are required for rectangular subdivision strategies.')
        if strategy == 'succession' and not data.get('target_areas'):
            raise serializers.ValidationError('target_areas is required for succession strategy.')
        return data

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        if 'password' in validated_data:
            instance.set_password(validated_data['password'])
        instance.save()

        # Update profile
        profile = instance.profile
        for field, value in profile_data.items():
            setattr(profile, field, value)
        profile.save()

        return instance

class BeaconSerializer(serializers.ModelSerializer):
    class Meta:
        model = Beacon
        fields = '__all__'

class PlotSerializer(serializers.ModelSerializer):
    beacons = BeaconSerializer(many=True, read_only=True)

    class Meta:
        model = Plot
        fields = '__all__'

class SubdivisionSerializer(serializers.ModelSerializer):
    plots = PlotSerializer(many=True, read_only=True)

    class Meta:
        model = Subdivision
        fields = '__all__'

class ParcelSerializer(serializers.ModelSerializer):
    subdivisions = SubdivisionSerializer(many=True, read_only=True)

    class Meta:
        model = Parcel
        fields = '__all__'

class ExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Export
        fields = '__all__'

class ActivityLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ActivityLog
        fields = '__all__'
        read_only_fields = ['user']

class ProjectSerializer(serializers.ModelSerializer):
    parcels = ParcelSerializer(many=True, read_only=True)
    exports = ExportSerializer(many=True, read_only=True)
    activity_logs = ActivityLogSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ['user']
