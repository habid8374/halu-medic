"""Admin de Django para el módulo de usuarios"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from apps.usuarios.models import Usuario, Rol


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display  = ['username', 'get_full_name', 'email', 'rol', 'activo_tenant', 'date_joined']
    list_filter   = ['rol', 'activo_tenant', 'is_active']
    search_fields = ['username', 'first_name', 'last_name', 'email']
    ordering      = ['first_name', 'last_name']

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Información personal', {'fields': ('first_name', 'last_name', 'email', 'telefono', 'avatar')}),
        ('Rol y acceso', {'fields': ('rol', 'activo_tenant')}),
        ('Permisos Django', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
                             'classes': ('collapse',)}),
        ('Fechas', {'fields': ('last_login', 'date_joined'), 'classes': ('collapse',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'first_name', 'last_name', 'email', 'rol', 'password1', 'password2'),
        }),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Superadmin ve todos; admin solo los de su nivel o menor
        if not request.user.es_superadmin:
            qs = qs.exclude(rol=Rol.SUPERADMIN)
        return qs

    def has_change_permission(self, request, obj=None):
        if obj and obj.es_superadmin and not request.user.es_superadmin:
            return False
        return super().has_change_permission(request, obj)
