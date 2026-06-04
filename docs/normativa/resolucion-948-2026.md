# Normativa Aplicada — RIPS y Facturación Electrónica en Salud

## Resolución 948 de 2026 (MinSalud)
**Fecha:** 14 de mayo de 2026  
**Estado:** Vigente. Deroga Resoluciones 2275/2023, 558/2024 y 1884/2024.

### Cambios clave implementados en Halu Medic

| Elemento | Descripción | Implementación |
|----------|-------------|----------------|
| **CUCON** | Código Único de Contrato — hash SHA-256 (64 chars) obligatorio en FEV bajo convenio | `apps/tarifas/models.py → ConvenioEPS.cucon` |
| **Documentos Técnicos** | Catálogos CUPS actualizables sin reforma normativa | Catálogos en DB, no hardcodeados |
| **Nota de ajuste RIPS** | Formalmente definida en la norma | `apps/rips/` |
| **Fabricantes/importadores** | Módulo FEV sin RIPS para ventas masivas | Fuera de alcance inicial |

### Fechas críticas de cumplimiento

| Fecha | Obligación |
|-------|-----------|
| **1 junio 2026** | Cambios en reglas de validación del MUV ministerial |
| **1 julio 2026** | Actualización estructural de software (sistemas deben estar alineados) |

### Flujo operativo

```
Consulta médica
     ↓
FEV (XML DIAN) + RIPS (JSON) → enviados al MUV (MinSalud)
     ↓
MUV asigna CUV (Código Único de Validación)
     ↓
Radicación ante ERP (entidad pagadora) — máx. 22 días hábiles desde FEV
```

### Campo CUCON en RIPS JSON

```json
{
  "numDocumentoIdObligado": "900123456",
  "numFactura": "SETP990000001",
  "cucon": "a3f8b2c1d4e5f6789012345678901234567890abcdef1234567890abcdef1234",
  "consecutivo": 1,
  "usuarios": [...],
  "consultas": [...]
}
```

## Referencias normativas completas

- Resolución 948 de 2026 — MinSalud (norma consolidada vigente)
- Resolución 2275 de 2023 — Derogada
- Resolución 558 de 2024 — Derogada
- Resolución 1884 de 2024 — Derogada
- Resolución 2669 de 2025 — Crea el Comité Técnico del SIIFA
- Resolución 1962 de 2025 — Módulo FEV-RIPS del SIIFA
- Resolución 1597 de 2025 — Salud pública e intervenciones colectivas
