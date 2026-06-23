"""
Admin de Consultorios (tenants) — schema público.
Al crear un nuevo Consultorio desde el admin se provisiona automáticamente:
  - Schema PostgreSQL propio (django-tenants auto_create_schema)
  - Usuario administrador inicial del consultorio
  - Suscripción activa según el plan elegido
"""
from django import forms
from django.contrib import admin, messages
from django.utils import timezone
from datetime import timedelta

from apps.tenants.models import Consultorio, Dominio


# ── Formulario extendido para creación ───────────────────────────────────────

class ConsultorioCrearForm(forms.ModelForm):
    """Formulario usado SOLO al crear (no al editar)."""

    admin_nombre   = forms.CharField(label='Nombre del administrador', max_length=100)
    admin_apellido = forms.CharField(label='Apellido del administrador', max_length=100,
                                     required=False)
    admin_cedula   = forms.CharField(label='Cédula del administrador', max_length=20)
    admin_email    = forms.EmailField(label='Email del administrador')
    admin_username = forms.CharField(label='Usuario (login)', max_length=150)
    admin_password = forms.CharField(label='Contraseña inicial', widget=forms.PasswordInput,
                                     min_length=8)

    dias_suscripcion = forms.IntegerField(
        label='Días de suscripción', initial=365,
        help_text='Número de días que tendrá activa la suscripción desde hoy.',
    )

    class Meta:
        model  = Consultorio
        fields = [
            'schema_name', 'nombre', 'nit', 'razon_social',
            'codigo_prestador', 'direccion', 'municipio_codigo',
            'telefono', 'email', 'plan', 'activo',
        ]

    def clean_schema_name(self):
        v = self.cleaned_data['schema_name'].lower().replace('-', '_')
        if not v.replace('_', '').isalnum():
            raise forms.ValidationError(
                'Solo letras minúsculas, números y guiones bajos. Sin espacios ni caracteres especiales.'
            )
        if v in ('public', 'demo'):
            raise forms.ValidationError('Los nombres "public" y "demo" están reservados.')
        if Consultorio.objects.filter(schema_name=v).exists():
            raise forms.ValidationError('Ya existe un consultorio con ese schema.')
        return v

    def clean_nit(self):
        v = self.cleaned_data['nit']
        if Consultorio.objects.filter(nit=v).exists():
            raise forms.ValidationError('Ya existe un consultorio con ese NIT.')
        return v


class ConsultorioEditarForm(forms.ModelForm):
    """Formulario para edición — sin campos de usuario."""
    class Meta:
        model  = Consultorio
        fields = '__all__'


# ── Inline de Dominios ────────────────────────────────────────────────────────

class DominioInline(admin.TabularInline):
    model  = Dominio
    extra  = 1
    fields = ['domain', 'is_primary']


# ── Admin principal ───────────────────────────────────────────────────────────

