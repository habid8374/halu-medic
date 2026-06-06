'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { suscripcionesAPI, consultoriosAdminAPI, mensajeError } from '@/lib/api'
import { PageHeader, Badge, Button } from '@/components/ui'
import toast from 'react-hot-toast'
import {
  Building2, CheckCircle, AlertCircle, Clock, XCircle,
  CreditCard, RefreshCw, Ban, Play, ChevronDown, ChevronUp, Plus, X, ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'

interface Suscripcion {
  id: string
  consultorio: string
  consultorio_nombre: string
  plan: string
  estado: string
  fecha_inicio: string
  fecha_fin: string | null
  dias_restantes: number | null
  esta_activa: boolean
  max_medicos: number
  max_facturas_mes: number
}

const ESTADO_COLOR: Record<string, string> = {
  activa: 'success', prueba: 'info', vencida: 'warning',
  suspendida: 'danger', cancelada: 'default',
}

const PLAN_LABEL: Record<string, string> = {
  basico: 'Básico', pro: 'Pro', clinica: 'Clínica',
}

const FORM_VACIO = {
  nombre: '', nit: '', razon_social: '', telefono: '', email: '',
  municipio_codigo: '11001', slug: '', plan: 'basico',
  admin_nombre: '', admin_apellido: '', admin_cedula: '',
  admin_username: '', admin_email: '', admin_password: '',
}

export default function SuperadminPage() {
  const { usuario } = useAuth()
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([])
  const [loading, setLoading]   = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [accionando, setAccionando] = useState<string | null>(null)
  const [meses, setMeses]   = useState(1)
  const [monto, setMonto]   = useState('')
  const [referencia, setRef] = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)

  useEffect(() => {
    if (!usuario?.permisos.es_superadmin) return
    cargar()
  }, [usuario])

  const cargar = async () => {
    try {
      const { data } = await suscripcionesAPI.list()
      setSuscripciones(data.results || data)
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setLoading(false) }
  }

  const renovar = async (id: string) => {
    if (!monto || !referencia) { toast.error('Completa monto y referencia'); return }
    setAccionando(id)
    try {
      await suscripcionesAPI.renovar(id, { meses, monto: parseFloat(monto), referencia })
      toast.success(`Suscripción renovada ${meses} mes(es)`)
      setMonto(''); setRef(''); setExpandido(null)
      cargar()
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setAccionando(null) }
  }

  const suspender = async (id: string) => {
    setAccionando(id)
    try { await suscripcionesAPI.suspender(id); toast.success('Suspendida'); cargar() }
    catch (err) { toast.error(mensajeError(err)) }
    finally { setAccionando(null) }
  }

  const activar = async (id: string) => {
    setAccionando(id)
    try { await suscripcionesAPI.activar(id); toast.success('Activada'); cargar() }
    catch (err) { toast.error(mensajeError(err)) }
    finally { setAccionando(null) }
  }

  const crearConsultorio = async () => {
    if (!form.nombre || !form.nit || !form.slug || !form.admin_nombre || !form.admin_username || !form.admin_password || !form.admin_cedula || !form.email || !form.admin_email) {
      toast.error('Completa todos los campos obligatorios')
      return
    }
    setCreando(true)
    try {
      const { data } = await consultoriosAdminAPI.crear(form as Record<string, unknown>)
      toast.success(`Consultorio "${form.nombre}" creado. Prueba hasta: ${data.prueba_hasta}`)
      setModalNuevo(false)
      setForm(FORM_VACIO)
      cargar()
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setCreando(false) }
  }

  if (!usuario?.permisos.es_superadmin) return (
    <div className="page-padding flex flex-col items-center justify-center min-h-[400px]">
      <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
      <h2 className="text-xl font-bold text-slate-800">Acceso restringido</h2>
      <p className="text-slate-500 mt-2">Solo el superadmin de Axentia puede acceder aquí.</p>
    </div>
  )

  const activas    = suscripciones.filter(s => s.esta_activa).length
  const vencidas   = suscripciones.filter(s => !s.esta_activa && s.estado !== 'cancelada').length
  const canceladas = suscripciones.filter(s => s.estado === 'cancelada').length

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader title="Superadmin — Axentia" description="Gestión de consultorios y suscripciones SaaS"
        action={
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setModalNuevo(true)}>
              <Plus className="w-4 h-4" />Nuevo Consultorio
            </Button>
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'https://halu-medic-production.up.railway.app'}/admin/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Django Admin
            </a>
            <Button variant="secondary" onClick={cargar}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        } />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Activos',    valor: activas,    icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Vencidos',   valor: vencidas,   icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Cancelados', valor: canceladas, icon: XCircle,     color: 'text-slate-500',  bg: 'bg-slate-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl p-5 border border-slate-100">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', k.bg)}>
              <k.icon className={clsx('w-5 h-5', k.color)} />
            </div>
            <p className="text-3xl font-bold text-slate-900">{k.valor}</p>
            <p className="text-sm text-slate-500 mt-1">Consultorios {k.label.toLowerCase()}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? [...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-2xl" />
        )) : suscripciones.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No hay consultorios registrados aún</p>
          </div>
        ) : suscripciones.map(s => (
          <div key={s.id} className={clsx(
            'bg-white rounded-2xl border transition-all',
            s.esta_activa ? 'border-slate-100' : 'border-amber-100 bg-amber-50/30'
          )}>
            <div className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 bg-halu-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-halu-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900">{s.consultorio_nombre}</span>
                  <Badge variant={ESTADO_COLOR[s.estado] as any} className="capitalize">{s.estado}</Badge>
                  <Badge variant="default">{PLAN_LABEL[s.plan] || s.plan}</Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                  <span>Vence: {s.fecha_fin ? new Date(s.fecha_fin).toLocaleDateString('es-CO') : 'Sin vencimiento'}</span>
                  {s.dias_restantes !== null && (
                    <span className={clsx(s.dias_restantes < 10 ? 'text-red-600 font-semibold' : '')}>
                      {s.dias_restantes >= 0 ? `${s.dias_restantes} días restantes` : `Vencida hace ${Math.abs(s.dias_restantes)} días`}
                    </span>
                  )}
                  <span>Médicos: {s.max_medicos >= 9999 ? 'Ilimitado' : s.max_medicos}</span>
                  <span>Facturas/mes: {s.max_facturas_mes === 0 ? 'Ilimitadas' : s.max_facturas_mes}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {s.estado !== 'suspendida' && s.estado !== 'cancelada' && (
                  <button onClick={() => suspender(s.id)} disabled={!!accionando} title="Suspender"
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                    <Ban className="w-4 h-4" />
                  </button>
                )}
                {(s.estado === 'suspendida' || !s.esta_activa) && s.estado !== 'cancelada' && (
                  <button onClick={() => activar(s.id)} disabled={!!accionando} title="Activar"
                    className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setExpandido(expandido === s.id ? null : s.id)} title="Renovar / Ver más"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-halu-600 hover:bg-halu-50 transition-all border border-halu-100">
                  <CreditCard className="w-3.5 h-3.5" />
                  Renovar
                  {expandido === s.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {expandido === s.id && (
              <div className="border-t border-slate-100 p-5 bg-slate-50/50 rounded-b-2xl">
                <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-halu-600" />
                  Registrar renovación — {s.consultorio_nombre}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Meses</label>
                    <select value={meses} onChange={e => setMeses(+e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500">
                      {[1,2,3,6,12].map(m => <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Monto (COP)</label>
                    <input type="number" value={monto} onChange={e => setMonto(e.target.value)}
                      placeholder="Ej: 150000"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Referencia de pago</label>
                    <input value={referencia} onChange={e => setRef(e.target.value)}
                      placeholder="Nº transacción / recibo"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => renovar(s.id)} loading={accionando === s.id} className="w-full">
                      <CheckCircle className="w-4 h-4" />
                      Confirmar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Modal Nuevo Consultorio */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Nuevo Consultorio</h3>
                <p className="text-sm text-slate-500 mt-0.5">Crear tenant y usuario administrador</p>
              </div>
              <button onClick={() => setModalNuevo(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos del Consultorio</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'nombre',          label: 'Nombre *',        type: 'text' },
                  { key: 'nit',             label: 'NIT *',           type: 'text' },
                  { key: 'razon_social',    label: 'Razón social',    type: 'text' },
                  { key: 'telefono',        label: 'Teléfono',        type: 'text' },
                  { key: 'email',           label: 'Email consultorio *', type: 'email' },
                  { key: 'municipio_codigo',label: 'Cód. municipio',  type: 'text' },
                  { key: 'slug',            label: 'Subdominio * (ej: clinica-sur)', type: 'text' },
                ].map(f => (
                  <div key={f.key} className={f.key === 'slug' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                    <input type={f.type} value={(form as Record<string,string>)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500" />
                    {f.key === 'slug' && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Acceso: <span className="font-mono">{form.slug || 'tu-clinica'}.halumedic.co</span>
                      </p>
                    )}
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Plan</label>
                  <select value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500">
                    <option value="basico">Básico</option>
                    <option value="pro">Pro</option>
                    <option value="clinica">Clínica</option>
                  </select>
                </div>
              </div>

              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Administrador del Consultorio</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'admin_nombre',   label: 'Nombre *',   type: 'text' },
                  { key: 'admin_apellido', label: 'Apellido',   type: 'text' },
                  { key: 'admin_cedula',   label: 'Cédula *',   type: 'text' },
                  { key: 'admin_username', label: 'Usuario *',  type: 'text' },
                  { key: 'admin_email',    label: 'Email *',    type: 'email' },
                  { key: 'admin_password', label: 'Contraseña * (mín. 8 chars)', type: 'password' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                    <input type={f.type} value={(form as Record<string,string>)[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <Button variant="secondary" onClick={() => setModalNuevo(false)}>Cancelar</Button>
              <Button onClick={crearConsultorio} loading={creando}>
                <Building2 className="w-4 h-4" />
                Crear Consultorio
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
