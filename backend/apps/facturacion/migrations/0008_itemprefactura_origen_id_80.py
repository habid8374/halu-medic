from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('facturacion', '0007_factura_medio_pago'),
    ]

    operations = [
        migrations.AlterField(
            model_name='itemprefactura',
            name='origen_id',
            field=models.CharField(blank=True, help_text='UUID del objeto origen', max_length=80),
        ),
    ]
