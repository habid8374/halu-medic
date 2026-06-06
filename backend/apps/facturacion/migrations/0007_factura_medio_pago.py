from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('facturacion', '0006_nota_credito_debito'),
    ]

    operations = [
        migrations.AddField(
            model_name='factura',
            name='medio_pago',
            field=models.CharField(
                choices=[
                    ('credito',       'Crédito (EPS/entidad)'),
                    ('efectivo',      'Efectivo'),
                    ('tarjeta',       'Tarjeta débito/crédito'),
                    ('transferencia', 'Transferencia bancaria'),
                    ('otro',          'Otro'),
                ],
                default='credito',
                help_text='Forma de pago; para particulares usar efectivo/tarjeta/transferencia',
                max_length=20,
            ),
        ),
    ]
