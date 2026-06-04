"""
Módulo de suscripciones SaaS
Controla planes, vencimientos y límites por consultorio.
"""
from django.db import models
from django.utils import timezone
import uuid


class EstadoSuscripcion(models.TextChoices):
    ACTIVA    = 'activa',    'Activa'
    VENCIDA   = 'vencida',   'Vencida'
    SUSPENDIDA = 'suspendida', 'Suspendida por impago'
    CANCELADA = 'cancelada', 'Cancelada'
    PRUEBA    = 'prueba',    'Período de prueba'


class Suscripcion(models.Model):
    """
    Suscripción SaaS de un consultorio.
    Vive en el schema público junto con Consultorio.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultorio  = models.OneToOneField(
        'tenants.Consultorio',
        on_delete=models.CASCADE,
        related_name='suscripcion',
    )
    plan         = models.CharField(
        max_length=20,
        choices=[('basico', 'Básico'), ('pro', 'Pro'), ('clinica', 'Clínica')],
        default='basico',
    )
    estado       = models.CharField(
        max_length=20,
        choices=EstadoSuscripcion.choices,
        default=EstadoSuscripcion.PRUEBA,
    )
    fecha_inicio = models.DateField(default=timezone.localdate)
    fecha_fin    = models.DateField(null=True, blank=True, help_text='Null = sin vencimiento (anual prepago)')
    dias_gracia  = models.PositiveSmallIntegerField(default=5, help_text='Días extra tras vencer antes de bloquear')

    # Límites del plan (se aplican en tiempo real)
    max_medicos          = models.PositiveSmallIntegerField(default=1)
    max_facturas_mes     = models.PositiveIntegerField(default=100, help_text='0 = ilimitado')

    # Referencia de pago externa (PSE / Wompi)
    referencia_pago      = models.CharField(max_length=100, blank=True)
    metodo_pago          = models.CharField(max_length=50, blank=True)

    creado_en            = models.DateTimeField(auto_now_add=True)
    actualizado_en       = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Suscripción'
        verbose_name_plural = 'Suscripciones'

    def __str__(self):
        return f'{self.consultorio.nombre} — {self.plan} ({self.estado})'

    # ── Helpers ──────────────────────────────────────────────────────────────

    @property
    def esta_activa(self) -> bool:
        """True si la suscripción permite operar (activa o en prueba dentro del plazo)."""
        if self.estado in (EstadoSuscripcion.CANCELADA, EstadoSuscripcion.SUSPENDIDA):
            return False
        if self.fecha_fin is None:
            return True
        limite = self.fecha_fin
        if self.dias_gracia:
            from datetime import timedelta
            limite = self.fecha_fin + timedelta(days=self.dias_gracia)
        return timezone.localdate() <= limite

    @property
    def dias_restantes(self) -> int | None:
        if self.fecha_fin is None:
            return None
        delta = self.fecha_fin - timezone.localdate()
        return delta.days

    def verificar_limite_medicos(self, medicos_actuales: int) -> bool:
        return medicos_actuales < self.max_medicos

    def verificar_limite_facturas(self, facturas_este_mes: int) -> bool:
        if self.max_facturas_mes == 0:
            return True
        return facturas_este_mes < self.max_facturas_mes

    # ── Valores por defecto por plan ─────────────────────────────────────────

    LIMITES_POR_PLAN = {
        'basico':  {'max_medicos': 1,         'max_facturas_mes': 100},
        'pro':     {'max_medicos': 5,         'max_facturas_mes': 0},
        'clinica': {'max_medicos': 9999,      'max_facturas_mes': 0},
    }

    def aplicar_limites_plan(self):
        limites = self.LIMITES_POR_PLAN.get(self.plan, {})
        self.max_medicos      = limites.get('max_medicos', 1)
        self.max_facturas_mes = limites.get('max_facturas_mes', 100)


class HistorialPago(models.Model):
    """Registro de cada pago recibido para una suscripción."""
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    suscripcion  = models.ForeignKey(Suscripcion, on_delete=models.CASCADE, related_name='pagos')
    monto        = models.DecimalField(max_digits=12, decimal_places=2)
    moneda       = models.CharField(max_length=3, default='COP')
    referencia   = models.CharField(max_length=100)
    metodo       = models.CharField(max_length=50, blank=True)
    estado       = models.CharField(
        max_length=20,
        choices=[('aprobado', 'Aprobado'), ('rechazado', 'Rechazado'), ('pendiente', 'Pendiente')],
        default='pendiente',
    )
    fecha        = models.DateTimeField(auto_now_add=True)
    meses_pagados = models.PositiveSmallIntegerField(default=1)
    respuesta_pasarela = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-fecha']
        verbose_name = 'Pago'
        verbose_name_plural = 'Pagos'

    def __str__(self):
        return f'{self.suscripcion.consultorio.nombre} — ${self.monto} ({self.estado})'
