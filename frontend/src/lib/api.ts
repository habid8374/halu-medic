/**
 * Cliente HTTP centralizado para la API de Halu Medic.
 * Maneja: autenticación JWT, refresh automático, errores, y todos los endpoints.
 */
import axios, { AxiosInstance, AxiosError } from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Instancia base ────────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// ── Interceptor: adjunta el token de acceso ───────────────────────────────────

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Interceptor: refresca token automáticamente si expira ─────────────────────

let refreshing = false
let cola: Array<(token: string) => void> = []

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any
    if (error.response?.status === 401 && !original._retry) {
      if (refreshing) {
        return new Promise((resolve) => {
          cola.push((token) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      }
      original._retry = true
      refreshing = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (!refresh) throw new Error('Sin refresh token')
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh/`, { refresh })
        const newAccess = data.access
        localStorage.setItem('access_token', newAccess)
        cola.forEach((cb) => cb(newAccess))
        cola = []
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      } finally {
        refreshing = false
      }
    }
    return Promise.reject(error)
  }
)

// ── Helper: extraer mensaje de error de la API ────────────────────────────────

export function mensajeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (typeof data === 'string') return data
    if (data?.detail) return data.detail
    if (data?.error) return data.error
    if (data?.mensaje) return data.mensaje
    if (data?.non_field_errors) return data.non_field_errors[0]
    const firstField = Object.values(data || {})[0]
    if (Array.isArray(firstField)) return firstField[0] as string
  }
  return 'Error inesperado. Intenta de nuevo.'
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/api/auth/login/', { username, password }),

  logout: (refresh: string) =>
    api.post('/api/auth/logout/', { refresh }),

  me: () =>
    api.get('/api/auth/me/'),

  recuperarPassword: (email: string) =>
    api.post('/api/auth/recuperar-password/', { email }),

  confirmarPassword: (uid: string, token: string, password: string, password2: string) =>
    api.post('/api/auth/confirmar-password/', { uid, token, password, password2 }),
}

// ── Configuración del consultorio ─────────────────────────────────────────────

export const consultorioAPI = {
  get: () => api.get('/api/consultorio/configuracion/'),
  update: (data: Record<string, unknown>) => api.put('/api/consultorio/configuracion/', data),
}

// ── Pacientes ─────────────────────────────────────────────────────────────────

export const pacientesAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/pacientes/', { params }),
  get:    (id: string) => api.get(`/api/pacientes/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/pacientes/', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/pacientes/${id}/`, data),
  delete: (id: string) => api.delete(`/api/pacientes/${id}/`),
}

// ── Citas ─────────────────────────────────────────────────────────────────────

export const citasAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/citas/', { params }),
  get:    (id: string) => api.get(`/api/citas/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/citas/', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/citas/${id}/`, data),
  delete: (id: string) => api.delete(`/api/citas/${id}/`),
}

// ── Consultas ─────────────────────────────────────────────────────────────────

export const consultasAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/consultas/', { params }),
  get:    (id: string) => api.get(`/api/consultas/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/consultas/', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/consultas/${id}/`, data),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardAPI = {
  stats:           () => api.get('/api/dashboard/stats/'),
  ingresosActivos: (params?: Record<string, unknown>) =>
    api.get('/api/historia/ingresos/', { params: { activo: 'true', ordering: '-fecha_ingreso', page_size: 5, ...params } }),
}

// ── Facturación ───────────────────────────────────────────────────────────────

export const facturasAPI = {
  list:        (params?: Record<string, unknown>) => api.get('/api/facturacion/facturas/', { params }),
  get:         (id: string) => api.get(`/api/facturacion/facturas/${id}/`),
  create:      (data: Record<string, unknown>) => api.post('/api/facturacion/facturas/', data),
  emitir:      (id: string) => api.post(`/api/facturacion/facturas/${id}/emitir/`),
  anular:      (id: string, motivo: string) => api.post(`/api/facturacion/facturas/${id}/anular/`, { motivo }),
  sincronizar: (id: string) => api.post(`/api/facturacion/facturas/${id}/sincronizar/`),
  reintentar:  (id: string) => api.post(`/api/facturacion/facturas/${id}/reintentar/`),
  pdf:         (id: string) => api.get(`/api/facturacion/facturas/${id}/pdf/`),
  xml:         (id: string) => api.get(`/api/facturacion/facturas/${id}/xml/`),
  rips:        (id: string) => api.get(`/api/facturacion/facturas/${id}/rips/`),
  pendientes:   (params?: Record<string, unknown>) => api.get('/api/facturacion/facturas/pendientes/', { params }),
  crearDesdeHC: (historiaId: string) => api.post('/api/facturacion/facturas/', { historia: historiaId }),
  update:       (id: string, data: Record<string, unknown>) => api.patch(`/api/facturacion/facturas/${id}/`, data),
}

// ── CUPS (homologador nacional, solo lectura) ──────────────────────────────────

export const cupsAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/cups/', { params }),
  get:    (codigo: string) => api.get(`/api/cups/${codigo}/`),
  buscar: (q: string) => api.get('/api/cups/', { params: { search: q, page_size: 50 } }),
}

// CUPS RIPS management
export const cupsRipsAPI = {
  descargarPlantilla: () => api.get('/api/cups/plantilla/', { responseType: 'blob' }),
  importar: (archivo: File) => {
    const fd = new FormData()
    fd.append('archivo', archivo)
    return api.post('/api/cups/importar-rips/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const ordenesMedicasAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/ordenes-medicas/', { params }),
  create: (data: Record<string, unknown>) => api.post('/api/ordenes-medicas/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/ordenes-medicas/${id}/`, data),
  delete: (id: string) => api.delete(`/api/ordenes-medicas/${id}/`),
}

export const cie10API = {
  list:   (params?: Record<string, unknown>) => api.get('/api/cie10/', { params }),
  get:    (codigo: string) => api.get(`/api/cie10/${codigo}/`),
  buscar: (q: string) => api.get('/api/cie10/', { params: { search: q, page_size: 50 } }),
}

// ── Aseguradoras ──────────────────────────────────────────────────────────────

export const aseguradorasAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/aseguradoras/', { params }),
  get:    (id: string) => api.get(`/api/aseguradoras/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/aseguradoras/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/aseguradoras/${id}/`, data),
  delete: (id: string) => api.delete(`/api/aseguradoras/${id}/`),
}

// ── Convenios EPS ─────────────────────────────────────────────────────────────

export const conveniosAPI = {
  list:   () => api.get('/api/convenios-eps/'),
  create: (data: Record<string, unknown>) => api.post('/api/convenios-eps/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/convenios-eps/${id}/`, data),
  delete: (id: string) => api.delete(`/api/convenios-eps/${id}/`),
}

// ── Tarifarios ────────────────────────────────────────────────────────────────

export const tarifasAPI = {
  list:          (params?: Record<string, unknown>) => api.get('/api/tarifas/', { params }),
  get:           (id: string) => api.get(`/api/tarifas/${id}/`),
  create:        (data: Record<string, unknown>) => api.post('/api/tarifas/', data),
  update:        (id: string, data: Record<string, unknown>) => api.patch(`/api/tarifas/${id}/`, data),
  delete:        (id: string) => api.delete(`/api/tarifas/${id}/`),
  listarItems:   (id: string, params?: Record<string, unknown>) => api.get(`/api/tarifas/${id}/items/`, { params }),
  agregarItem:   (id: string, data: Record<string, unknown>) => api.post(`/api/tarifas/${id}/items/agregar/`, data),
  editarItem:    (id: string, itemId: string, data: Record<string, unknown>) => api.patch(`/api/tarifas/${id}/items/${itemId}/editar/`, data),
  eliminarItem:  (id: string, itemId: string) => api.delete(`/api/tarifas/${id}/items/${itemId}/eliminar/`),
  importar:      (id: string, archivo: File) => {
    const fd = new FormData(); fd.append('archivo', archivo)
    return api.post(`/api/tarifas/${id}/importar/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  precio:        (cups: string, pacienteId?: string) =>
    api.get('/api/tarifas/precio/', { params: { cups, ...(pacienteId ? { paciente: pacienteId } : {}) } }),
  plantilla:     () => api.get('/api/tarifas/plantilla/', { responseType: 'blob' }),
}

// ── Usuarios ──────────────────────────────────────────────────────────────────

export const usuariosAPI = {
  list:             (params?: Record<string, unknown>) => api.get('/api/usuarios/', { params }),
  get:              (id: string) => api.get(`/api/usuarios/${id}/`),
  create:           (data: Record<string, unknown>) => api.post('/api/usuarios/', data),
  update:           (id: string, data: Record<string, unknown>) => api.put(`/api/usuarios/${id}/`, data),
  cambiarPassword:  (id: string, data: Record<string, unknown>) => api.post(`/api/usuarios/${id}/cambiar_password/`, data),
  desactivar:       (id: string) => api.post(`/api/usuarios/${id}/desactivar/`),
  activar:          (id: string) => api.post(`/api/usuarios/${id}/activar/`),
}

// ── Suscripciones (superadmin) ────────────────────────────────────────────────

export const suscripcionesAPI = {
  list:      () => api.get('/api/admin/suscripciones/'),
  get:       (id: string) => api.get(`/api/admin/suscripciones/${id}/`),
  create:    (data: Record<string, unknown>) => api.post('/api/admin/suscripciones/', data),
  update:    (id: string, data: Record<string, unknown>) => api.put(`/api/admin/suscripciones/${id}/`, data),
  renovar:   (id: string, data: Record<string, unknown>) => api.post(`/api/admin/suscripciones/${id}/renovar/`, data),
  suspender: (id: string) => api.post(`/api/admin/suscripciones/${id}/suspender/`),
  activar:   (id: string) => api.post(`/api/admin/suscripciones/${id}/activar/`),
  pagos:     (id: string) => api.get(`/api/admin/suscripciones/${id}/pagos/`),
}

// ── Historia Clínica ──────────────────────────────────────────────────────────

export const ingresosAPI = {
  list:    (params?: Record<string, unknown>) => api.get('/api/historia/ingresos/', { params }),
  get:     (id: string) => api.get(`/api/historia/ingresos/${id}/`),
  create:  (data: Record<string, unknown>) => api.post('/api/historia/ingresos/', data),
  update:  (id: string, data: Record<string, unknown>) => api.patch(`/api/historia/ingresos/${id}/`, data),
  egresar: (id: string, data: Record<string, unknown>) => api.post(`/api/historia/ingresos/${id}/egresar/`, data),
}

export const historiaAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/historia/registros/', { params }),
  get:    (id: string) => api.get(`/api/historia/registros/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/historia/registros/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/historia/registros/${id}/`, data),
}

// ── Medicamentos Historia Clínica ─────────────────────────────────────────────

export const medicamentosHCAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/historia/medicamentos/', { params }),
  create: (data: Record<string, unknown>) => api.post('/api/historia/medicamentos/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/historia/medicamentos/${id}/`, data),
  delete: (id: string) => api.delete(`/api/historia/medicamentos/${id}/`),
}

export const ordenesHCAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/historia/ordenes/', { params }),
  create: (data: Record<string, unknown>) => api.post('/api/historia/ordenes/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/historia/ordenes/${id}/`, data),
  delete: (id: string) => api.delete(`/api/historia/ordenes/${id}/`),
}

export const catalogoMedicamentosAPI = {
  search: (q: string, vigentes = true) =>
    api.get('/api/catalogos/medicamentos/', { params: { search: q, vigentes: vigentes ? 'true' : 'false' } }),
}

export const consultaMedicamentosAPI = {
  list:   (consultaId: string) => api.get('/api/consultas/medicamentos/', { params: { consulta: consultaId } }),
  create: (data: Record<string, unknown>) => api.post('/api/consultas/medicamentos/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/consultas/medicamentos/${id}/`, data),
  delete: (id: string) => api.delete(`/api/consultas/medicamentos/${id}/`),
}

export const farmaciaInventarioAPI = {
  search: (q: string) => api.get('/api/farmacia/medicamentos/', { params: { search: q, activo: 'true' } }),
  list:   (params?: Record<string, unknown>) => api.get('/api/farmacia/medicamentos/', { params }),
  create: (data: Record<string, unknown>) => api.post('/api/farmacia/medicamentos/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/farmacia/medicamentos/${id}/`, data),
  delete: (id: string) => api.delete(`/api/farmacia/medicamentos/${id}/`),
}

export const tarifaMedicamentosAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/tarifas/medicamentos/', { params }),
  get:    (id: string) => api.get(`/api/tarifas/medicamentos/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/tarifas/medicamentos/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/tarifas/medicamentos/${id}/`, data),
  delete: (id: string) => api.delete(`/api/tarifas/medicamentos/${id}/`),
}

// ── Facturación PGP / Capitado ────────────────────────────────────────────────

export const facturasPGPAPI = {
  list:        (params?: Record<string, unknown>) => api.get('/api/facturacion/pgp/', { params }),
  get:         (id: string) => api.get(`/api/facturacion/pgp/${id}/`),
  create:      (data: Record<string, unknown>) => api.post('/api/facturacion/pgp/', data),
  update:      (id: string, data: Record<string, unknown>) => api.patch(`/api/facturacion/pgp/${id}/`, data),
  reintentar:  (id: string) => api.post(`/api/facturacion/pgp/${id}/reintentar/`),
  sincronizar: (id: string) => api.post(`/api/facturacion/pgp/${id}/sincronizar/`),
  rips:        (id: string) => api.get(`/api/facturacion/pgp/${id}/rips/`),
}

// ── Superadmin — Consultorios ─────────────────────────────────────────────────

export const consultoriosAdminAPI = {
  list:       (params?: Record<string, unknown>) => api.get('/api/admin/consultorios/', { params }),
  get:        (id: string) => api.get(`/api/admin/consultorios/${id}/`),
  activar:    (id: string) => api.post(`/api/admin/consultorios/${id}/activar/`),
  desactivar: (id: string) => api.post(`/api/admin/consultorios/${id}/desactivar/`),
  estadisticas: (id: string) => api.get(`/api/admin/consultorios/${id}/estadisticas/`),
  crear:      (data: Record<string, unknown>) => api.post('/api/auth/signup/', data),
}

// ── Módulo Salud ────────────────────────────────────────────────────────────

export const especialidadesAPI = {
  list:   (params?: Record<string, string>) => api.get('/api/catalogos/especialidades/', { params }),
  create: (data: Record<string, unknown>)   => api.post('/api/catalogos/especialidades/', data),
  update: (id: string | number, data: Record<string, unknown>) =>
    api.patch(`/api/catalogos/especialidades/${id}/`, data),
}

export const notasMedicasAPI = {
  list:   (params?: Record<string, string>) => api.get('/api/salud/notas/', { params }),
  get:    (id: string) => api.get(`/api/salud/notas/${id}/`),
  create: (data: Record<string, unknown>)   => api.post('/api/salud/notas/', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/api/salud/notas/${id}/`, data),
  firmar: (id: string) => api.post(`/api/salud/notas/${id}/firmar/`),
}

export const programacionCxAPI = {
  list:   (params?: Record<string, string>) => api.get('/api/salud/cx/', { params }),
  get:    (id: string) => api.get(`/api/salud/cx/${id}/`),
  create: (data: Record<string, unknown>)   => api.post('/api/salud/cx/', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/api/salud/cx/${id}/`, data),
  delete: (id: string) => api.delete(`/api/salud/cx/${id}/`),
}

export const descripcionQxAPI = {
  list:   (params?: Record<string, string>) => api.get('/api/salud/descripcion-qx/', { params }),
  get:    (id: string) => api.get(`/api/salud/descripcion-qx/${id}/`),
  create: (data: Record<string, unknown>)   => api.post('/api/salud/descripcion-qx/', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/api/salud/descripcion-qx/${id}/`, data),
  firmar: (id: string) => api.post(`/api/salud/descripcion-qx/${id}/firmar/`),
}

export const ayudasDiagnosticasAPI = {
  list:   (params?: Record<string, string>) => api.get('/api/salud/ayudas/', { params }),
  get:    (id: string) => api.get(`/api/salud/ayudas/${id}/`),
  create: (data: Record<string, unknown>)   => api.post('/api/salud/ayudas/', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/api/salud/ayudas/${id}/`, data),
  cargarResultado: (id: string, formData: FormData) =>
    api.post(`/api/salud/ayudas/${id}/cargar_resultado/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

export const medicosAPI = {
  list: () => api.get('/api/usuarios/medicos/'),
}

export default api

// ── Prefactura ────────────────────────────────────────────────────────────────
export const prefacturaAPI = {
  list:   (params?: Record<string, string>) => api.get('/api/facturacion/prefacturas/', { params }),
  get:    (id: string) => api.get(`/api/facturacion/prefacturas/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/facturacion/prefacturas/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/facturacion/prefacturas/${id}/`, data),
  delete: (id: string) => api.delete(`/api/facturacion/prefacturas/${id}/`),
  autocargar:    (id: string) => api.post(`/api/facturacion/prefacturas/${id}/autocargar/`),
  cambiarEstado: (id: string, estado: string) => api.post(`/api/facturacion/prefacturas/${id}/cambiar_estado/`, { estado }),
  recalcular:    (id: string) => api.post(`/api/facturacion/prefacturas/${id}/recalcular/`),
}

export const itemPrefacturaAPI = {
  create: (data: Record<string, unknown>) => api.post('/api/facturacion/items/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/facturacion/items/${id}/`, data),
  delete: (id: string) => api.delete(`/api/facturacion/items/${id}/`),
}

// ── Triage ────────────────────────────────────────────────────────────────────
export const triageAPI = {
  list:          (params?: Record<string, unknown>) => api.get('/api/salud/triage/', { params }),
  get:           (id: string) => api.get(`/api/salud/triage/${id}/`),
  create:        (data: Record<string, unknown>) => api.post('/api/salud/triage/', data),
  update:        (id: string, data: Record<string, unknown>) => api.patch(`/api/salud/triage/${id}/`, data),
  atender:       (id: string) => api.post(`/api/salud/triage/${id}/atender/`),
  cambiarEstado: (id: string, estado: string) => api.post(`/api/salud/triage/${id}/cambiar_estado/`, { estado }),
}

// ── Lista Verificación Quirúrgica ─────────────────────────────────────────────
export const verificacionQxAPI = {
  get:      (id: string) => api.get(`/api/salud/verificacion-qx/${id}/`),
  getByPx:  (programacionId: string) => api.get('/api/salud/verificacion-qx/', { params: { programacion: programacionId } }),
  create:   (data: Record<string, unknown>) => api.post('/api/salud/verificacion-qx/', data),
  update:   (id: string, data: Record<string, unknown>) => api.patch(`/api/salud/verificacion-qx/${id}/`, data),
  completar:(id: string) => api.post(`/api/salud/verificacion-qx/${id}/completar/`),
}

// ── Registro de Anestesia ─────────────────────────────────────────────────────
export const anestesiaAPI = {
  get:    (id: string) => api.get(`/api/salud/anestesia/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/salud/anestesia/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/salud/anestesia/${id}/`, data),
}

// ── Consentimientos Informados ────────────────────────────────────────────────
export const consentimientosAPI = {
  list:    (params?: Record<string, unknown>) => api.get('/api/salud/consentimientos/', { params }),
  get:     (id: string) => api.get(`/api/salud/consentimientos/${id}/`),
  create:  (data: Record<string, unknown>) => api.post('/api/salud/consentimientos/', data),
  update:  (id: string, data: Record<string, unknown>) => api.patch(`/api/salud/consentimientos/${id}/`, data),
  firmar:  (id: string, data: Record<string, unknown>) => api.post(`/api/salud/consentimientos/${id}/firmar/`, data),
  rechazar:(id: string, motivo: string) => api.post(`/api/salud/consentimientos/${id}/rechazar/`, { motivo }),
}

// ── Notas de Enfermería ───────────────────────────────────────────────────────
export const enfermeriaAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/salud/enfermeria/', { params }),
  get:    (id: string) => api.get(`/api/salud/enfermeria/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/salud/enfermeria/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/salud/enfermeria/${id}/`, data),
}

// ── RRHH ──────────────────────────────────────────────────────────────────────
export const cargoAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/rrhh/cargos/', { params }),
  create: (data: Record<string, unknown>) => api.post('/api/rrhh/cargos/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/rrhh/cargos/${id}/`, data),
  delete: (id: string) => api.delete(`/api/rrhh/cargos/${id}/`),
}

export const contratoAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/rrhh/contratos/', { params }),
  get:    (id: string) => api.get(`/api/rrhh/contratos/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/rrhh/contratos/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/rrhh/contratos/${id}/`, data),
}

export const turnoAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/rrhh/turnos/', { params }),
  create: (data: Record<string, unknown>) => api.post('/api/rrhh/turnos/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/rrhh/turnos/${id}/`, data),
  delete: (id: string) => api.delete(`/api/rrhh/turnos/${id}/`),
}

export const nominaAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/rrhh/nomina/', { params }),
  get:    (id: string) => api.get(`/api/rrhh/nomina/${id}/`),
  create: (data: Record<string, unknown>) => api.post('/api/rrhh/nomina/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/rrhh/nomina/${id}/`, data),
}

export const incapacidadRRHHAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/rrhh/incapacidades/', { params }),
  create: (data: Record<string, unknown>) => api.post('/api/rrhh/incapacidades/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/rrhh/incapacidades/${id}/`, data),
}

// ── Esterilización ────────────────────────────────────────────────────────────
export const esterilizacionAPI = {
  equipos: {
    list:   (params?: Record<string, unknown>) => api.get('/api/operaciones/equipos-esterilizables/', { params }),
    create: (data: Record<string, unknown>) => api.post('/api/operaciones/equipos-esterilizables/', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/api/operaciones/equipos-esterilizables/${id}/`, data),
  },
  ciclos: {
    list:   (params?: Record<string, unknown>) => api.get('/api/operaciones/ciclos-esterilizacion/', { params }),
    get:    (id: string) => api.get(`/api/operaciones/ciclos-esterilizacion/${id}/`),
    create: (data: Record<string, unknown>) => api.post('/api/operaciones/ciclos-esterilizacion/', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/api/operaciones/ciclos-esterilizacion/${id}/`, data),
  },
}

// ── Mantenimiento Biomédico ───────────────────────────────────────────────────
export const mantenimientoAPI = {
  equipos: {
    list:   (params?: Record<string, unknown>) => api.get('/api/operaciones/equipos-biomedicos/', { params }),
    get:    (id: string) => api.get(`/api/operaciones/equipos-biomedicos/${id}/`),
    create: (data: Record<string, unknown>) => api.post('/api/operaciones/equipos-biomedicos/', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/api/operaciones/equipos-biomedicos/${id}/`, data),
  },
  ordenes: {
    list:   (params?: Record<string, unknown>) => api.get('/api/operaciones/mantenimiento/', { params }),
    get:    (id: string) => api.get(`/api/operaciones/mantenimiento/${id}/`),
    create: (data: Record<string, unknown>) => api.post('/api/operaciones/mantenimiento/', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/api/operaciones/mantenimiento/${id}/`, data),
  },
}

// ── Nutrición ─────────────────────────────────────────────────────────────────
export const dietaAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/operaciones/dietas/', { params }),
  create: (data: Record<string, unknown>) => api.post('/api/operaciones/dietas/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/operaciones/dietas/${id}/`, data),
}

// ── Epidemiología / SIVIGILA ──────────────────────────────────────────────────
export const sivigilaAPI = {
  notificaciones: {
    list:   (params?: Record<string, unknown>) => api.get('/api/epidemiologia/notificaciones/', { params }),
    get:    (id: string) => api.get(`/api/epidemiologia/notificaciones/${id}/`),
    create: (data: Record<string, unknown>) => api.post('/api/epidemiologia/notificaciones/', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/api/epidemiologia/notificaciones/${id}/`, data),
  },
  brotes: {
    list:   (params?: Record<string, unknown>) => api.get('/api/epidemiologia/brotes/', { params }),
    create: (data: Record<string, unknown>) => api.post('/api/epidemiologia/brotes/', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/api/epidemiologia/brotes/${id}/`, data),
  },
}

// ── Contabilidad ──────────────────────────────────────────────────────────────
export const contabilidadAPI = {
  cuentas: {
    list:   (params?: Record<string, unknown>) => api.get('/api/contabilidad/cuentas/', { params }),
    create: (data: Record<string, unknown>) => api.post('/api/contabilidad/cuentas/', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/api/contabilidad/cuentas/${id}/`, data),
  },
  asientos: {
    list:   (params?: Record<string, unknown>) => api.get('/api/contabilidad/asientos/', { params }),
    get:    (id: string) => api.get(`/api/contabilidad/asientos/${id}/`),
    create: (data: Record<string, unknown>) => api.post('/api/contabilidad/asientos/', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/api/contabilidad/asientos/${id}/`, data),
  },
  presupuestos: {
    list:   () => api.get('/api/contabilidad/presupuestos/'),
    create: (data: Record<string, unknown>) => api.post('/api/contabilidad/presupuestos/', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/api/contabilidad/presupuestos/${id}/`, data),
  },
}

// ── Quirófanos ────────────────────────────────────────────────────────────────
export const quirofanosAPI = {
  list:   (params?: Record<string, unknown>) => api.get('/api/historia/quirofanos/', { params }),
  create: (data: Record<string, unknown>) => api.post('/api/historia/quirofanos/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/historia/quirofanos/${id}/`, data),
  delete: (id: string) => api.delete(`/api/historia/quirofanos/${id}/`),
}

// ── Notificaciones ────────────────────────────────────────────────────────────
export const notificacionesAPI = {
  list: () => api.get('/api/notificaciones/'),
  marcarLeida: (id: string) => api.post(`/api/notificaciones/${id}/marcar_leida/`),
  marcarTodasLeidas: () => api.post('/api/notificaciones/marcar_todas_leidas/'),
}
