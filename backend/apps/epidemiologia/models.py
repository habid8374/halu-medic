"""Módulo Epidemiología — Notificación SIVIGILA (Decreto 3518/2006)"""
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()

EVENTOS_SIVIGILA = [
    ('dengue', 'Dengue'),
    ('malaria', 'Malaria'),
    ('tuberculosis', 'Tuberculosis'),
    ('vih_sida', 'VIH/SIDA'),
    ('hepatitis_a', 'Hepatitis A'),
    ('hepatitis_b', 'Hepatitis B'),
    ('hepatitis_c', 'Hepatitis C'),
    ('leptospirosis', 'Leptospirosis'),
    ('leishmaniasis', 'Leishmaniasis'),
    ('chagas', 'Enfermedad de Chagas'),
    ('rabia', 'Rabia'),
    ('influenza', 'Influenza/Gripe'),
    ('covid19', 'COVID-19'),
    ('varicela', 'Varicela'),
    ('sarampion', 'Sarampión'),
    ('rubeola', 'Rubéola'),
    ('parotiditis', 'Parotiditis'),
    ('tosferina', 'Tosferina'),
    ('tetanos', 'Tétanos'),
    ('meningitis', 'Meningitis bacteriana'),
    ('sifilis', 'Sífilis congénita/gestacional'),
    ('gonorrea', 'Gonorrea'),
    ('ira', 'IRA/Neumonía'),
    ('eda', 'EDA/Diarrea'),
    ('intoxicacion', 'Intoxicación alimentaria/química'),
    ('violencia', 'Violencia/Maltrato'),
    ('accidente_laboral', 'Accidente laboral'),
    ('otro', 'Otro evento de notificación obligatoria'),
]


class NotificacionSIVIGILA(models.Model):
    TIPO_NOTIF_CHOICES = [
        ('inmediata', 'Inmediata (< 24h)'),
        ('semanal', 'Semanal'),
        ('periodo', 'Por período'),
    ]
    ESTADO_CHOICES = [
        ('borrador', 'Borrador'),
        ('notificada', 'Notificada al SIVIGILA'),
        ('confirmada', 'Confirmada'),
        ('descartada', 'Descartada'),
    ]
    CLASIFICACION_CHOICES = [
        ('sospechoso', 'Caso sospechoso'),
        ('probable', 'Caso probable'),
        ('confirmado', 'Caso confirmado'),
        ('descartado', 'Descartado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente = models.ForeignKey(
        'pacientes.Paciente', on_delete=models.PROTECT,
        related_name='notificaciones_sivigila',
    )
    evento = models.CharField(max_length=30, choices=EVENTOS_SIVIGILA)
    codigo_sivigila = models.CharField(max_length=10, blank=True, help_text='Código del evento en SIVIGILA')
    clasificacion = models.CharField(max_length=15, choices=CLASIFICACION_CHOICES, default='sospechoso')
    tipo_notificacion = models.CharField(max_length=15, choices=TIPO_NOTIF_CHOICES, default='semanal')
    fecha_inicio_sintomas = models.DateField(null=True, blank=True)
    fecha_consulta = models.DateField()
    fecha_notificacion = models.DateField(null=True, blank=True)
    semana_epidemiologica = models.PositiveSmallIntegerField(null=True, blank=True)
    municipio_residencia = models.CharField(max_length=10, blank=True, help_text='Código DANE municipio')
    municipio_ocurrencia = models.CharField(max_length=10, blank=True)
    hospitalizado = models.BooleanField(default=False)
    fallecio = models.BooleanField(default=False)
    fuente_infeccion = models.TextField(blank=True)
    datos_complementarios = models.JSONField(
        default=dict, blank=True,
        help_text='Campos específicos del evento',
    )
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='borrador')
    notificado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='notificaciones_sivigila',
    )
    numero_sivigila = models.CharField(max_length=30, blank=True, help_text='Número asignado por SIVIGILA')
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_consulta']
        verbose_name = 'Notificación SIVIGILA'
        verbose_name_plural = 'Notificaciones SIVIGILA'
        indexes = [
            models.Index(fields=['evento', 'estado']),
            models.Index(fields=['semana_epidemiologica']),
        ]

    def __str__(self):
        return f'{self.get_evento_display()} — {self.paciente} — {self.fecha_consulta}'


class BrotEpidemico(models.Model):
    ESTADO_CHOICES = [
        ('activo', 'Activo'),
        ('controlado', 'Controlado'),
        ('cerrado', 'Cerrado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    evento = models.CharField(max_length=30, choices=EVENTOS_SIVIGILA)
    descripcion = models.TextField()
    fecha_inicio = models.DateField()
    fecha_control = models.DateField(null=True, blank=True)
    numero_casos = models.PositiveIntegerField(default=0)
    numero_fallecidos = models.PositiveIntegerField(default=0)
    municipio = models.CharField(max_length=200, blank=True)
    medidas_control = models.TextField(blank=True)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='activo')
    responsable = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='brotes_epidemicos',
    )
    notificaciones = models.ManyToManyField(
        NotificacionSIVIGILA, blank=True, related_name='brotes',
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_inicio']
        verbose_name = 'Brote epidémico'

    def __str__(self):
        return f'Brote {self.get_evento_display()} — {self.fecha_inicio}'
