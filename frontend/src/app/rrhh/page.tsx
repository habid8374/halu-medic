'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card } from '@/components/ui'
import {
  Plus, X, Users, FileText, Clock, DollarSign,
  ChevronLeft, ChevronRight, CheckCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const COP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0)

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

const TABS = [
  { id: 'empleados', label: 'Empleados', icon: Users },
  { id: 'contratos', label: 'Contratos', icon: FileText },
  { id: 'turnos', label: 'Turnos', icon: Clock },
  { id: 'nomina', label: 'Nómina', icon: DollarSign },
] as const

type Tab = typeof TABS[number]['id']

interface Empleado { id: string; nombre: string; cargo?: string; contrato_estado?: string; email?: string }
interface Contrato {
  id: string; empleado_nombre: string; tipo: string; salario_basico: number
  fecha_inicio: string; fecha_fin: string; estado: string; estado_display: string
  jornada_horas_semana: number; eps: string; arl: string; pension: string
}
interface Turno {
  id: string; empleado_nombre: string; fecha: string
  tipo: 'manana' | 'tarde' | 'noche' | 'descanso'; tipo_display: string; servicio: string
}
interface Nomina {
  id: string; empleado_nombre: string; periodo_inicio: string; periodo_fin: string
  total_devengado: number; total_descuentos: number; neto_pagar: number
  estado: string; estado_display: string
}

function contratoEstadoBadge(e: string): 'success' | 'warning' | 'danger' | 'default' {
  if (e === 'activo') return 'success'
  if (e === 'por_vencer') return 'warning'
  if (e === 'terminado') return 'danger'
  return 'default'
}

function nominaEstadoBadge(e: string): 'success' | 'warning' | 'default' {
  if (e === 'aprobada') return 'success'
  if (e === 'borrador') return 'warning'
  return 'default'
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const TURNOS_TIPOS = ['manana', 'tarde', 'noche'] as const
const TURNO_LABEL: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' }
const TURNO_COLOR: Record<string, string> = {
  manana: 'bg-amber-100 text-amber-800',
  tarde: 'bg-blue-100 text-blue-800',
  noche: 'bg-indigo-100 text-indigo-800',
  descanso: 'bg-slate-100 text-slate-500',
}

function getWeekDates(base: Date): Date[] {
  const d = new Date(base)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d); dd.setDate(d.getDate() + i); return dd
  })
}

