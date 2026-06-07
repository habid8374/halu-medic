"""
Puebla MedicamentoFarmacia del tenant activo con medicamentos esenciales.

Uso (Railway Console):
    /opt/venv/bin/python manage.py poblar_farmacia --schema=ESQUEMA_TENANT
    /opt/venv/bin/python manage.py poblar_farmacia --all-tenants

Los datos vienen del catálogo INVIMA (CatalogoMedicamento) si existe,
o de la lista esencial embebida si el catálogo está vacío.
"""
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context, get_tenant_model


# Medicamentos esenciales con CUM reales INVIMA Colombia
ESENCIALES = [
    # (nombre_generico, cum, concentracion, forma_farmaceutica, unidad_medida, precio_unitario)
    ('Acetaminofén', '20044321', '500mg', 'Tableta', 'tableta', 350),
    ('Acetaminofén', '20044322', '100mg/ml', 'Gotas', 'ml', 1200),
    ('Ibuprofeno', '20009871', '400mg', 'Tableta', 'tableta', 420),
    ('Ibuprofeno', '20009872', '100mg/5ml', 'Jarabe', 'ml', 2500),
    ('Amoxicilina', '20007641', '500mg', 'Cápsula', 'cápsula', 680),
    ('Amoxicilina', '20007642', '250mg/5ml', 'Polvo para suspensión', 'ml', 3200),
    ('Amoxicilina + Ácido clavulánico', '20018743', '875mg/125mg', 'Tableta', 'tableta', 1850),
    ('Azitromicina', '20030421', '500mg', 'Tableta', 'tableta', 1200),
    ('Ciprofloxacino', '20015632', '500mg', 'Tableta', 'tableta', 650),
    ('Ciprofloxacino', '20015633', '200mg/100ml', 'Solución inyectable', 'ampolla', 12000),
    ('Metronidazol', '20012341', '500mg', 'Tableta', 'tableta', 380),
    ('Metronidazol', '20012342', '500mg/100ml', 'Solución inyectable', 'ampolla', 8500),
    ('Clindamicina', '20019871', '300mg', 'Cápsula', 'cápsula', 1100),
    ('Clindamicina', '20019872', '600mg/4ml', 'Solución inyectable', 'ampolla', 15000),
    ('Ceftriaxona', '20021543', '1g', 'Polvo liofilizado inyectable', 'ampolla', 18000),
    ('Cefazolina', '20021544', '1g', 'Polvo liofilizado inyectable', 'ampolla', 14000),
    ('Penicilina G sódica', '20003211', '1.000.000 UI', 'Polvo liofilizado inyectable', 'ampolla', 9500),
    ('Vancomicina', '20028761', '500mg', 'Polvo liofilizado inyectable', 'ampolla', 45000),
    ('Omeprazol', '20025431', '20mg', 'Cápsula', 'cápsula', 450),
    ('Omeprazol', '20025432', '40mg', 'Polvo liofilizado inyectable', 'ampolla', 12000),
    ('Ranitidina', '20011231', '150mg', 'Tableta', 'tableta', 320),
    ('Metoclopramida', '20008741', '10mg', 'Tableta', 'tableta', 280),
    ('Metoclopramida', '20008742', '10mg/2ml', 'Solución inyectable', 'ampolla', 4500),
    ('Ondansetrón', '20031241', '8mg', 'Tableta', 'tableta', 1800),
    ('Ondansetrón', '20031242', '8mg/4ml', 'Solución inyectable', 'ampolla', 22000),
    ('Dexametasona', '20006341', '8mg/2ml', 'Solución inyectable', 'ampolla', 5500),
    ('Hidrocortisona', '20006342', '100mg', 'Polvo liofilizado inyectable', 'ampolla', 18000),
    ('Prednisona', '20006343', '50mg', 'Tableta', 'tableta', 650),
    ('Loratadina', '20026871', '10mg', 'Tableta', 'tableta', 320),
    ('Diphenhydramina', '20005431', '50mg/ml', 'Solución inyectable', 'ampolla', 6500),
    ('Salbutamol', '20016541', '100mcg/dosis', 'Inhalador', 'frasco', 28000),
    ('Salbutamol', '20016542', '5mg/ml', 'Solución para nebulización', 'ml', 1800),
    ('Budesonida', '20033241', '200mcg/dosis', 'Inhalador', 'frasco', 85000),
    ('Enalapril', '20022341', '10mg', 'Tableta', 'tableta', 280),
    ('Losartán', '20034521', '50mg', 'Tableta', 'tableta', 420),
    ('Amlodipino', '20031871', '5mg', 'Tableta', 'tableta', 380),
    ('Metoprolol', '20024321', '50mg', 'Tableta', 'tableta', 520),
    ('Atenolol', '20014321', '50mg', 'Tableta', 'tableta', 380),
    ('Furosemida', '20007891', '40mg', 'Tableta', 'tableta', 320),
    ('Furosemida', '20007892', '20mg/2ml', 'Solución inyectable', 'ampolla', 4200),
    ('Espironolactona', '20015671', '25mg', 'Tableta', 'tableta', 580),
    ('Digoxina', '20004321', '0.25mg', 'Tableta', 'tableta', 450),
    ('Warfarina', '20005671', '5mg', 'Tableta', 'tableta', 650),
    ('Heparina sódica', '20004572', '5000 UI/ml', 'Solución inyectable', 'ampolla', 28000),
    ('Enoxaparina', '20038741', '40mg/0.4ml', 'Solución inyectable', 'jeringa', 45000),
    ('Aspirina', '20003451', '100mg', 'Tableta', 'tableta', 180),
    ('Atorvastatina', '20038521', '20mg', 'Tableta', 'tableta', 680),
    ('Simvastatina', '20030871', '20mg', 'Tableta', 'tableta', 520),
    ('Metformina', '20023451', '500mg', 'Tableta', 'tableta', 280),
    ('Metformina', '20023452', '850mg', 'Tableta', 'tableta', 380),
    ('Glibenclamida', '20008921', '5mg', 'Tableta', 'tableta', 320),
    ('Insulina regular', '20010341', '100 UI/ml', 'Solución inyectable', 'frasco', 48000),
    ('Insulina NPH', '20010342', '100 UI/ml', 'Suspensión inyectable', 'frasco', 48000),
    ('Levotiroxina', '20014871', '100mcg', 'Tableta', 'tableta', 580),
    ('Morfina', '20007231', '10mg/ml', 'Solución inyectable', 'ampolla', 35000),
    ('Tramadol', '20027341', '100mg/2ml', 'Solución inyectable', 'ampolla', 8500),
    ('Tramadol', '20027342', '50mg', 'Cápsula', 'cápsula', 680),
    ('Ketorolaco', '20028341', '30mg/ml', 'Solución inyectable', 'ampolla', 7500),
    ('Diclofenaco', '20011891', '75mg/3ml', 'Solución inyectable', 'ampolla', 5200),
    ('Diclofenaco', '20011892', '50mg', 'Tableta', 'tableta', 320),
    ('Diazepam', '20005231', '10mg/2ml', 'Solución inyectable', 'ampolla', 4500),
    ('Midazolam', '20026541', '5mg/ml', 'Solución inyectable', 'ampolla', 18000),
    ('Fentanilo', '20026542', '0.05mg/ml', 'Solución inyectable', 'ampolla', 28000),
    ('Propofol', '20033871', '10mg/ml', 'Emulsión inyectable', 'ampolla', 45000),
    ('Atropina', '20003671', '1mg/ml', 'Solución inyectable', 'ampolla', 5500),
    ('Adrenalina (Epinefrina)', '20003672', '1mg/ml', 'Solución inyectable', 'ampolla', 8500),
    ('Dopamina', '20008231', '200mg/5ml', 'Concentrado inyectable', 'ampolla', 18000),
    ('Norepinefrina', '20008232', '4mg/4ml', 'Concentrado inyectable', 'ampolla', 32000),
    ('Amiodarona', '20025671', '150mg/3ml', 'Solución inyectable', 'ampolla', 35000),
    ('Lidocaína', '20007451', '2%', 'Solución inyectable', 'ampolla', 6500),
    ('Haloperidol', '20010671', '5mg/ml', 'Solución inyectable', 'ampolla', 8500),
    ('Risperidona', '20036541', '2mg', 'Tableta', 'tableta', 1200),
    ('Carbamazepina', '20013451', '200mg', 'Tableta', 'tableta', 380),
    ('Ácido valproico', '20018341', '500mg', 'Tableta', 'tableta', 650),
    ('Fenitoína', '20006871', '100mg', 'Cápsula', 'cápsula', 420),
    ('Clonazepam', '20023871', '2mg', 'Tableta', 'tableta', 580),
    ('Calcio gluconato', '20004671', '100mg/ml', 'Solución inyectable', 'ampolla', 7500),
    ('Sulfato de magnesio', '20008671', '20%', 'Solución inyectable', 'ampolla', 5500),
    ('Cloruro de potasio', '20004672', '2mEq/ml', 'Concentrado inyectable', 'ampolla', 4200),
    ('Bicarbonato de sodio', '20004673', '8.4%', 'Solución inyectable', 'ampolla', 5800),
    ('Solución salina 0.9%', '20004674', '0.9%', 'Solución inyectable', 'frasco', 8500),
    ('Dextrosa 5%', '20004675', '5%', 'Solución inyectable', 'frasco', 7800),
    ('Lactato de Ringer', '20004676', '—', 'Solución inyectable', 'frasco', 9200),
    ('Oxitocina', '20009231', '10 UI/ml', 'Solución inyectable', 'ampolla', 8500),
    ('Ergometrina', '20006231', '0.2mg/ml', 'Solución inyectable', 'ampolla', 12000),
    ('Misoprostol', '20038341', '200mcg', 'Tableta', 'tableta', 8500),
    ('Betametasona', '20021341', '12mg/2ml', 'Solución inyectable', 'ampolla', 35000),
    ('Ampicilina + Sulbactam', '20025342', '1.5g', 'Polvo liofilizado inyectable', 'ampolla', 22000),
    ('Piperacilina + Tazobactam', '20040341', '4.5g', 'Polvo liofilizado inyectable', 'ampolla', 85000),
    ('Meropenem', '20035641', '1g', 'Polvo liofilizado inyectable', 'ampolla', 120000),
    ('Imipenem + Cilastatina', '20029871', '500mg/500mg', 'Polvo liofilizado inyectable', 'ampolla', 95000),
    ('Fluconazol', '20028451', '150mg', 'Cápsula', 'cápsula', 1800),
    ('Fluconazol', '20028452', '2mg/ml', 'Solución inyectable', 'frasco', 45000),
    ('Aciclovir', '20023671', '800mg', 'Tableta', 'tableta', 2200),
    ('Vitamina K (Fitomenadiona)', '20006341', '10mg/ml', 'Solución inyectable', 'ampolla', 12000),
    ('Ácido fólico', '20005781', '1mg', 'Tableta', 'tableta', 180),
    ('Hierro sacarosa', '20037841', '20mg/ml', 'Solución inyectable', 'ampolla', 85000),
    ('Albúmina humana', '20041231', '20%', 'Solución inyectable', 'frasco', 250000),
]


