from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("historia", "0008_rename_historia_triage_nivel_estado_idx_historia_tr_nivel_485332_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="consentimientoinformado",
            name="firma_imagen",
            field=models.TextField(blank=True, help_text="Firma digital en base64 PNG"),
        ),
        migrations.AddField(
            model_name="consentimientoinformado",
            name="firma_acompanante_imagen",
            field=models.TextField(blank=True),
        ),
    ]
