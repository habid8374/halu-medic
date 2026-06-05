"""
Modelos del módulo Citas
Agenda médica por consultorio, médico y sala
"""
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class EstadoCita(models.TextChoices):
    PROGRAMADA  = 'programada',  'Programada'
    CONFIRMADA  = 'confirmada',  'Confirmada'
    EN_CURSO    = 'en_curso',    'En curso'
    ATENDIDA    = 'atendida',    'Atendida'
    CANCELADA   = 'cancelada',   'Cancelada'
    NO_ASISTIO  = 'no_asistio',  'No asistió'


class Especialidad(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre      = models.CharField(max_length=100)
    codigo_rips = models.CharField(max_length=10, blank=True, help_text='Código grupo servicios RIPS')

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


TIPO_DOC_MEDICO = [
    ('CC',  'Cédula de ciudadanía'),
    ('CE',  'Cédula de extranjería'),
    ('PA',  'Pasaporte'),
    ('NIT', 'NIT'),
]


class Medico(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario          = models.OneToOneField(User, on_delete=models.PROTECT, related_name='medico')
    registro_medico  = models.CharField(max_length=20, help_text='Número de registro médico (RETHUS)')
    # Documento de identidad — requerido en cada línea de RIPS (Res. 948/2026)
    tipo_identificacion   = models.CharField(max_length=5, choices=TIPO_DOC_MEDICO, default='CC',
                                              help_text='Tipo documento para RIPS')
    numero_identificacion = models.CharField(max_length=30, blank=True,
                                              help_text='Número documento para RIPS')
    especialidades   = models.ManyToManyField(Especialidad, blank=True)
    duracion_cita_min = models.PositiveIntegerField(default=20, help_text='Minutos por cita por defecto')
    activo           = models.BooleanField(default=True)

    class Meta:
        ordering = ['usuario__last_name']

    def __str__(self):
        return f'Dr(a). {self.usuario.get_full_name()} — {self.registro_medico}'


class Sala(models.Model):
    id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=50, help_text='Ej: Consultorio 1, Sala de procedimientos')
    activa = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class Cita(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente   = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT, related_name='citas')
    medico     = models.ForeignKey(Medico, on_delete=models.PROTECT, related_name='citas', null=True, blank=True)
    especialidad = models.ForeignKey(Especialidad, on_delete=models.SET_NULL, null=True, blank=True)
    sala       = models.ForeignKey(Sala, on_delete=models.SET_NULL, null=True, blank=True)

    fecha_hora_inicio = models.DateTimeField()
    fecha_hora_fin    = models.DateTimeField()
    estado     = models.CharField(max_length=20, choices=EstadoCita.choices, default=EstadoCita.PROGRAMADA)

    motivo_consulta   = models.TextField(blank=True)
    observaciones     = models.TextField(blank=True)

    # Relación con convenio (para saber qué tarifa aplica)
    convenio   = models.ForeignKey('tarifas.ConvenioEPS', on_delete=models.SET_NULL, null=True, blank=True)

    creado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='citas_creadas')
    creado_en  = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['fecha_hora_inicio']
        indexes = [
            models.Index(fields=['medico', 'fecha_hora_inicio']),
            models.Index(fields=['paciente', 'fecha_hora_inicio']),
        ]

    def __str__(self):
        return f'{self.paciente} — {self.medico} — {self.fecha_hora_inicio:%d/%m/%Y %H:%M}'

    @property
    def duracion_minutos(self):
        delta = self.fecha_hora_fin - self.fecha_hora_inicio
        return int(delta.total_seconds() / 60)