class Command(BaseCommand):
    help = 'Puebla MedicamentoFarmacia con medicamentos esenciales para el tenant'

    def add_arguments(self, parser):
        parser.add_argument('--schema', type=str, help='Schema del tenant específico')
        parser.add_argument('--all-tenants', action='store_true', help='Ejecutar en todos los tenants')
        parser.add_argument('--limpiar', action='store_true', help='Eliminar medicamentos existentes antes de insertar')

    def handle(self, *args, **options):
        TenantModel = get_tenant_model()

        if options['all_tenants']:
            tenants = TenantModel.objects.exclude(schema_name='public')
        elif options['schema']:
            tenants = TenantModel.objects.filter(schema_name=options['schema'])
        else:
            self.stderr.write('Usa --schema=NOMBRE o --all-tenants')
            return

        for tenant in tenants:
            self.stdout.write(f'\n→ Procesando tenant: {tenant.schema_name}')
            with schema_context(tenant.schema_name):
                self._poblar(options.get('limpiar', False))

    def _poblar(self, limpiar):
        from apps.farmacia.models import MedicamentoFarmacia
        from apps.catalogos.models import CatalogoMedicamento

        if limpiar:
            eliminados = MedicamentoFarmacia.objects.all().delete()[0]
            self.stdout.write(f'  Eliminados {eliminados} medicamentos existentes')

        # Primero cargar la lista esencial con precios
        esenciales_cum = {}
        for nombre, cum, concentracion, forma, unidad, precio in ESENCIALES:
            esenciales_cum[cum] = (nombre, concentracion, forma, unidad, precio)

        # Cargar todos del catálogo INVIMA
        catalogo = list(CatalogoMedicamento.objects.all())
        self.stdout.write(f'  Catálogo INVIMA: {len(catalogo)} registros')

        # CUMs ya existentes en farmacia
        existentes = set(MedicamentoFarmacia.objects.values_list('cum', flat=True))

        nuevos = []
        omitidos = 0

        for cat in catalogo:
            if cat.cum in existentes:
                omitidos += 1
                continue

            # Si está en la lista esencial, usar sus datos (con precio)
            if cat.cum in esenciales_cum:
                nombre, concentracion, forma, unidad, precio = esenciales_cum[cat.cum]
            else:
                nombre        = cat.principio_activo
                concentracion = cat.concentracion or ''
                forma         = cat.forma_farmaceutica or ''
                unidad        = 'und'
                precio        = 0

            nuevos.append(MedicamentoFarmacia(
                nombre_generico    = nombre[:200],
                cum                = cat.cum,
                concentracion      = concentracion[:100] if concentracion else '',
                forma_farmaceutica = forma[:100] if forma else '',
                unidad_medida      = unidad,
                precio_unitario    = precio,
                stock_actual       = 0,
                stock_minimo       = 5,
                activo             = True,
            ))

        # También agregar esenciales que no estén en el catálogo INVIMA
        cats_cum = {c.cum for c in catalogo}
        for cum, (nombre, concentracion, forma, unidad, precio) in esenciales_cum.items():
            if cum not in cats_cum and cum not in existentes:
                nuevos.append(MedicamentoFarmacia(
                    nombre_generico    = nombre,
                    cum                = cum,
                    concentracion      = concentracion,
                    forma_farmaceutica = forma,
                    unidad_medida      = unidad,
                    precio_unitario    = precio,
                    stock_actual       = 0,
                    stock_minimo       = 5,
                    activo             = True,
                ))

        # Insertar en lotes de 500
        BATCH = 500
        creados = 0
        for i in range(0, len(nuevos), BATCH):
            lote = nuevos[i:i + BATCH]
            MedicamentoFarmacia.objects.bulk_create(lote, ignore_conflicts=True)
            creados += len(lote)
            self.stdout.write(f'  → {creados}/{len(nuevos)} insertados...')

        self.stdout.write(self.style.SUCCESS(
            f'  ✓ Creados: {creados}  |  Omitidos (ya existían): {omitidos}'
        ))
