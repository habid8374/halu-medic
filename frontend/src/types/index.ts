// ── Autenticación ─────────────────────────────────────────────────────────────
export type Rol = 'superadmin' | 'admin' | 'medico' | 'recepcionista' | 'facturador' | 'auditor'

export interface Permisos {
  puede_facturar: boolean
  puede_ver_clinica: boolean
  puede_editar_clinica: boolean
  puede_gestionar_citas: boolean
  es_admin: boolean
  es_superadmin: boolean
}

export interface Usuario {
  id: string
  username: string
  nombre: string
  email: string
  telefono?: string
  rol: Rol
  rol_label: string
  permisos: Permisos
}

export interface AuthTokens {
  access: string
  refresh: string
  usuario: Usuario
}

// ── Pacientes ─────────────────────────────────────────────────────────────────
export type TipoDoc = 'CC' | 'CE' | 'TI' | 'RC' | 'PA' | 'MS' | 'AS' | 'NIT'
export type Regimen = 'C' | 'S' | 'V' | 'P' | 'A' | 'T' | 'O'
export type Sexo = 'M' | 'F' | 'I'

export interface Aseguradora {
  id: string
  nombre: string
  nit: string
  codigo: string
  tipo: string
  activa: boolean
}

export interface ConvenioEPS {
  id: string
  aseguradora: string
  aseguradora_nombre: string
  aseguradora_nit: string
  numero_contrato: string
  vigencia_desde: string
  vigencia_hasta: string
  cucon: string
  tipo_tarifa: string
  porcentaje_copago: number
  valor_cuota_moderadora: number
  activo: boolean
  observaciones: string
}

export interface Paciente {
  id: string
  tipo_identificacion: TipoDoc
  numero_identificacion: string
  primer_nombre: string
  segundo_nombre?: string
  primer_apellido: string
  segundo_apellido?: string
  nombre_completo: string
  fecha_nacimiento: string
  sexo: Sexo
  email?: string
  telefono?: string
  direccion?: string
  municipio_codigo?: string
  regimen: Regimen
  aseguradora?: string
  aseguradora_nombre?: string
  numero_poliza?: string
  activo: boolean
  creado_en: string
}

// ── Citas ─────────────────────────────────────────────────────────────────────
export type EstadoCita = 'programada' | 'confirmada' | 'en_curso' | 'atendida' | 'cancelada' | 'no_asistio'

export interface Cita {
  id: string
  paciente: string
  paciente_nombre: string
  medico: string
  medico_nombre: string
  especialidad?: string
  sala?: string
  convenio?: string
  fecha_hora_inicio: string
  fecha_hora_fin: string
  duracion_minutos: number
  estado: EstadoCita
  motivo_consulta?: string
  observaciones?: string
  creado_en: string
}

// ── Consultas ─────────────────────────────────────────────────────────────────
export interface Procedimiento {
  id?: string
  cups: string
  descripcion: string
  valor_facturar: number
  cantidad: number
  ambito?: string
  finalidad?: string
  personal_atiende?: string
}

export type EstadoConsulta = 'abierta' | 'cerrada' | 'facturada' | 'anulada'

export interface Consulta {
  id: string
  cita?: string
  paciente: string
  paciente_nombre: string
  medico: string
  convenio?: string
  fecha_atencion: string
  cups_principal: string
  descripcion_cups?: string
  diagnostico_principal: string
  diagnostico_relacionado_1?: string
  diagnostico_relacionado_2?: string
  diagnostico_relacionado_3?: string
  tipo_diagnostico: '1' | '2' | '3'
  motivo_consulta?: string
  enfermedad_actual?: string
  examen_fisico?: string
  plan_tratamiento?: string
  numero_autorizacion?: string
  valor_consulta: number
  valor_copago: number
  valor_total: number
  procedimientos: Procedimiento[]
  estado: EstadoConsulta
  creado_en: string
}

