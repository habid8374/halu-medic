# 🏥 Halu Medic

**Software de gestión clínica y facturación electrónica para médicos especialistas en Colombia**

Desarrollado por [Axentia Technologies S.A.S.](https://axentia.co) — parte del ecosistema **Halu Group**.

---

## ¿Qué es Halu Medic?

Plataforma SaaS multi-consultorio que integra gestión de pacientes, agendamiento, consulta clínica, facturación electrónica DIAN y generación automática de RIPS, diseñada para consultorios médicos y clínicas pequeñas en Colombia.

### Módulos principales

| Módulo | Descripción |
|--------|-------------|
| 👤 **Pacientes** | Historia clínica, aseguradora, EPS, régimen |
| 📅 **Citas** | Agenda por médico, especialidad y sala |
| 🩺 **Consultas** | Registro clínico con códigos CUPS |
| 💰 **Facturación** | Factura electrónica DIAN vía Factus API |
| 📊 **RIPS** | Generación automática según Res. 948/2026 |
| 🤝 **Tarifas** | Convenios EPS, SOAT, ISS, particular |
| 📈 **Reportes** | Dashboard financiero y de producción |
| 🏢 **Multi-tenant** | Aislamiento por consultorio (schema por tenant) |

---

## Stack tecnológico

**Backend:** Django 5 + Django REST Framework + django-tenants  
**Frontend:** Next.js 14 + TypeScript + Tailwind CSS + Framer Motion  
**Base de datos:** PostgreSQL 16 (multi-schema)  
**Cola de tareas:** Celery + Redis  
**Facturación:** [Factus API](https://developers.factus.com.co/) (PT habilitado DIAN)  
**Almacenamiento:** S3 / Wasabi (XML, PDFs, documentos)  

---

## Normativa aplicada

- **Resolución 948 de 2026** — MinSalud. RIPS JSON como soporte de la FEV en salud (norma consolidada vigente, deroga Res. 2275/2023)
- **CUCON** — Código Único de Contrato (SHA-256, 64 caracteres), obligatorio en toda FEV bajo convenio
- **Documentos Técnicos SIIFA** — Catálogos CUPS y tablas actualizables sin reforma normativa
- Fechas clave: validaciones MUV **1-jun-2026** · actualización estructural **1-jul-2026**

---

## Estructura del proyecto

```
halu-medic/
├── backend/                  # Django
│   ├── config/               # Settings, URLs, WSGI, ASGI
│   └── apps/
│       ├── tenants/          # Multi-tenancy (django-tenants)
│       ├── pacientes/        # Gestión de pacientes
│       ├── citas/            # Agendamiento
│       ├── consultas/        # Registro clínico + CUPS
│       ├── facturacion/      # Integración Factus API
│       ├── rips/             # Generación RIPS Res. 948/2026
│       ├── tarifas/          # Convenios EPS / SOAT / ISS
│       ├── reportes/         # Dashboard y exportaciones
│       └── suscripciones/    # Planes SaaS y facturación propia
├── frontend/                 # Next.js 14
│   └── src/
│       ├── app/              # App Router
│       ├── components/       # Componentes por módulo
│       ├── lib/              # API client, helpers
│       └── types/            # TypeScript types
├── docs/
│   ├── arquitectura/         # Diagramas y decisiones técnicas
│   └── normativa/            # Referencias Res. 948/2026, CUPS, etc.
├── scripts/                  # Utilidades de setup y migración
└── .github/workflows/        # CI/CD
```

---

## Inicio rápido (desarrollo)

### Requisitos
- Python 3.12+
- Node.js 20+
- PostgreSQL 16
- Redis 7

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements/dev.txt
cp .env.example .env       # Configurar variables
python manage.py migrate_schemas --shared
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

---

## Variables de entorno (backend)

```env
# Django
SECRET_KEY=
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Base de datos
DATABASE_URL=postgres://user:pass@localhost:5432/halu_medic

# Redis / Celery
REDIS_URL=redis://localhost:6379/0

# Factus API
FACTUS_CLIENT_ID=
FACTUS_CLIENT_SECRET=
FACTUS_BASE_URL=https://api-sandbox.factus.com.co

# S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
AWS_S3_ENDPOINT_URL=
```

---

## Planes SaaS

| Plan | Médicos | Facturas/mes | RIPS | Soporte |
|------|---------|--------------|------|---------|
| Básico | 1 | 100 | ✅ | Email |
| Pro | 5 | Ilimitado | ✅ | Prioritario |
| Clínica | Ilimitado | Ilimitado | ✅ | Dedicado + API |

---

## Licencia

Software propietario — © 2026 Axentia Technologies S.A.S.  
Todos los derechos reservados.
