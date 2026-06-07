'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card, BuscadorPacienteIngreso } from '@/components/ui'
import { Plus, Activity, X, CheckSquare, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface PlanRehabilitacion {
  id: string
  paciente_nombre: string
  tipo_terapia: string
  tipo_terapia_display: string
  diagnostico: string
  objetivo_general: string
  numero_sesiones_prescritas: number
  sesiones_completadas: number
  frecuencia_semanal: number
  fecha_inicio: string
  estado: string
  estado_display: string
}

interface SesionRehabilitacion {
  id: string
  plan: string
  plan_detalle?: { paciente_nombre: string; tipo_terapia_display: string }
  numero_sesion: number
  fecha_hora: string
  actividades_realizadas: string
  evolucion: string
  asistio: boolean
  terapeuta_nombre: string
}

const TERAPIA_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  fisioterapia:   { bg: 'bg-teal-100',   text: 'text-teal-800',   dot: 'bg-teal-500' },
  ocupacional:    { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  fonoaudiologia: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  psicologia:     { bg: 'bg-pink-100',   text: 'text-pink-800',   dot: 'bg-pink-500' },
  nutricion:      { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

export default function RehabilitacionPage() {
  const [planes, setPlanes] = useState<PlanRehabilitacion[]>([])
  const [sesiones, setSesiones] = useState<SesionRehabilitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuevoPlan, setShowNuevoPlan] = useState(false)
  const [planSesion, setPlanSesion] = useState<PlanRehabilitacion | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const [planRes, sesRes] = await Promise.all([
        api.get('/api/salud/rehabilitacion/planes/'),
        api.get('/api/salud/rehabilitacion/sesiones/'),
      ])
      setPlanes(planRes.data.results ?? planRes.data)
      setSesiones(sesRes.data.results ?? sesRes.data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const planesActivos = planes.filter(p => p.estado === 'activo' || !p.estado)
  const sesioneRecientes = sesiones.slice(0, 10)

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Rehabilitación"
        description="Planes terapéuticos y registro de sesiones"
        action={
          <Button onClick={() => setShowNuevoPlan(true)}>
            <Plus className="w-4 h-4" /> Nuevo plan
          </Button>
        }
      />

      {/* Planes activos */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Planes activos</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-36" />)}
          </div>
        ) : planesActivos.length === 0 ? (
          <EmptyState title="Sin planes activos" description="Los planes de rehabilitación aparecerán aquí" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {planesActivos.map(plan => {
              const style = TERAPIA_STYLES[plan.tipo_terapia] || { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' }
              const pct = plan.numero_sesiones_prescritas > 0
                ? Math.round((plan.sesiones_completadas / plan.numero_sesiones_prescritas) * 100)
                : 0
              return (
                <div key={plan.id} className="bg-white rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', style.bg, style.text)}>
                          {plan.tipo_terapia_display}
                        </span>
                        {plan.estado_display && (
                          <Badge variant="default">{plan.estado_display}</Badge>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 text-sm">{plan.paciente_nombre}</p>
                      {plan.diagnostico && <p className="text-xs text-slate-500">{plan.diagnostico}</p>}
                    </div>
                    <Button variant="ghost" className="text-xs py-1 px-2 flex-shrink-0"
                      onClick={() => setPlanSesion(plan)}>
                      <Plus className="w-3 h-3" /> Sesión
                    </Button>
                  </div>

                  {plan.objetivo_general && (
                    <p className="text-xs text-slate-600 mb-3 line-clamp-2">{plan.objetivo_general}</p>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Sesiones completadas</span>
                      <span className="font-medium">{plan.sesiones_completadas}/{plan.numero_sesiones_prescritas}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={clsx('h-full rounded-full transition-all', style.dot)} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{plan.frecuencia_semanal}x/semana · desde {plan.fecha_inicio ? new Date(plan.fecha_inicio).toLocaleDateString('es-CO') : ''}</span>
                      <span className={clsx('font-semibold', style.text)}>{pct}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sesiones recientes */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Sesiones recientes</h2>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-16" />)
        ) : sesioneRecientes.length === 0 ? (
          <EmptyState title="Sin sesiones registradas" description="Las sesiones de terapia aparecerán aquí" />
        ) : (
          <div className="space-y-2">
            {sesioneRecientes.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3">
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  s.asistio ? 'bg-emerald-100' : 'bg-red-100')}>
                  <CheckSquare className={clsx('w-4 h-4', s.asistio ? 'text-emerald-600' : 'text-red-500')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {s.plan_detalle?.paciente_nombre} · Sesión #{s.numero_sesion}
                    </span>
                    {s.plan_detalle?.tipo_terapia_display && (
                      <span className="text-xs text-slate-500">{s.plan_detalle.tipo_terapia_display}</span>
                    )}
                  </div>
                  {s.evolucion && <p className="text-xs text-slate-500 line-clamp-1">{s.evolucion}</p>}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {s.fecha_hora ? new Date(s.fecha_hora).toLocaleDateString('es-CO') : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNuevoPlan && (
        <NuevoPlanModal
          onClose={() => setShowNuevoPlan(false)}
          onSaved={() => { setShowNuevoPlan(false); cargar() }}
        />
      )}
      {planSesion && (
        <NuevaSesionModal
          plan={planSesion}
          onClose={() => setPlanSesion(null)}
          onSaved={() => { setPlanSesion(null); cargar() }}
        />
      )}
    </div>
  )
}

function NuevoPlanModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente: '', tipo_terapia: 'fisioterapia', diagnostico: '',
    objetivo_general: '', numero_sesiones_prescritas: '',
    frecuencia_semanal: '3', fecha_inicio: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [showBuscador, setShowBuscador] = useState(false)
  const [pacienteNombre, setPacienteNombre] = useState('')
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.paciente || !form.objetivo_general || !form.numero_sesiones_prescritas) {
      toast.error('Paciente, objetivo y número de sesiones son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/salud/rehabilitacion/planes/', {
        ...form,
        numero_sesiones_prescritas: Number(form.numero_sesiones_prescritas),
        frecuencia_semanal: Number(form.frecuencia_semanal),
      })
      toast.success('Plan de rehabilitación creado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Nuevo plan de rehabilitación</h2>
            <p className="text-xs text-slate-500">Crear plan terapéutico para el paciente</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Paciente *</label>
            <button
              type="button"
              onClick={() => setShowBuscador(true)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-left flex items-center justify-between hover:border-halu-400 transition-colors"
            >
              {pacienteNombre ? (
                <span className="text-slate-900 font-medium">{pacienteNombre}</span>
              ) : (
                <span className="text-slate-400">Buscar paciente por nombre o documento...</span>
              )}
              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tipo de terapia *</label>
            <select value={form.tipo_terapia} onChange={set('tipo_terapia')} className={INPUT}>
              <option value="fisioterapia">Fisioterapia</option>
              <option value="ocupacional">Terapia ocupacional</option>
              <option value="fonoaudiologia">Fonoaudiología</option>
              <option value="psicologia">Psicología</option>
              <option value="nutricion">Nutrición y dietética</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Diagnóstico</label>
            <input value={form.diagnostico} onChange={set('diagnostico')} className={INPUT} placeholder="Diagnóstico de base" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Objetivo general *</label>
            <textarea value={form.objetivo_general} onChange={set('objetivo_general')} rows={3}
              className={INPUT} placeholder="Objetivos terapéuticos del plan..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">N° sesiones prescritas *</label>
              <input type="number" min="1" value={form.numero_sesiones_prescritas} onChange={set('numero_sesiones_prescritas')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Frecuencia semanal</label>
              <input type="number" min="1" max="7" value={form.frecuencia_semanal} onChange={set('frecuencia_semanal')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={INPUT} />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Crear plan</Button>
        </div>
      </div>
    </div>
  )
}

function NuevaSesionModal({ plan, onClose, onSaved }: {
  plan: PlanRehabilitacion
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    numero_sesion: String((plan.sesiones_completadas ?? 0) + 1),
    fecha_hora: new Date().toISOString().slice(0, 16),
    actividades_realizadas: '', evolucion: '', asistio: true,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    setSaving(true)
    try {
      await api.post('/api/salud/rehabilitacion/sesiones/', {
        ...form, plan: plan.id,
        numero_sesion: Number(form.numero_sesion),
      })
      toast.success('Sesión registrada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Registrar sesión</h2>
            <p className="text-xs text-slate-500">{plan.paciente_nombre} · {plan.tipo_terapia_display}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">N° de sesión</label>
              <input type="number" min="1" value={form.numero_sesion} onChange={set('numero_sesion')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha y hora</label>
              <input type="datetime-local" value={form.fecha_hora} onChange={set('fecha_hora')} className={INPUT} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.asistio}
              onChange={e => setForm(f => ({ ...f, asistio: e.target.checked }))} className="rounded" />
            El paciente asistió a la sesión
          </label>
          {form.asistio && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Actividades realizadas</label>
                <textarea value={form.actividades_realizadas} onChange={set('actividades_realizadas')} rows={3}
                  className={INPUT} placeholder="Técnicas y actividades realizadas durante la sesión..." />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Evolución del paciente</label>
                <textarea value={form.evolucion} onChange={set('evolucion')} rows={3}
                  className={INPUT} placeholder="Evolución clínica, logros, dificultades observadas..." />
              </div>
            </>
          )}
          {!form.asistio && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              Se registrará la inasistencia del paciente a la sesión programada.
            </div>
          )}
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Guardar sesión</Button>
        </div>
      </div>
    </div>
  )
}
