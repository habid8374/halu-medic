from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0002_medico_profesional_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notificacion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(choices=[('cita', 'Cita próxima'), ('ingreso', 'Nuevo ingreso'), ('resultado', 'Resultado disponible'), ('turno', 'Turno asignado'), ('contrato', 'Contrato por vencer'), ('sistema', 'Sistema')], max_length=20)),
                ('titulo', models.CharField(max_length=200)),
                ('mensaje', models.TextField()),
                ('leida', models.BooleanField(default=False)),
                ('url', models.CharField(blank=True, max_length=300)),
                ('creada_en', models.DateTimeField(auto_now_add=True)),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notificaciones', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-creada_en'],
            },
        ),
    ]
