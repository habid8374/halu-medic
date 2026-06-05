"""
Catálogos nacionales compartidos por todos los consultorios.

CodigoCUPS — Homologador CUPS → REPS (Resolución 2775/948 de 2026).
Vive en el schema público (SHARED_APPS): es un estándar nacional, idéntico
para todos los tenants, por lo que se almacena una sola vez.
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
