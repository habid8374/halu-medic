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

    # RIPS mandatory fields per Res. 948/2026
    MODALIDAD_CHOICES = [
        ('01', '01 - Intramural'),
        ('02', '02 - Extramural'),
        ('03', '03 - Unidad Móvil'),
        ('04', '04 - Domiciliaria'),
        ('05', '05 - Telemedicina interactiva'),
        ('06', '06 - Telemedicina no interactiva'),
        ('07', '07 - Telexperticia'),
    ]
    GRUPO_SERVICIOS_RIPS_CHOICES = [
        ('01', '01 - Consulta externa'),
        ('02', '02 - Urgencias'),
        ('03', '03 - Hospitalización'),
        ('04', '04 - Cirugía'),
        ('05', '05 - Procedimientos'),
        ('06', '06 - Apoyo diagnóstico y terapéutico'),
        ('07', '07 - Otros servicios de salud'),
    ]
    FINALIDAD_CHOICES = [
        ('10', '10 - Diagnóstico'),
        ('11', '11 - Terapéutico'),
        ('12', '12 - Rehabilitación'),
        ('13', '13 - Diagnóstico y terapéutico'),
        ('14', '14 - Detección de enfermedad'),
        ('15', '15 - Protección específica'),
        ('16', '16 - Información en salud'),
        ('17', '17 - Educación en salud'),
        ('18', '18 - Paliativo'),
        ('19', '19 - Complementario'),
    ]
    VIA_INGRESO_CHOICES = [
        ('1', '1 - Urgencias'),
        ('2', '2 - Consulta externa'),
        ('3', '3 - Remitido'),
        ('4', '4 - Nacimiento'),
        ('5', '5 - Electiva/Programada'),
    ]

    modalidad_rips       = models.CharField(max_length=2, blank=True, choices=MODALIDAD_CHOICES,
                                             help_text='Modalidad grupo servicio RIPS')
    grupo_servicios_rips = models.CharField(max_length=2, blank=True, choices=GRUPO_SERVICIOS_RIPS_CHOICES,
                                             help_text='Grupo servicios RIPS')
    finalidad_rips       = models.CharField(max_length=2, blank=True, choices=FINALIDAD_CHOICES,
                                             help_text='Finalidad tecnología salud')
    via_ingreso_rips     = models.CharField(max_length=1, blank=True, choices=VIA_INGRESO_CHOICES,
                                             help_text='Vía ingreso por defecto')
    cod_servicio_rips    = models.CharField(max_length=5, blank=True,
                                             help_text='Código servicio REPS habilitado')
    personal_atiende     = models.CharField(max_length=2, blank=True,
                                             help_text='01=Med esp, 02=Med gral, 03=Enf, 04=Otro')
    ambito_rips          = models.CharField(max_length=1, blank=True,
                                             help_text='1=Ambulatorio, 2=Hospitalario, 3=Urgencias')

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
