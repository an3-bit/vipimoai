import uuid
from django.db import models
from django.contrib.auth.models import User

# User Profile
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    full_name = models.CharField(max_length=255, null=True, blank=True)
    license_number = models.CharField(max_length=100, null=True, blank=True)
    company_name = models.CharField(max_length=255, null=True, blank=True)
    company_address = models.TextField(null=True, blank=True)
    phone_number = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name or self.user.username

# Project (Survey Job)
class Project(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('archived', 'Archived'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    client_name = models.CharField(max_length=255, null=True, blank=True)
    client_email = models.EmailField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    location_name = models.CharField(max_length=255, null=True, blank=True)
    total_area_ha = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

# Parent Parcel
class Parcel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='parcels')
    name = models.CharField(max_length=255, default='Parent Parcel')
    coordinates = models.JSONField()  # Array of {lat, lng}
    crs = models.CharField(max_length=50, default='EPSG:4326')
    area_sqm = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    perimeter_m = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    centroid = models.JSONField(null=True, blank=True)  # {lat, lng}
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} (Project: {self.project.name})"

# Subdivision Configuration
class Subdivision(models.Model):
    STRATEGY_CHOICES = [
        ('auto_fit', 'Auto Fit'),
        ('fixed_count', 'Fixed Count'),
        ('equal_resize', 'Equal Resize'),
        ('extract_full', 'Extract Full'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name='subdivisions')
    plot_width = models.DecimalField(max_digits=10, decimal_places=4)
    plot_depth = models.DecimalField(max_digits=10, decimal_places=4)
    target_plot_count = models.IntegerField(null=True, blank=True)
    strategy = models.CharField(max_length=20, choices=STRATEGY_CHOICES, default='auto_fit')
    orientation_degrees = models.DecimalField(max_digits=8, decimal_places=4, default=0.0)
    road_setback_m = models.DecimalField(max_digits=10, decimal_places=4, default=0.0)
    side_setback_m = models.DecimalField(max_digits=10, decimal_places=4, default=0.0)
    notes = models.TextField(null=True, blank=True)
    ai_suggestions = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Subdivision {self.id} for Parcel {self.parcel.name}"

# Generated Plot
class Plot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subdivision = models.ForeignKey(Subdivision, on_delete=models.CASCADE, related_name='plots', null=True, blank=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='plots', null=True, blank=True)
    plot_number = models.IntegerField()
    coordinates = models.JSONField()  # Array of {lat, lng}
    area_sqm = models.DecimalField(max_digits=18, decimal_places=4)
    width_m = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    depth_m = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    is_partial = models.BooleanField(default=False)
    status = models.CharField(max_length=50, default='valid')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Plot {self.plot_number} (Status: {self.status})"

# Beacon (Corner Coordinates)
class Beacon(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plot = models.ForeignKey(Plot, on_delete=models.CASCADE, related_name='beacons')
    beacon_number = models.IntegerField()
    latitude = models.DecimalField(max_digits=12, decimal_places=9)
    longitude = models.DecimalField(max_digits=12, decimal_places=9)
    easting = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    northing = models.DecimalField(max_digits=18, decimal_places=4, null=True, blank=True)
    description = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"Beacon {self.beacon_number} for Plot {self.plot.plot_number}"

# Exported files
class Export(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='exports')
    export_type = models.CharField(max_length=50)  # e.g., 'pdf', 'csv', 'dxf', 'geojson', 'kml'
    file_url = models.CharField(max_length=500, null=True, blank=True)
    file_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Export {self.file_name} ({self.export_type})"

# Activity Audit Logs
class ActivityLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='activity_logs')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activity_logs')
    action_type = models.CharField(max_length=100)
    action_label = models.CharField(max_length=255)
    details = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Activity {self.action_type} for project {self.project.name} by {self.user.username}"


# Signals for automatic profile creation/saving
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()

