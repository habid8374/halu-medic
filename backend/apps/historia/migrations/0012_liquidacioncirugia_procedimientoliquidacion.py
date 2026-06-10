from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('historia', '0011_quirofano'),
    ]

    operations = [
        migrations.CreateModel(
            name='LiquidacionCirugia',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('tipo_tarifario', models.CharField(choices=[('ISS_2001', 'ISS 2001'), ('ISS_2004', 'ISS 2004'), ('SOAT', 'SOAT')], default='ISS_2001', max_length=10)),
                ('tipo_liquidacion', models.CharField(choices=[('bilateral', 'Bilateral'), ('misma_via', 'Mismo especialista – Misma v\xeda'), ('diferente_via', 'Mismo especialista – Diferente v\xeda'), ('multiple_misma_a', 'M\xfaltiple especialista – Misma v\xeda (Cirujano A)'), ('multiple_misma_b', 'M\xfaltiple especialista – Misma v\xeda (Cirujano B)'), ('multiple_diferente_a', 'M\xfaltiple especialista – Diferente v\xeda (Cirujano A)'), ('multiple_diferente_b', 'M\xfaltiple especialista – Diferente v\xeda (Cirujano B)')], default='misma_via', max_length=25)),
                ('estado', models.CharField(choices=[('borrador', 'Borrador'), ('finalizada', 'Finalizada'), ('facturada', 'Facturada')], default='borrador', max_length=15)),
                ('observaciones', models.TextField(blank=True)),
                ('total_cirujano', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('total_anestesiologo', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('total_ayudante', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('total_quirofano', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('total_materiales', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('total_general', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('descripcion_qx', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='liquidacion', to='historia.descripcionquirurgica')),
                ('ingreso', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='liquidaciones_cx', to='historia.ingreso')),
            ],
            options={'verbose_name': 'Liquidaci\xf3n de cirug\xeda', 'verbose_name_plural': 'Liquidaciones de cirug\xeda', 'ordering': ['-creado_en']},
        ),
        migrations.CreateModel(
            name='ProcedimientoLiquidacion',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('orden', models.PositiveSmallIntegerField(help_text='1=mayor UVR, 2, 3...')),
                ('cups', models.CharField(max_length=15)),
                ('descripcion', models.CharField(blank=True, max_length=300)),
                ('valor_base', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('pct_cirujano', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('pct_anestesiologo', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('pct_ayudante', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('pct_quirofano', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('pct_materiales', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('valor_cirujano', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('valor_anestesiologo', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('valor_ayudante', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('valor_quirofano', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('valor_materiales', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('subtotal', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('liquidacion', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='procedimientos', to='historia.liquidacioncirugia')),
            ],
            options={'ordering': ['orden']},
        ),
        migrations.AddConstraint(
            model_name='procedimientoliquidacion',
            constraint=models.UniqueConstraint(fields=['liquidacion', 'orden'], name='unique_liquidacion_orden'),
        ),
    ]
