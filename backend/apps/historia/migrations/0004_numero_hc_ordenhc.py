from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('historia', '0003_medicamentohc'),
    ]

    operations = [
        migrations.AddField(
            model_name='historiaclinica',
            name='numero_hc',
            field=models.PositiveIntegerField(blank=True, editable=False, null=True),
        ),
        migrations.CreateModel(
            name='OrdenHC',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tipo', models.CharField(choices=[('procedimiento', 'Procedimiento'), ('cirugia', 'Cirugía'), ('consulta_especializada', 'Consulta especializada'), ('laboratorio', 'Laboratorio'), ('imagen', 'Imagen diagnóstica'), ('interconsulta', 'Interconsulta / Remisión'), ('otro', 'Otro')], default='procedimiento', max_length=25)),
                ('estado', models.CharField(choices=[('pendiente', 'Pendiente'), ('ejecutada', 'Ejecutada'), ('cancelada', 'Cancelada')], default='pendiente', max_length=12)),
                ('cups', models.CharField(blank=True, help_text='Código CUPS', max_length=10)),
                ('descripcion_cups', models.CharField(blank=True, max_length=300)),
                ('cie10_justificacion', models.CharField(blank=True, max_length=10)),
                ('desc_cie10', models.CharField(blank=True, max_length=300)),
                ('cantidad', models.PositiveIntegerField(default=1)),
                ('urgente', models.BooleanField(default=False)),
                ('indicacion', models.TextField(blank=True)),
                ('observaciones', models.TextField(blank=True)),
                ('vigencia_dias', models.PositiveSmallIntegerField(default=30)),
                ('genera_factura', models.BooleanField(default=False)),
                ('valor_unitario', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('historia', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ordenes', to='historia.historiaclinica')),
            ],
            options={'ordering': ['creado_en'], 'verbose_name': 'Orden HC', 'verbose_name_plural': 'Órdenes HC'},
        ),
    ]
