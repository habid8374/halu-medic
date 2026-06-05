"""
Catálogos nacionales compartidos por todos los consultorios.

CodigoCUPS — Homologador CUPS → REPS (Resolución 2775/948 de 2026).
CodigoCIE10 — Clasificación Internacional de Enfermedades 10.ª revisión.
Ambos viven en el schema público (SHARED_APPS): estándar nacional,
idéntico para todos los tenants.
"""
from django.db import models


class CodigoCUPS(models.Model):
    """Código Único de Procedimientos en Salud con su homologación a REPS."""
    codigo            = models.CharField(max_length=10, primary_key=True,
                                         help_text='Código CUPS')
    descripcion       = models.CharField(max_length=400,
                                         help_text='Descripción del servicio o procedimiento')
    nombre_servicio   = models.CharField(max_length=200, blank=True,
                                         help_text='Nombre del servicio / especialidad')
    grupo_servicio    = models.CharField(max_length=120, blank=True,
                                         help_text='Grupo de servicio (Quirúrgicos, Consulta, etc.)')
    cobertura         = models.CharField(max_length=20, blank=True,
                                         help_text='PBS / NO PBS')
    codigo_reps       = models.CharField(max_length=20, blank=True,
                                         help_text='Código de servicio REPS homologado')
    grupo_rips        = models.CharField(max_length=10, blank=True,
                                         help_text='GrupoServicios_RIPS')

    class Meta:
        ordering = ['codigo']
        verbose_name = 'Código CUPS'
        verbose_name_plural = 'Códigos CUPS'
        indexes = [
            models.Index(fields=['descripcion']),
            models.Index(fields=['grupo_servicio']),
        ]

    def __str__(self):
        return f'{self.codigo} — {self.descripcion}'


class CodigoCIE10(models.Model):
    """Diagnóstico CIE-10 (Clasificación Internacional de Enfermedades, 10.ª rev.)."""

    SEXO_CHOICES = [
        ('A', 'Ambos'),
        ('M', 'Masculino'),
        ('F', 'Femenino'),
    ]

    codigo           = models.CharField(max_length=10, primary_key=True,
                                        help_text='Código CIE-10 (ej. A000, J189)')
    nombre           = models.CharField(max_length=400,
                                        help_text='Nombre / descripción específica')
    descripcion      = models.CharField(max_length=300, blank=True,
                                        help_text='Categoría diagnóstica')
    capitulo_codigo  = models.CharField(max_length=10, blank=True,
                                        help_text='Código de capítulo (ej. A00)')
    capitulo_desc    = models.CharField(max_length=200, blank=True,
                                        help_text='Descripción del capítulo')
    habilitado       = models.BooleanField(default=True)
    sexo             = models.CharField(max_length=1, choices=SEXO_CHOICES, default='A',
                                        help_text='Restricción de sexo: A Ambos, M Masculino, F Femenino')
    edad_minima      = models.PositiveSmallIntegerField(default=0)
    edad_maxima      = models.PositiveSmallIntegerField(default=999)

    class Meta:
        ordering = ['codigo']
        verbose_name = 'Código CIE-10'
        verbose_name_plural = 'Códigos CIE-10'
        indexes = [
            models.Index(fields=['nombre']),
            models.Index(fields=['capitulo_codigo']),
        ]

    def __str__(self):
        return f'{self.codigo} — {self.nombre}'
