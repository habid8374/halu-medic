"""
Crea las 16 filas de grupos quirúrgicos SOAT (2-13 y especiales 20-23)
con valores en 0 para que la IPS cargue los SMDLV del manual oficial
(Decreto 2423/1996 actualizado) desde el admin o la pantalla de tarifas.
"""
from django.db import migrations


def crear_grupos(apps, schema_editor):
    Grupo = apps.get_model('tarifas', 'GrupoQuirurgicoSOAT')
    for g in list(range(2, 14)) + [20, 21, 22, 23]:
        Grupo.objects.get_or_create(grupo=g)


def eliminar_grupos(apps, schema_editor):
    apps.get_model('tarifas', 'GrupoQuirurgicoSOAT').objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('tarifas', '0006_grupoquirurgicosoat'),
    ]
    operations = [
        migrations.RunPython(crear_grupos, eliminar_grupos),
    ]
