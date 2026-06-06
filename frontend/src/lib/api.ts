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

export const catalogoMedicamentosAPI = {
  search: (q: string, vigentes = true) =>
    api.get('/api/catalogos/medicamentos/', { params: { search: q, vigentes: vigentes ? 'true' : 'false' } }),
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

export default api
