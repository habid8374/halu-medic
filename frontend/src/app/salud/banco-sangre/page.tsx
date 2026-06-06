'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card } from '@/components/ui'
import { Plus, Droplets, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface UnidadHemoderivado {
  id: string
  tipo: string
  tipo_display: string
  grupo_sanguineo: string
  rh: '+' | '-'
  numero_unidad: string
  banco_origen: string
  fecha_vencimiento: string
  volumen_ml: number
  estado: 'disponible' | 'reservada' | 'transfundida' | 'vencida' | 'descartada'
  estado_display: string
}

interface SolicitudSangre {
  id: string
  paciente_nombre: string
  tipo_solicitado: string
  tipo_display: string
  cantidad_unidades: number
  grupo_requerido: string
  rh_requerido: string
  indicacion_clinica: string
  urgente: boolean
  estado: 'pendiente' | 'aprobada' | 'entregada' | 'rechazada'
  estado_display: string
  fecha: string
}

const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const estadoUnidadBadge = (e: string): 'success' | 'warning' | 'info' | 'default' | 'danger' => {
  if (e === 'disponible') return 'success'
  if (e === 'reservada') return 'warning'
  if (e === 'transfundida') return 'default'
  if (e === 'vencida' || e === 'descartada') return 'danger'
  return 'default'
}

const estadoSolicitudBadge = (e: string): 'warning' | 'info' | 'success' | 'danger' | 'default' => {
  if (e === 'pendiente') return 'warning'
  if (e === 'aprobada') return 'info'
  if (e === 'entregada') return 'success'
  if (e === 'rechazada') return 'danger'
  return 'default'
}

const grupoColor = (grupo: string) => {
  if (grupo.startsWith('O')) return 'bg-emerald-100 text-emerald-800'
  if (grupo.startsWith('A')) return 'bg-blue-100 text-blue-800'
  if (grupo.startsWith('B')) return 'bg-amber-100 text-amber-800'
  if (grupo.startsWith('AB')) return 'bg-purple-100 text-purple-800'
  return 'bg-slate-100 text-slate-700'
}

const diasParaVencer = (fecha: string) => {
  const diff = new Date(fecha).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

export default function BancoSangrePage() {
  const [tab, setTab] = useState<'inventario' | 'solicitudes'>('inventario')
  const [unidades, setUnidades] = useState<UnidadHemoderivado[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudSangre[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuevaUnidad, setShowNuevaUnidad] = useState(false)
  const [showNuevaSolicitud, setShowNuevaSolicitud] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const [uRes, sRes] = await Promise.all([
        api.get('/api/salud/banco-sangre/unidades/'),
        api.get('/api/salud/banco-sangre/solicitudes/'),
      ])
      setUnidades(uRes.data.results ?? uRes.data)
      setSolicitudes(sRes.data.results ?? sRes.data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  // KPIs por grupo sanguíneo
  const disponiblePorGrupo = TIPOS_SANGRE.map(g => {
    const [gr, rh] = g.endsWith('+') ? [g.slice(0, -1), '+'] : [g.slice(0, -1), '-']
    const count = unidades.filter(u =>
      u.estado === 'disponible' && u.grupo_sanguineo === gr && u.rh === rh
    ).length
    return { grupo: g, count }
  })

  const TABS = [
    { id: 'inventario', label: 'Inventario' },
    { id: 'solicitudes', label: 'Solicitudes' },
  ] as const

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Banco de sangre"
        description="Inventario de hemoderivados y solicitudes de transfusión"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowNuevaUnidad(true)}>
              <Plus className="w-4 h-4" /> Ingresar unidad
            </Button>
            <Button onClick={() => setShowNuevaSolicitud(true)}>
              <Plus className="w-4 h-4" /> Nueva solicitud
            </Button>
          </div>
        }
      />

      {/* KPIs por grupo sanguíneo */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-5">
        <h2 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Unidades disponibles por grupo</h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))
          ) : (
            disponiblePorGrupo.map(({ grupo, count }) => (
              <div key={grupo} className={clsx('rounded-xl p-3 text-center', grupoColor(grupo))}>
                <p className="text-xs font-bold">{grupo}</p>
                <p className="text-2xl font-extrabold">{count}</p>
                <p className="text-xs opacity-70">unid.</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Inventario */}
      {tab === 'inventario' && (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-20" />)
          ) : unidades.length === 0 ? (
            <EmptyState title="Sin unidades en inventario" description="Ingresa unidades de hemoderivados para comenzar" />
          ) : (
            unidades.map(u => {
              const dias = u.fecha_vencimiento ? diasParaVencer(u.fecha_vencimiento) : 99
              return (
                <div key={u.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
                  <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm',
                    grupoColor(`${u.grupo_sanguineo}${u.rh}`))}>
                    {u.grupo_sanguineo}{u.rh}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-medium text-slate-900 text-sm">{u.tipo_display}</span>
                      <Badge variant={estadoUnidadBadge(u.estado)}>{u.estado_display}</Badge>
                      {dias <= 7 && u.estado === 'disponible' && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertTriangle className="w-3 h-3" /> Vence en {dias}d
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      N° {u.numero_unidad}
                      {u.banco_origen && ` · ${u.banco_origen}`}
                      {u.volumen_ml && ` · ${u.volumen_ml} ml`}
                    </p>
                    <p className="text-xs text-slate-400">
                      Vence: {u.fecha_vencimiento ? new Date(u.fecha_vencimiento).toLocaleDateString('es-CO') : '—'}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Solicitudes */}
      {tab === 'solicitudes' && (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-20" />)
          ) : solicitudes.length === 0 ? (
            <EmptyState title="Sin solicitudes" description="Las solicitudes de hemoderivados aparecerán aquí" />
          ) : (
            solicitudes.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-900 text-sm">{s.paciente_nombre}</span>
                      {s.urgente && <Badge variant="danger">URGENTE</Badge>}
                      <Badge variant={estadoSolicitudBadge(s.estado)}>{s.estado_display}</Badge>
                    </div>
                    <p className="text-xs text-slate-600">
                      {s.tipo_display} · {s.cantidad_unidades} unidad{s.cantidad_unidades !== 1 ? 'es' : ''}
                      {s.grupo_requerido && ` · Grupo ${s.grupo_requerido}${s.rh_requerido}`}
                    </p>
                    {s.indicacion_clinica && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.indicacion_clinica}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {s.fecha ? new Date(s.fecha).toLocaleDateString('es-CO') : ''}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showNuevaUnidad && (
        <NuevaUnidadModal
          onClose={() => setShowNuevaUnidad(false)}
          onSaved={() => { setShowNuevaUnidad(false); cargar() }}
        />
      )}
      {showNuevaSolicitud && (
        <NuevaSolicitudModal
          onClose={() => setShowNuevaSolicitud(false)}
          onSaved={() => { setShowNuevaSolicitud(false); cargar() }}
        />
      )}
    </div>
  )
}

function NuevaUnidadModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    tipo: 'globulos_rojos', grupo_sanguineo: 'O', rh: '+',
    numero_unidad: '', banco_origen: '', fecha_vencimiento: '',
    volumen_ml: '250',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.numero_unidad || !form.fecha_vencimiento) {
      toast.error('Número de unidad y fecha de vencimiento son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/salud/banco-sangre/unidades/', {
        ...form, volumen_ml: Number(form.volumen_ml),
      })
      toast.success('Unidad ingresada al inventario')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Ingresar unidad</h2>
            <p className="text-xs text-slate-500">Registrar unidad de hemoderivado al inventario</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo de hemoderivado</label>
              <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                <option value="globulos_rojos">Glóbulos rojos empaquetados</option>
                <option value="plasma">Plasma fresco congelado</option>
                <option value="plaquetas">Concentrado de plaquetas</option>
                <option value="crioprecipitado">Crioprecipitado</option>
                <option value="sangre_total">Sangre total</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Número de unidad *</label>
              <input value={form.numero_unidad} onChange={set('numero_unidad')} className={INPUT} placeholder="Código de trazabilidad" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Grupo sanguíneo</label>
              <select value={form.grupo_sanguineo} onChange={set('grupo_sanguineo')} className={INPUT}>
                <option>A</option><option>B</option><option>AB</option><option>O</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Factor RH</label>
              <select value={form.rh} onChange={set('rh')} className={INPUT}>
                <option value="+">Positivo (+)</option>
                <option value="-">Negativo (-)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Banco de origen</label>
              <input value={form.banco_origen} onChange={set('banco_origen')} className={INPUT} placeholder="Nombre del banco" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Volumen (ml)</label>
              <input type="number" min="0" value={form.volumen_ml} onChange={set('volumen_ml')} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Fecha de vencimiento *</label>
            <input type="date" value={form.fecha_vencimiento} onChange={set('fecha_vencimiento')} className={INPUT} />
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Ingresar al inventario</Button>
        </div>
      </div>
    </div>
  )
}

function NuevaSolicitudModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente: '', tipo_solicitado: 'globulos_rojos', cantidad_unidades: '1',
    grupo_requerido: '', rh_requerido: '', indicacion_clinica: '', urgente: false,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.paciente || !form.indicacion_clinica) {
      toast.error('Paciente e indicación clínica son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/salud/banco-sangre/solicitudes/', {
        ...form,
        cantidad_unidades: Number(form.cantidad_unidades),
      })
      toast.success('Solicitud registrada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Nueva solicitud de hemoderivados</h2>
            <p className="text-xs text-slate-500">Solicitar unidades para transfusión</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">ID del paciente *</label>
            <input value={form.paciente} onChange={set('paciente')} className={INPUT} placeholder="UUID del paciente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo solicitado</label>
              <select value={form.tipo_solicitado} onChange={set('tipo_solicitado')} className={INPUT}>
                <option value="globulos_rojos">Glóbulos rojos</option>
                <option value="plasma">Plasma fresco congelado</option>
                <option value="plaquetas">Plaquetas</option>
                <option value="crioprecipitado">Crioprecipitado</option>
                <option value="sangre_total">Sangre total</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Cantidad de unidades</label>
              <input type="number" min="1" value={form.cantidad_unidades} onChange={set('cantidad_unidades')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Grupo requerido</label>
              <select value={form.grupo_requerido} onChange={set('grupo_requerido')} className={INPUT}>
                <option value="">Compatible cualquier grupo</option>
                <option>A</option><option>B</option><option>AB</option><option>O</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">RH requerido</label>
              <select value={form.rh_requerido} onChange={set('rh_requerido')} className={INPUT}>
                <option value="">Compatible cualquier RH</option>
                <option value="+">Positivo (+)</option>
                <option value="-">Negativo (-)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Indicación clínica *</label>
            <textarea value={form.indicacion_clinica} onChange={set('indicacion_clinica')} rows={3}
              className={INPUT} placeholder="Justificación médica para la transfusión, diagnóstico, hemoglobina..." />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.urgente}
              onChange={e => setForm(f => ({ ...f, urgente: e.target.checked }))} className="rounded" />
            <span className="font-medium text-red-600">Solicitud urgente</span>
          </label>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Registrar solicitud</Button>
        </div>
      </div>
    </div>
  )
}
