"""
URLs públicas (schema 'public') — SaaS landing y gestión de tenants
"""
from django.contrib import admin
from django.urls import path

urlpatterns = [
    path('admin/', admin.site.urls),
    # Aquí irán: registro de consultorio, planes, pagos Wompi/PSE
]
