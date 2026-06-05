import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('consultas', '0002_consulta_medico_nullable'),
    ]

    operations = [
        migrations.AddField(
            model_name='consulta',
            name='via_ingreso',
            field=models.CharField(
                max_length=1,
                choices=[
                    ('1', 'Urgencias'),
                    ('2', 'Consulta externa'),
                    ('3', 'Remitido'),
                    ('4', 'Nacimiento'),
                    ('5', 'Electiva/Programada'),
                ],
                default='2',
                help_text='Vía de ingreso al servicio de salud',
            ),
        ),
        migrations.CreateModel(
            name='OrdenMedica',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('consulta', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ordenes',
                    to='consultas.consulta',
                )),
                ('tipo', models.CharField(
                    max_length=15,
                    choices=[
                        ('lab', 'Laboratorio clínico'),
                        ('imagen', 'Imagen diagnóstica'),
                        ('interconsulta', 'Interconsulta / Remisión'),
                        ('medicamento', 'Medicamento'),
                        ('procedimiento', 'Procedimiento'),
                        ('otro', 'Otro'),
                    ],
                )),
                ('estado', models.CharField(
                    max_length=12,
                    choices=[
                        ('pendiente', 'Pendiente'),
                        ('ejecutada', 'Ejecutada'),
                        ('cancelada', 'Cancelada'),
                    ],
                    default='pendiente',
                )),
                ('cups', models.CharField(blank=True, max_length=10, help_text='CUPS si aplica')),
                ('cum', models.CharField(blank=True, max_length=20, help_text='CUM si es medicamento')),
                ('descripcion', models.CharField(max_length=300)),
                ('dosis', models.CharField(blank=True, max_length=100)),
                ('frecuencia', models.CharField(blank=True, max_length=100)),
                ('duracion', models.CharField(blank=True, max_length=100)),
                ('via_admin', models.CharField(blank=True, max_length=50, help_text='Vía de administración')),
                ('cie10', models.CharField(blank=True, max_length=10)),
                ('indicacion', models.TextField(blank=True, help_text='Indicación clínica / justificación')),
                ('genera_rips', models.BooleanField(default=False)),
                ('cantidad', models.PositiveIntegerField(default=1)),
                ('valor_unitario', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('vigencia_dias', models.PositiveSmallIntegerField(default=30, help_text='Vigencia de la orden en días')),
                ('observaciones', models.TextField(blank=True)),
            ],
            options={
                'ordering': ['-creado_en'],
            },
        ),
    ]