@admin.register(Consultorio)
class ConsultorioAdmin(admin.ModelAdmin):
    list_display   = ['nombre', 'nit', 'schema_name', 'plan', 'activo',
                      'dominio_principal', 'suscripcion_hasta']
    list_filter    = ['plan', 'activo']
    search_fields  = ['nombre', 'nit', 'schema_name', 'codigo_prestador']
    inlines        = [DominioInline]
    readonly_fields = ['creado_en', 'actualizado_en', 'factus_configurado']

    fieldsets = (
        ('Identificación de la IPS', {
            'fields': (
                'schema_name', 'nombre', 'nit', 'razon_social',
                'codigo_prestador', 'direccion', 'municipio_codigo',
                'telefono', 'email',
            ),
        }),
        ('Plan SaaS', {
            'fields': ('plan', 'activo', 'fecha_vencimiento'),
        }),
        ('Datos IPS adicionales', {
            'fields': (
                'regimen', 'nivel_atencion', 'representante_legal',
                'departamento', 'sitio_web', 'logo_url',
                'firma_factura_nombre', 'firma_factura_cargo', 'regimen_tributario',
            ),
            'classes': ('collapse',),
        }),
        ('Facturación electrónica Factus', {
            'fields': (
                'factus_configurado', 'factus_base_url', 'factus_client_id',
                'factus_client_secret', 'factus_username', 'factus_password',
                'factus_rango_numeracion_id',
            ),
            'classes': ('collapse',),
            'description': 'Cada IPS configura sus propias credenciales Factus ante la DIAN.',
        }),
        ('Resolución DIAN y numeración', {
            'fields': (
                'resolucion_dian', 'resolucion_fecha', 'factura_prefijo',
                'factura_rango_desde', 'factura_rango_hasta', 'factura_leyenda',
            ),
            'classes': ('collapse',),
        }),
        ('Auditoría', {
            'fields': ('creado_en', 'actualizado_en'),
            'classes': ('collapse',),
        }),
    )

    # ── Formularios diferenciados (crear vs editar) ───────────────────────────

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            # Creación: formulario extendido con datos del admin
            kwargs['form'] = ConsultorioCrearForm
            # Agregar sección "Administrador inicial" al fieldsets temporal
            return super().get_form(request, obj, **kwargs)
        kwargs['form'] = ConsultorioEditarForm
        return super().get_form(request, obj, **kwargs)

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            # Creación — incluir sección de administrador inicial
            return (
                ('Identificación de la IPS', {
                    'fields': (
                        'schema_name', 'nombre', 'nit', 'razon_social',
                        'codigo_prestador', 'direccion', 'municipio_codigo',
                        'telefono', 'email',
                    ),
                }),
                ('Plan SaaS', {
                    'fields': ('plan', 'activo', 'dias_suscripcion'),
                }),
                ('Administrador inicial del consultorio', {
                    'description': (
                        'Se creará un usuario con rol Administrador dentro del schema '
                        'de esta IPS. Podrá crear más usuarios desde el panel del consultorio.'
                    ),
                    'fields': (
                        'admin_nombre', 'admin_apellido', 'admin_cedula',
                        'admin_email', 'admin_username', 'admin_password',
                    ),
                }),
            )
        return super().get_fieldsets(request, obj)

    # ── Guardar con provisioning completo ─────────────────────────────────────

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)  # crea el schema automáticamente

        if change:
            return  # edición: no tocar usuario ni suscripción

        d = form.cleaned_data
        schema = obj.schema_name

        # ── Usuario admin en el nuevo schema ─────────────────────────────────
        try:
            from django_tenants.utils import schema_context
            from apps.usuarios.models import Usuario, Rol
            with schema_context(schema):
                admin_user = Usuario(
                    username      = d['admin_username'],
                    first_name    = d['admin_nombre'],
                    last_name     = d.get('admin_apellido', ''),
                    email         = d['admin_email'],
                    cedula        = d['admin_cedula'],
                    rol           = Rol.ADMIN,
                    activo_tenant = True,
                    is_staff      = False,
                    is_superuser  = False,
                )
                admin_user.set_password(d['admin_password'])
                admin_user.save()
            messages.success(
                request,
                f'✓ Usuario administrador "{d["admin_username"]}" creado en el schema {schema}.',
            )
        except Exception as exc:
            messages.warning(request, f'El consultorio fue creado pero hubo un error al crear el usuario admin: {exc}')

        # ── Suscripción activa ────────────────────────────────────────────────
        try:
            from apps.suscripciones.models import Suscripcion, EstadoSuscripcion
            dias = int(d.get('dias_suscripcion', 365))
            sus  = Suscripcion.objects.create(
                consultorio  = obj,
                estado       = EstadoSuscripcion.ACTIVA,
                fecha_inicio = timezone.now().date(),
                fecha_fin    = (timezone.now() + timedelta(days=dias)).date(),
                dias_gracia  = 7,
            )
            sus.aplicar_limites_plan()
            sus.save()
            messages.success(
                request,
                f'✓ Suscripción {obj.plan} activa por {dias} días creada.',
            )
        except Exception as exc:
            messages.warning(request, f'Consultorio creado pero error en suscripción: {exc}')

    # ── Columnas extras en la lista ───────────────────────────────────────────

    @admin.display(description='Dominio principal')
    def dominio_principal(self, obj):
        d = obj.get_primary_domain()
        return d.domain if d else '—'

    @admin.display(description='Suscripción hasta')
    def suscripcion_hasta(self, obj):
        try:
            return str(obj.suscripcion.fecha_fin)
        except Exception:
            return '—'


@admin.register(Dominio)
class DominioAdmin(admin.ModelAdmin):
    list_display  = ['domain', 'tenant', 'is_primary']
    search_fields = ['domain']
    list_filter   = ['is_primary']