export default function RRHHPage() {
  const [tab, setTab] = useState<Tab>('empleados')
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [nominas, setNominas] = useState<Nomina[]>([])
  const [loading, setLoading] = useState(true)
  const [weekBase, setWeekBase] = useState(new Date())
  const [showContrato, setShowContrato] = useState(false)
  const [showTurno, setShowTurno] = useState(false)
  const [showNomina, setShowNomina] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const [e, c, t, n] = await Promise.allSettled([
        api.get('/api/usuarios/'),
        api.get('/api/rrhh/contratos/'),
        api.get('/api/rrhh/turnos/'),
        api.get('/api/rrhh/nomina/'),
      ])
      if (e.status === 'fulfilled') setEmpleados(e.value.data.results ?? e.value.data)
      if (c.status === 'fulfilled') setContratos(c.value.data.results ?? c.value.data)
      if (t.status === 'fulfilled') setTurnos(t.value.data.results ?? t.value.data)
      if (n.status === 'fulfilled') setNominas(n.value.data.results ?? n.value.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const weekDates = getWeekDates(weekBase)
  const weekStr = weekDates.map(d => d.toISOString().slice(0, 10))

  const contratosActivos = contratos.filter(c => c.estado === 'activo').length
  const contratosVencen = contratos.filter(c => c.estado === 'por_vencer').length
  const contratosTerminados = contratos.filter(c => c.estado === 'terminado').length

  const getTurnosCell = (fechaStr: string, tipo: string) =>
    turnos.filter(t => t.fecha === fechaStr && t.tipo === tipo)

  const aprobarNomina = async (id: string) => {
    try {
      await api.post(`/api/rrhh/nomina/${id}/aprobar/`, {})
      toast.success('Nómina aprobada')
      cargar()
    } catch (e) { toast.error(mensajeError(e)) }
  }

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Recursos Humanos"
        description="Gestión de empleados, contratos, turnos y nómina"
        action={
          tab === 'contratos' ? <Button onClick={() => setShowContrato(true)}><Plus className="w-4 h-4" /> Nuevo contrato</Button>
          : tab === 'turnos' ? <Button onClick={() => setShowTurno(true)}><Plus className="w-4 h-4" /> Asignar turno</Button>
          : tab === 'nomina' ? <Button onClick={() => setShowNomina(true)}><Plus className="w-4 h-4" /> Nueva liquidación</Button>
          : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
              tab === t.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* EMPLEADOS */}
      {tab === 'empleados' && (
        <div className="space-y-2">
          {loading ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-xl border animate-pulse" />
          )) : empleados.length === 0 ? (
            <EmptyState title="Sin empleados" description="No hay empleados registrados" />
          ) : empleados.map(emp => (
            <div key={emp.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
              <div className="w-9 h-9 bg-halu-100 rounded-full flex items-center justify-center text-halu-700 font-bold text-sm flex-shrink-0">
                {emp.nombre?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm">{emp.nombre}</p>
                {emp.cargo && <p className="text-xs text-slate-500">{emp.cargo}</p>}
              </div>
              {emp.contrato_estado && (
                <Badge variant={contratoEstadoBadge(emp.contrato_estado)}>
                  {emp.contrato_estado}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CONTRATOS */}
      {tab === 'contratos' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            {loading ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
            )) : (
              <>
                <Card className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center"><CheckCircle className="w-4 h-4 text-emerald-600" /></div>
                  <div><p className="text-2xl font-bold text-slate-900">{contratosActivos}</p><p className="text-xs text-slate-500">Activos</p></div>
                </Card>
                <Card className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center"><Clock className="w-4 h-4 text-amber-600" /></div>
                  <div><p className="text-2xl font-bold text-amber-700">{contratosVencen}</p><p className="text-xs text-slate-500">Vencen este mes</p></div>
                </Card>
                <Card className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center"><X className="w-4 h-4 text-red-600" /></div>
                  <div><p className="text-2xl font-bold text-red-700">{contratosTerminados}</p><p className="text-xs text-slate-500">Terminados</p></div>
                </Card>
              </>
            )}
          </div>
          <div className="space-y-2">
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl border animate-pulse" />
            )) : contratos.length === 0 ? (
              <EmptyState title="Sin contratos" description="No hay contratos registrados" />
            ) : contratos.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 text-sm">{c.empleado_nombre}</span>
                    <Badge variant={contratoEstadoBadge(c.estado)}>{c.estado_display || c.estado}</Badge>
                    <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{c.tipo}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {COP(c.salario_basico)} · Hasta: {c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString('es-CO') : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* TURNOS */}
      {tab === 'turnos' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d) }}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-700">
              {weekDates[0].toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} –{' '}
              {weekDates[6].toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d) }}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 text-slate-500 font-medium w-20">Turno</th>
                  {weekDates.map((d, i) => (
                    <th key={i} className="p-2 text-center text-slate-600 font-medium border border-slate-100 bg-slate-50 min-w-[100px]">
                      <div>{DIAS[i]}</div>
                      <div className="text-slate-400 font-normal">{d.getDate()}/{d.getMonth() + 1}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TURNOS_TIPOS.map(tipo => (
                  <tr key={tipo}>
                    <td className="p-2 font-medium text-slate-600">{TURNO_LABEL[tipo]}</td>
                    {weekStr.map((fecha, i) => {
                      const celdas = getTurnosCell(fecha, tipo)
                      return (
                        <td key={i} className="p-1 border border-slate-100 align-top min-h-[60px]">
                          <div className="space-y-1 min-h-[40px]">
                            {celdas.map(t => (
                              <div key={t.id} className={clsx('px-1.5 py-0.5 rounded text-xs truncate', TURNO_COLOR[tipo])}>
                                {t.empleado_nombre}
                              </div>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && <div className="h-40 bg-white rounded-xl border animate-pulse mt-2" />}
        </>
      )}

      {/* NÓMINA */}
      {tab === 'nomina' && (
        <div className="space-y-2">
          {loading ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
          )) : nominas.length === 0 ? (
            <EmptyState title="Sin liquidaciones" description="No hay liquidaciones de nómina registradas" />
          ) : nominas.map(n => (
            <div key={n.id} className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 text-sm">{n.empleado_nombre}</span>
                    <Badge variant={nominaEstadoBadge(n.estado)}>{n.estado_display || n.estado}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {n.periodo_inicio} → {n.periodo_fin}
                  </p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-emerald-700">Devengado: {COP(n.total_devengado)}</span>
                    <span className="text-red-600">Descuentos: {COP(n.total_descuentos)}</span>
                    <span className="font-semibold text-slate-900">Neto: {COP(n.neto_pagar)}</span>
                  </div>
                </div>
                {n.estado === 'borrador' && (
                  <Button variant="secondary" onClick={() => aprobarNomina(n.id)} className="text-xs py-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showContrato && (
        <NuevoContratoModal
          onClose={() => setShowContrato(false)}
          onSaved={() => { setShowContrato(false); cargar() }}
        />
      )}
      {showTurno && (
        <AsignarTurnoModal
          onClose={() => setShowTurno(false)}
          onSaved={() => { setShowTurno(false); cargar() }}
        />
      )}
      {showNomina && (
        <NuevaLiquidacionModal
          onClose={() => setShowNomina(false)}
          onSaved={() => { setShowNomina(false); cargar() }}
        />
      )}
    </div>
  )
}

function NuevoContratoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    empleado: '', tipo: 'indefinido', salario_basico: '', fecha_inicio: '', fecha_fin: '',
    jornada_horas_semana: '46', eps: '', arl: '', pension: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.empleado || !form.salario_basico || !form.fecha_inicio) {
      toast.error('Empleado, salario y fecha inicio son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/rrhh/contratos/', {
        ...form,
        salario_basico: Number(form.salario_basico),
        jornada_horas_semana: Number(form.jornada_horas_semana),
      })
      toast.success('Contrato registrado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nuevo contrato</h2><p className="text-xs text-slate-500">Registrar contrato de empleado</p></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">ID del empleado *</label>
            <input value={form.empleado} onChange={set('empleado')} className={INPUT} placeholder="UUID del empleado" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo de contrato</label>
              <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                <option value="indefinido">Indefinido</option>
                <option value="fijo">Término fijo</option>
                <option value="obra">Por obra o labor</option>
                <option value="aprendizaje">Aprendizaje</option>
                <option value="prestacion">Prestación de servicios</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Salario básico (COP) *</label>
              <input type="number" min="0" value={form.salario_basico} onChange={set('salario_basico')} className={INPUT} placeholder="1300000" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha inicio *</label>
              <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha fin</label>
              <input type="date" value={form.fecha_fin} onChange={set('fecha_fin')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Horas semana</label>
              <input type="number" min="1" max="48" value={form.jornada_horas_semana} onChange={set('jornada_horas_semana')} className={INPUT} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">EPS</label>
              <input value={form.eps} onChange={set('eps')} className={INPUT} placeholder="Nombre EPS" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">ARL</label>
              <input value={form.arl} onChange={set('arl')} className={INPUT} placeholder="Nombre ARL" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Pensión</label>
              <input value={form.pension} onChange={set('pension')} className={INPUT} placeholder="Fondo pensión" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Guardar contrato</Button>
        </div>
      </div>
    </div>
  )
}

function AsignarTurnoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    empleado: '', fecha: '', tipo: 'manana', servicio: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.empleado || !form.fecha) { toast.error('Empleado y fecha son requeridos'); return }
    setSaving(true)
    try {
      await api.post('/api/rrhh/turnos/', form)
      toast.success('Turno asignado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Asignar turno</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">ID del empleado *</label>
            <input value={form.empleado} onChange={set('empleado')} className={INPUT} placeholder="UUID del empleado" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha *</label>
              <input type="date" value={form.fecha} onChange={set('fecha')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo de turno</label>
              <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
                <option value="noche">Noche</option>
                <option value="descanso">Descanso</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Servicio</label>
            <input value={form.servicio} onChange={set('servicio')} className={INPUT} placeholder="Ej. Urgencias" />
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Asignar</Button>
        </div>
      </div>
    </div>
  )
}

function NuevaLiquidacionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    empleado: '', periodo_inicio: '', periodo_fin: '', salario_basico: '',
    auxilio_transporte: '', horas_extras_diurnas: '0',
    descuento_salud: '', descuento_pension: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.empleado || !form.periodo_inicio || !form.periodo_fin || !form.salario_basico) {
      toast.error('Empleado, período y salario son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/rrhh/nomina/', {
        ...form,
        salario_basico: Number(form.salario_basico),
        auxilio_transporte: Number(form.auxilio_transporte || 0),
        horas_extras_diurnas: Number(form.horas_extras_diurnas || 0),
        descuento_salud: Number(form.descuento_salud || 0),
        descuento_pension: Number(form.descuento_pension || 0),
      })
      toast.success('Liquidación creada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nueva liquidación de nómina</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">ID del empleado *</label>
            <input value={form.empleado} onChange={set('empleado')} className={INPUT} placeholder="UUID del empleado" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Período inicio *</label>
              <input type="date" value={form.periodo_inicio} onChange={set('periodo_inicio')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Período fin *</label>
              <input type="date" value={form.periodo_fin} onChange={set('periodo_fin')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Salario básico (COP) *</label>
              <input type="number" min="0" value={form.salario_basico} onChange={set('salario_basico')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Auxilio transporte</label>
              <input type="number" min="0" value={form.auxilio_transporte} onChange={set('auxilio_transporte')} className={INPUT} placeholder="162000" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Horas extras diurnas</label>
              <input type="number" min="0" value={form.horas_extras_diurnas} onChange={set('horas_extras_diurnas')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Descuento salud (4%)</label>
              <input type="number" min="0" value={form.descuento_salud} onChange={set('descuento_salud')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Descuento pensión (4%)</label>
              <input type="number" min="0" value={form.descuento_pension} onChange={set('descuento_pension')} className={INPUT} />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Crear liquidación</Button>
        </div>
      </div>
    </div>
  )
}
