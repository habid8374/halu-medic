'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card } from '@/components/ui'
import { Plus, X, FlaskConical, CheckCircle, XCircle, Loader2, CheckSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

interface CicloEsterilizacion {
  id: string
  numero_ciclo: string
  metodo: string
  metodo_display: string
  equipo_autoclave: string
  fecha_hora_inicio: string
  fecha_hora_fin?: string
  resultado: 'aprobado' | 'rechazado' | 'en_proceso' | null
  resultado_display: string
  indicador_biologico: string
  indicador_biologico_display: string
  indicador_quimico: string
  temperatura_programada: number
  tiempo_ciclo_min: number
}

function resultadoColor(r: string | null) {
  if (r === 'aprobado') return 'border-l-4 border-emerald-500 bg-emerald-50/30'
  if (r === 'rechazado') return 'border-l-4 border-red-500 bg-red-50/30'
  if (r === 'en_proceso') return 'border-l-4 border-amber-400 bg-amber-50/30'
  return 'border-l-4 border-slate-200'
}

function resultadoBadge(r: string | null): 'success' | 'danger' | 'warning' | 'default' {
  if (r === 'aprobado') return 'success'
  if (r === 'rechazado') return 'danger'
  if (r === 'en_proceso') return 'warning'
  return 'default'
}

export default function EsterilizacionPage() {
  const [ciclos, setCiclos] = useState<CicloEsterilizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [showNuevo, setShowNuevo] = useState(false)
  const [finalizando, setFinalizando] = useState<CicloEsterilizacion | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/operaciones/ciclos-esterilizacion/')
      setCiclos(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const hoy = new Date().toISOString().slice(0, 10)
  const ciclosHoy = ciclos.filter(c => c.fecha_hora_inicio?.startsWith(hoy))
  const aprobados = ciclosHoy.filter(c => c.resultado === 'aprobado').length
  const rechazados = ciclosHoy.filter(c => c.resultado === 'rechazado').length
  const enProceso = ciclos.filter(c => c.resultado === 'en_proceso').length

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Esterilización"
        description="Control de ciclos de esterilización y autoclaves"
        action={
          <Button onClick={() => setShowNuevo(true)}>
            <Plus className="w-4 h-4" /> Nuevo ciclo
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
        )) : (
          <>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-halu-100 rounded-xl flex items-center justify-center"><FlaskConical className="w-4 h-4 text-halu-600" /></div>
              <div><p className="text-2xl font-bold text-slate-900">{ciclosHoy.length}</p><p className="text-xs text-slate-500">Ciclos hoy</p></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center"><CheckCircle className="w-4 h-4 text-emerald-600" /></div>
              <div><p className="text-2xl font-bold text-emerald-700">{aprobados}</p><p className="text-xs text-slate-500">Aprobados</p></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center"><XCircle className="w-4 h-4 text-red-600" /></div>
              <div><p className="text-2xl font-bold text-red-700">{rechazados}</p><p className="text-xs text-slate-500">Rechazados</p></div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center"><Loader2 className="w-4 h-4 text-amber-600" /></div>
              <div><p className="text-2xl font-bold text-amber-700">{enProceso}</p><p className="text-xs text-slate-500">En proceso</p></div>
            </Card>
          </>
        )}
      </div>

      {/* Lista ciclos */}
      <div className="space-y-2">
        {loading ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-xl border animate-pulse" />
        )) : ciclos.length === 0 ? (
          <EmptyState title="Sin ciclos" description="No hay ciclos de esterilización registrados" />
        ) : ciclos.map(c => (
          <div key={c.id} className={clsx('bg-white rounded-xl border border-slate-100 p-4 flex items-start gap-4', resultadoColor(c.resultado))}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 text-sm">Ciclo #{c.numero_ciclo}</span>
                <Badge variant={resultadoBadge(c.resultado)}>{c.resultado_display || c.resultado || 'En proceso'}</Badge>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{c.metodo_display || c.metodo}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Autoclave: {c.equipo_autoclave} · {c.temperatura_programada}°C · {c.tiempo_ciclo_min} min
              </p>
              <p className="text-xs text-slate-400">
                Inicio: {c.fecha_hora_inicio ? new Date(c.fecha_hora_inicio).toLocaleString('es-CO') : '—'}
              </p>
              {(c.indicador_biologico || c.indicador_quimico) && (
                <div className="flex gap-2 mt-1">
                  {c.indicador_biologico && (
                    <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium',
                      c.indicador_biologico === 'positivo' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    )}>
                      Bio: {c.indicador_biologico_display || c.indicador_biologico}
                    </span>
                  )}
                  {c.indicador_quimico && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700">
                      Quím: {c.indicador_quimico}
                    </span>
                  )}
                </div>
              )}
            </div>
            {c.resultado === 'en_proceso' && (
              <Button variant="secondary" onClick={() => setFinalizando(c)} className="text-xs py-1 flex-shrink-0">
                <CheckSquare className="w-3.5 h-3.5" /> Finalizar
              </Button>
            )}
          </div>
        ))}
      </div>

      {showNuevo && (
        <NuevoCicloModal
          onClose={() => setShowNuevo(false)}
          onSaved={() => { setShowNuevo(false); cargar() }}
        />
      )}
      {finalizando && (
        <FinalizarCicloModal
          ciclo={finalizando}
          onClose={() => setFinalizando(null)}
          onSaved={() => { setFinalizando(null); cargar() }}
        />
      )}
    </div>
  )
}

function NuevoCicloModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    equipos: '', metodo: 'autoclave_vapor', equipo_autoclave: '',
    temperatura_programada: '134', tiempo_ciclo_min: '18',
    fecha_hora_inicio: new Date().toISOString().slice(0, 16),
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.equipo_autoclave || !form.fecha_hora_inicio) {
      toast.error('Autoclave y fecha son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/operaciones/ciclos-esterilizacion/', {
        ...form,
        temperatura_programada: Number(form.temperatura_programada),
        tiempo_ciclo_min: Number(form.tiempo_ciclo_min),
        resultado: 'en_proceso',
      })
      toast.success('Ciclo iniciado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Nuevo ciclo de esterilización</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Equipos a esterilizar</label>
            <input value={form.equipos} onChange={set('equipos')} className={INPUT} placeholder="Ej. Set cirugia, Instrumental endoscopia" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Método</label>
              <select value={form.metodo} onChange={set('metodo')} className={INPUT}>
                <option value="autoclave_vapor">Autoclave vapor</option>
                <option value="oxido_etileno">Óxido de etileno</option>
                <option value="plasma_peróxido">Plasma peróxido</option>
                <option value="calor_seco">Calor seco</option>
                <option value="quimico">Químico</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Equipo autoclave *</label>
              <input value={form.equipo_autoclave} onChange={set('equipo_autoclave')} className={INPUT} placeholder="Ej. Autoclave 1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Temperatura (°C)</label>
              <input type="number" value={form.temperatura_programada} onChange={set('temperatura_programada')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tiempo ciclo (min)</label>
              <input type="number" min="1" value={form.tiempo_ciclo_min} onChange={set('tiempo_ciclo_min')} className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha y hora inicio *</label>
              <input type="datetime-local" value={form.fecha_hora_inicio} onChange={set('fecha_hora_inicio')} className={INPUT} />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Iniciar ciclo</Button>
        </div>
      </div>
    </div>
  )
}

function FinalizarCicloModal({ ciclo, onClose, onSaved }: {
  ciclo: CicloEsterilizacion; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    resultado: 'aprobado',
    indicador_biologico: 'negativo',
    indicador_quimico: 'viro',
    fecha_hora_fin: new Date().toISOString().slice(0, 16),
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    setSaving(true)
    try {
      await api.patch(`/api/operaciones/ciclos-esterilizacion/${ciclo.id}/`, form)
      toast.success('Ciclo finalizado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 className="font-bold text-slate-900">Finalizar ciclo #{ciclo.numero_ciclo}</h2></div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Resultado</label>
              <select value={form.resultado} onChange={set('resultado')} className={INPUT}>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Indicador biológico</label>
              <select value={form.indicador_biologico} onChange={set('indicador_biologico')} className={INPUT}>
                <option value="negativo">Negativo (OK)</option>
                <option value="positivo">Positivo (FALLA)</option>
                <option value="no_aplica">No aplica</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Indicador químico</label>
              <input value={form.indicador_quimico} onChange={set('indicador_quimico')} className={INPUT} placeholder="Ej. Viro" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Fecha y hora fin</label>
              <input type="datetime-local" value={form.fecha_hora_fin} onChange={set('fecha_hora_fin')} className={INPUT} />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Registrar resultado</Button>
        </div>
      </div>
    </div>
  )
}
