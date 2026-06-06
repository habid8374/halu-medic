from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('facturacion', '0002_facturapgp'),
        ('historia', '0004_numero_hc_ordenhc'),
        ('consultas', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='factura',
            name='consulta',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='facturas',
                to='consultas.consulta',
            ),
        ),
        migrations.AddField(
            model_name='factura',
            name='historia',
            field=models.ForeignKey(
                blank=True,
                help_text='HC origen si se factura directamente desde HC',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='facturas',
                to='historia.historiaclinica',
            ),
        ),
    ]
