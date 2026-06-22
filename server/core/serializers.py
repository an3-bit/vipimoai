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
