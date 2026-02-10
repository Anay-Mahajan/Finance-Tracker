"""
URL configuration for finance_tracker project.
API-only backend for React frontend.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Django Allauth URLs (for OAuth)
    path('auth/', include('allauth.urls')),
    
    # API endpoints
    path('api/', include('finance_tracker.api_urls')),
]

# Serve media files in development (for receipt uploads)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
