from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('historia', '0010_remove_consentimientoinformado_firma_acompanante_imagen_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Quirofano',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('nombre', models.CharField(help_text='Ej: Quirófano 1, Sala CX-A', max_length=50)),
                ('tipo', models.CharField(choices=[('general', 'Quirófano General'), ('cardiaco', 'Cirugía Cardíaca'), ('laparos', 'Laparoscopía'), ('traumato', 'Traumatología'), ('oftalmo', 'Oftalmología'), ('endoscopia', 'Endoscopía'), ('urologia', 'Urología'), ('otro', 'Otro')], default='general', max_length=15)),
                ('estado', models.CharField(choices=[('disponible', 'Disponible'), ('en_uso', 'En uso'), ('limpieza', 'En limpieza'), ('mantenimiento', 'En mantenimiento')], default='disponible', max_length=15)),
                ('ubicacion', models.CharField(blank=True, help_text='Piso, ala, bloque', max_length=100)),
                ('numero', models.PositiveIntegerField(blank=True, help_text='Número identificador', null=True)),
                ('capacidad_personal', models.PositiveIntegerField(default=5)),
                ('tiene_rx', models.BooleanField(default=False, help_text='Rayos X intraoperatorio')),
                ('tiene_laparos', models.BooleanField(default=False, help_text='Torre de laparoscopía')),
                ('tiene_robot', models.BooleanField(default=False, help_text='Sistema robótico')),
                ('observaciones', models.TextField(blank=True)),
                ('activo', models.BooleanField(default=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Quirófano',
                'verbose_name_plural': 'Quirófanos',
                'ordering': ['nombre'],
            },
        ),
    ]
