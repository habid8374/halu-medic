from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalogos', '0002_codigocie10'),
    ]

    operations = [
        migrations.AddField(
            model_name='codigocups',
            name='modalidad_rips',
            field=models.CharField(
                blank=True, max_length=2,
                choices=[
                    ('01', '01 - Intramural'),
                    ('02', '02 - Extramural'),
                    ('03', '03 - Unidad Móvil'),
                    ('04', '04 - Domiciliaria'),
                    ('05', '05 - Telemedicina interactiva'),
                    ('06', '06 - Telemedicina no interactiva'),
                    ('07', '07 - Telexperticia'),
                ],
                help_text='Modalidad grupo servicio RIPS',
            ),
        ),
        migrations.AddField(
            model_name='codigocups',
            name='grupo_servicios_rips',
            field=models.CharField(
                blank=True, max_length=2,
                choices=[
                    ('01', '01 - Consulta externa'),
                    ('02', '02 - Urgencias'),
                    ('03', '03 - Hospitalización'),
                    ('04', '04 - Cirugía'),
                    ('05', '05 - Procedimientos'),
                    ('06', '06 - Apoyo diagnóstico y terapéutico'),
                    ('07', '07 - Otros servicios de salud'),
                ],
                help_text='Grupo servicios RIPS',
            ),
        ),
        migrations.AddField(
            model_name='codigocups',
            name='finalidad_rips',
            field=models.CharField(
                blank=True, max_length=2,
                choices=[
                    ('10', '10 - Diagnóstico'),
                    ('11', '11 - Terapéutico'),
                    ('12', '12 - Rehabilitación'),
                    ('13', '13 - Diagnóstico y terapéutico'),
                    ('14', '14 - Detección de enfermedad'),
                    ('15', '15 - Protección específica'),
                    ('16', '16 - Información en salud'),
                    ('17', '17 - Educación en salud'),
                    ('18', '18 - Paliativo'),
                    ('19', '19 - Complementario'),
                ],
                help_text='Finalidad tecnología salud',
            ),
        ),
        migrations.AddField(
            model_name='codigocups',
            name='via_ingreso_rips',
            field=models.CharField(
                blank=True, max_length=1,
                choices=[
                    ('1', '1 - Urgencias'),
                    ('2', '2 - Consulta externa'),
                    ('3', '3 - Remitido'),
                    ('4', '4 - Nacimiento'),
                    ('5', '5 - Electiva/Programada'),
                ],
                help_text='Vía ingreso por defecto',
            ),
        ),
        migrations.AddField(
            model_name='codigocups',
            name='cod_servicio_rips',
            field=models.CharField(blank=True, max_length=5, help_text='Código servicio REPS habilitado'),
        ),
        migrations.AddField(
            model_name='codigocups',
            name='personal_atiende',
            field=models.CharField(blank=True, max_length=2,
                                   help_text='01=Med esp, 02=Med gral, 03=Enf, 04=Otro'),
        ),
        migrations.AddField(
            model_name='codigocups',
            name='ambito_rips',
            field=models.CharField(blank=True, max_length=1,
                                   help_text='1=Ambulatorio, 2=Hospitalario, 3=Urgencias'),
        ),
    ]
