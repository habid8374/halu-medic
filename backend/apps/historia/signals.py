from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='historia.DescripcionQuirurgica')
def crear_liquidacion_automatica(sender, instance, created, **kwargs):
    """Al guardar una descripción quirúrgica, crea la liquidación si no existe."""
    from apps.historia.models import LiquidacionCirugia, ProcedimientoLiquidacion
    try:
        exists = LiquidacionCirugia.objects.filter(descripcion_qx=instance).exists()
        if not exists:
            liq = LiquidacionCirugia.objects.create(
                descripcion_qx=instance,
                ingreso=instance.ingreso,
            )
            if instance.cups_principal:
                from apps.tarifas.models import ManualTarifario
                valor = 0
                desc = instance.descripcion_procedimiento or ''
                tar = ManualTarifario.objects.filter(es_predeterminado=True).first()
                if tar:
                    item = tar.items.filter(cups=instance.cups_principal).first()
                    if item:
                        valor = float(item.valor_base)
                        desc = desc or item.descripcion
                proc = ProcedimientoLiquidacion(
                    liquidacion=liq, orden=1,
                    cups=instance.cups_principal,
                    descripcion=desc,
                    valor_base=valor,
                )
                proc.aplicar_porcentajes()
                proc.save()
                liq.calcular_totales()
    except Exception:
        pass  # No bloquear el guardado de la DQX