// ── Facturación ───────────────────────────────────────────────────────────────
export type EstadoFactura = 'borrador' | 'enviada' | 'validada' | 'error' | 'anulada'
export type TipoOperacionSalud = 'SS-CUFE' | 'SS-SinAporte' | 'SS-Recaudo' | 'SS-Reporte'

export interface Factura {
  id: string
  consulta: string
  consulta_info: {
    paciente: string
    paciente_doc?: string
    fecha: string
    cups: string
    diagnostico: string
    medico?: string
    num_autorizacion?: string
    items?: Array<{ cups: string; descripcion: string; cantidad: number; valor_unit: number; total: number }>
    eps_nombre?: string
    eps_nit?: string
    regimen?: string
    num_contrato?: string
    a_cobrar_eps?: number
    consultorio_nombre?: string
    consultorio_nit?: string
    consultorio_cod_prestador?: string
    consultorio_direccion?: string
    consultorio_tel?: string
    convenio_cucon?: string
  }
  convenio?: string
  numero_factus?: string
  cufe?: string
  qr_url?: string
  subtotal: number
  descuento: number
  iva: number
  total: number
  valor_copago: number
  estado: EstadoFactura
  errores_dian: string[]
  tiene_rips: boolean
  cuv?: string
  fecha_validacion?: string
  creado_en: string
}

// ── Facturación PGP / Capitado ────────────────────────────────────────────────
export interface FacturaPGP {
  id: string
  convenio: string
  convenio_info: {
    aseguradora_nombre: string
    aseguradora_nit: string
    numero_contrato: string
    cucon: string
  }
  periodo_desde: string
  periodo_hasta: string
  descripcion_contrato: string
  numero_contrato_eps: string
  valor_total: number
  numero_factus: string
  cufe: string
  qr_url: string
  cuv: string
  estado: EstadoFactura
  errores_dian: string[]
  tiene_rips: boolean
  fecha_validacion?: string
  creado_en: string
}

// ── Historia Clínica ──────────────────────────────────────────────────────────
export type TipoAtencion = 'consulta_externa' | 'urgencias' | 'hospitalizacion' | 'procedimiento'
export type TipoEgreso   = 'alta_medica' | 'traslado' | 'voluntario' | 'fallecimiento' | 'fuga'
export type TipoRegistroHC = 'consulta' | 'urgencias' | 'hospitalizacion' | 'procedimiento' | 'evolucion' | 'interconsulta'

export interface Ingreso {
  id: string
  numero_ingreso: number
  paciente: string
  paciente_nombre: string
  medico?: string
  medico_nombre?: string
  fecha_ingreso: string
  motivo_ingreso: string
  tipo_atencion: TipoAtencion
  observaciones: string
  activo: boolean
  tiene_egreso: boolean
  egreso_info?: {
    id: string
    fecha_egreso: string
    tipo_egreso: TipoEgreso
    diagnostico_egreso: string
  }
  creado_en: string
}

export interface Egreso {
  id: string
  ingreso: string
  fecha_egreso: string
  tipo_egreso: TipoEgreso
  diagnostico_egreso: string
  descripcion_diagnostico: string
  condicion_al_egreso: string
  medico?: string
  observaciones: string
  creado_en: string
}

export interface SignosVitales {
  pa_sistolica?: number
  pa_diastolica?: number
  fc?: number
  fr?: number
  temperatura?: number
  peso?: number
  talla?: number
  spo2?: number
}

export interface HistoriaClinica {
  id: string
  paciente: string
  paciente_nombre: string
  ingreso?: string
  consulta?: string
  medico?: string
  medico_nombre?: string
  fecha_atencion: string
  tipo_registro: TipoRegistroHC
  motivo_consulta: string
  anamnesis: string
  enfermedad_actual: string
  signos_vitales?: SignosVitales
  examen_fisico: string
  impresion_diagnostica: string
  diagnostico_principal: string
  diagnostico_relacionado_1: string
  diagnostico_relacionado_2: string
  plan_tratamiento: string
  ordenes_medicas: string
  observaciones: string
  creado_en: string
  actualizado_en: string
}

// ── Paginación ────────────────────────────────────────────────────────────────
export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
