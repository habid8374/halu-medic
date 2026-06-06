"""Módulo Laboratorio Clínico"""
from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class PanelLaboratorio(models.Model):
    """Panel o perfil de laboratorio (ej: hemograma, perfil hepático)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=200)
    cups = models.CharField(max_length=10, blank=True)
    categoria = models.CharField(max_length=100, blank=True, help_text='Hematología, Química, Microbiología, etc.')
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Panel de laboratorio'

    def __str__(self):
        return self.nombre


class SolicitudLaboratorio(models.Model):
    ESTADO_CHOICES = [
        ('solicitada', 'Solicitada'),
        ('tomada',     'Muestra tomada'),
        ('proceso',    'En proceso'),
        ('resultado',  'Con resultado'),
        ('cancelada',  'Cancelada'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    paciente = models.ForeignKey('pacientes.Paciente', on_delete=models.PROTECT, related_name='solicitudes_lab')
    ingreso = models.ForeignKey('historia.Ingreso', on_delete=models.SET_NULL, null=True, blank=True, related_name='solicitudes_lab')
    medico_solicitante = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='solicitudes_lab'
    )
    urgente = models.BooleanField(default=False)
    examenes = models.JSONField(default=list, help_text='[{cups, nombre, indicacion}]')
    indicacion_clinica = models.TextField(blank=True)
    diagnostico_cie10 = models.CharField(max_length=10, blank=True)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default='solicitada')
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_toma_muestra = models.DateTimeField(null=True, blank=True)
    tomado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='muestras_tomadas'
    )
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ['-fecha_solicitud']
        verbose_name = 'Solicitud laboratorio'

    def __str__(self):
        return f'Lab {self.id} — {self.paciente}'


class ResultadoLaboratorio(models.Model):
    """Resultado individual de un examen dentro de la solicitud."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitud = models.ForeignKey(SolicitudLaboratorio, on_delete=models.CASCADE, related_name='resultados')
    cups = models.CharField(max_length=10, blank=True)
    nombre_examen = models.CharField(max_length=200)
    valor = models.CharField(max_length=100, help_text='Valor del resultado como texto')
    unidad = models.CharField(max_length=50, blank=True)
    valor_referencia_min = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    valor_referencia_max = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    valor_referencia_texto = models.CharField(max_length=200, blank=True, help_text='Para resultados cualitativos')
    estado_resultado = models.CharField(
        max_length=10,
        choices=[
            ('N', 'Normal'), ('A', 'Alto'), ('B', 'Bajo'),
            ('C', 'Crítico'), ('P', 'Positivo'), ('N2', 'Negativo'),
        ],
        blank=True,
    )
    interpretacion = models.TextField(blank=True)
    metodo = models.CharField(max_length=100, blank=True)
    equipo = models.CharField(max_length=100, blank=True)
    laboratorista = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resultados_lab'
    )
    fecha_resultado = models.DateTimeField()
    validado = models.BooleanField(default=False)
    validado_por = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resultados_validados'
    )

    class Meta:
        ordering = ['nombre_examen']
        verbose_name = 'Resultado laboratorio'

    def __str__(self):
        return f'{self.nombre_examen}: {self.valor} {self.unidad}'
