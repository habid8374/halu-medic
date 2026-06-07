"""
Agrega los CUPS que no están en el catálogo pero sí en el homologador RIPS.
Estos son códigos válidos per Res. 3374/2000 y Res. 948/2026.
"""
from django.core.management.base import BaseCommand
from apps.catalogos.models import CodigoCUPS


CUPS_FALTANTES = [
    # Odontología
    ('891102', 'Consulta de control o seguimiento odontológico', 'Odontología', 'Consulta externa', 'PBS', '', '02'),
    ('891103', 'Consulta de urgencias odontológica', 'Odontología', 'Urgencias', 'PBS', '', '02'),
    ('891104', 'Consulta de primera vez por odontología especializada', 'Odontología', 'Consulta externa', 'PBS', '', '02'),
    ('891105', 'Consulta de control o seguimiento por odontología especializada', 'Odontología', 'Consulta externa', 'PBS', '', '02'),
    # Electrocardiograma / Pruebas funcionales
    ('841000', 'Electrocardiograma', 'Cardiología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('841001', 'Monitoreo electrocardiográfico continuo (Holter)', 'Cardiología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('841100', 'Espirometría simple', 'Neumología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('841101', 'Espirometría con broncodilatador', 'Neumología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('841102', 'Prueba de esfuerzo (ergometría)', 'Cardiología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    # Ecografías urológicas / pélvicas
    ('881501', 'Ecografía de próstata transabdominal', 'Urología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('881502', 'Ecografía de próstata transrectal', 'Urología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('881503', 'Ecografía pélvica transvaginal', 'Ginecología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('881601', 'Ecografía de tejidos blandos en extremidades superiores', 'Radiología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    # Laboratorio clínico
    ('904200', 'Hemograma tipo IV (cuadro hemático automatizado)', 'Laboratorio', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('904211', 'Glucosa post-carga (prueba tolerancia oral)', 'Laboratorio', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('904214', 'Creatinina en suero', 'Laboratorio', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('904215', 'Nitrógeno ureico (BUN)', 'Laboratorio', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('904221', 'Parcial de orina (uroanálisis)', 'Laboratorio', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    # Imágenes diagnósticas
    ('874000', 'Radiografía de tórax anteroposterior', 'Radiología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('874001', 'Radiografía de tórax anteroposterior y lateral', 'Radiología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('874100', 'Ecografía abdominal total', 'Radiología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('874101', 'Ecografía abdominal superior', 'Radiología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('874200', 'Mamografía bilateral', 'Radiología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    ('874201', 'Mamografía unilateral', 'Radiología', 'Apoyo diagnóstico y terapéutico', 'PBS', '', '07'),
    # Cirugías
    ('441300', 'Apendicectomía convencional (abierta)', 'Cirugía General', 'Cirugía', 'PBS', '', '04'),
    ('441301', 'Apendicectomía laparoscópica', 'Cirugía General', 'Cirugía', 'PBS', '', '04'),
    ('441302', 'Apendicectomía laparoscópica por incisión única', 'Cirugía General', 'Cirugía', 'PBS', '', '04'),
    ('531400', 'Colecistectomía laparoscópica', 'Cirugía General', 'Cirugía', 'PBS', '', '04'),
    ('531401', 'Reparación laparoscópica de hernia inguinal', 'Cirugía General', 'Cirugía', 'PBS', '', '04'),
    # Hospitalización neonatal
    ('890705', 'Estancia neonatal (recién nacido)', 'Pediatría', 'Hospitalización', 'PBS', '', '03'),
]

RIPS_POR_GRUPO = {
    '02': {'modalidad_rips': '01', 'grupo_servicios_rips': '01', 'finalidad_rips': '10', 'via_ingreso_rips': '2', 'cod_servicio_rips': '1', 'personal_atiende': '05', 'ambito_rips': '1'},
    '07': {'modalidad_rips': '01', 'grupo_servicios_rips': '07', 'finalidad_rips': '10', 'via_ingreso_rips': '2', 'cod_servicio_rips': '1', 'personal_atiende': '09', 'ambito_rips': '1'},
    '04': {'modalidad_rips': '01', 'grupo_servicios_rips': '04', 'finalidad_rips': '11', 'via_ingreso_rips': '5', 'cod_servicio_rips': '1', 'personal_atiende': '01', 'ambito_rips': '2'},
    '03': {'modalidad_rips': '01', 'grupo_servicios_rips': '06', 'finalidad_rips': '11', 'via_ingreso_rips': '4', 'cod_servicio_rips': '1', 'personal_atiende': '01', 'ambito_rips': '2'},
}

# Override specific codes
RIPS_OVERRIDES = {
    '891103': {'modalidad_rips': '01', 'grupo_servicios_rips': '02', 'finalidad_rips': '10', 'via_ingreso_rips': '1', 'cod_servicio_rips': '1', 'personal_atiende': '05', 'ambito_rips': '3'},
}


class Command(BaseCommand):
    help = 'Agrega CUPS faltantes al catálogo público'

    def handle(self, *args, **options):
        creados = 0
        existentes = 0
        for codigo, descripcion, nombre_servicio, grupo_servicio, cobertura, codigo_reps, grupo_rips in CUPS_FALTANTES:
            rips = RIPS_OVERRIDES.get(codigo, RIPS_POR_GRUPO.get(grupo_rips, {}))
            obj, created = CodigoCUPS.objects.get_or_create(
                codigo=codigo,
                defaults={
                    'descripcion': descripcion,
                    'nombre_servicio': nombre_servicio,
                    'grupo_servicio': grupo_servicio,
                    'cobertura': cobertura,
                    'codigo_reps': codigo_reps,
                    'grupo_rips': grupo_rips,
                    **rips,
                }
            )
            if created:
                creados += 1
                self.stdout.write(f'  + {codigo} — {descripcion}')
            else:
                existentes += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nFinalizado: {creados} creados, {existentes} ya existían.'
        ))
