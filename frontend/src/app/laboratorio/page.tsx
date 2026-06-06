'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card } from '@/components/ui'
import { Plus, FlaskConical, Clock, CheckCircle2, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Examen {
  cups: string
  nombre: string
  indicacion: string
}

interface SolicitudLab {
  id: string
  paciente_nombre: string
  fecha: string
  examenes: Examen[]
  urgente: boolean
  estado: 'pendiente' | 'en_proceso' | 'resultado' | 'entregado'
  estado_display: string
  indicacion_clinica: string
}

interface ResultadoExamen {
  id: string
  nombre_examen: string
  valor: string
  unidad: string
  referencia_min: string | null
  referencia_max: string | null
  estado_resultado: 'normal' | 'alto' | 'bajo' | 'critico'
  estado_resultado_display: string
}

const estadoBadge = (e: string): 'warning' | 'info' | 'success' | 'default' => {
  if (e === 'pendiente') return 'warning'
  if (e === 'en_proceso') return 'info'
  if (e === 'resultado' || e === 'entregado') return 'success'
  return 'default'
}

const resultadoBadge = (e: string): 'success' | 'warning' | 'danger' | 'default' => {
  if (e === 'normal') return 'success'
  if (e === 'alto' || e === 'bajo') return 'warning'
  if (e === 'critico') return 'danger'
  return 'default'
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

export default function LaboratorioPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudLab[]>([])
  const [loading, setLoading] = useState(true)
  const [showNueva, setShowNueva] = useState(false)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [resultados, setResultados] = useState<Record<string, ResultadoExamen[]>>({})

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/laboratorio/solicitudes/')
      setSolicitudes(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const toggleExpandir = async (sol: SolicitudLab) => {
    if (expandida === sol.id) { setExpandida(null); return }
    setExpandida(sol.id)
    if (sol.estado === 'resultado' || sol.estado === 'entregado') {
      if (!resultados[sol.id]) {
        try {
          const { data } = await api.get(`/api/laboratorio/resultados/?solicitud=${sol.id}`)
          setResultados(prev => ({ ...prev, [sol.id]: data.results ?? data }))
        } catch (e) { toast.error(mensajeError(e)) }
      }
    }
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const solHoy = solicitudes.filter(s => s.fecha?.startsWith(hoy)).length
  const pendientes = solicitudes.filter(s => s.estado === 'pendiente' || s.estado === 'en_proceso').length
  const listos = solicitudes.filter(s => s.estado === 'resultado').length

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Laboratorio clínico"
        description="Solicitudes de exámenes y resultados"
        action={
          <Button onClick={() => setShowNueva(true)}>
            <Plus className="w-4 h-4" /> Nueva solicitud
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-20" />)
        ) : (
          <>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-halu-100 rounded-xl flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-halu-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{solHoy}</p>
                <p className="text-xs text-slate-500">Solicitudes hoy</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{pendientes}</p>
                <p className="text-xs text-slate-500">Pendientes / en proceso</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{listos}</p>
                <p className="text-xs text-slate-500">Resultados listos</p>
              </div>
            </Card>
          </>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-20" />)
        ) : solicitudes.length === 0 ? (
          <EmptyState title="Sin solicitudes" description="Las solicitudes de laboratorio aparecerán aquí" />
        ) : (
          solicitudes.map(sol => (
            <div key={sol.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <button
                className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpandir(sol)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{sol.paciente_nombre}</span>
                      {sol.urgente && <Badge variant="danger">URGENTE</Badge>}
                      <Badge variant={estadoBadge(sol.estado)}>{sol.estado_display}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {sol.examenes?.map(e => e.nombre).join(', ')}
                    </p>
                    <p className="text-xs text-slate-400">
                      {sol.fecha ? new Date(sol.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-slate-400">
                    {expandida === sol.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {expandida === sol.id && (
                <div className="border-t bg-slate-50 p-4">
                  {sol.indicacion_clinica && (
                    <p className="text-xs text-slate-600 mb-3">
                      <span className="font-medium">Indicación:</span> {sol.indicacion_clinica}
                    </p>
                  )}
                  {(sol.estado === 'resultado' || sol.estado === 'entregado') ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">Resultados</p>
                      {resultados[sol.id] ? (
                        <div className="space-y-2">
                          {resultados[sol.id].map(r => (
                            <div key={r.id} className="bg-white rounded-lg border border-slate-100 p-3 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-800">{r.nombre_examen}</p>
                                <p className="text-xs text-slate-500">
                                  {r.valor} {r.unidad}
                                  {r.referencia_min && r.referencia_max && (
                                    <span className="ml-2 text-slate-400">Ref: {r.referencia_min}–{r.referencia_max}</span>
                                  )}
                                </p>
                              </div>
                              <Badge variant={resultadoBadge(r.estado_resultado)}>{r.estado_resultado_display}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-12 bg-white rounded-lg border animate-pulse" />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Exámenes solicitados</p>
                      {sol.examenes?.map((e, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                          <span className="font-medium">{e.nombre}</span>
                          {e.cups && <span className="text-slate-400">CUPS: {e.cups}</span>}
                          {e.indicacion && <span className="text-slate-400">· {e.indicacion}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showNueva && (
        <NuevaSolicitudModal
          onClose={() => setShowNueva(false)}
          onSaved={() => { setShowNueva(false); cargar() }}
        />
      )}
    </div>
  )
}

function NuevaSolicitudModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente: '', urgente: false, indicacion_clinica: '',
  })
  const [examenes, setExamenes] = useState<Examen[]>([{ cups: '', nombre: '', indicacion: '' }])
  const [saving, setSaving] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const setExamen = (i: number, k: keyof Examen, v: string) =>
    setExamenes(ex => ex.map((e, idx) => idx === i ? { ...e, [k]: v } : e))

  const addExamen = () => setExamenes(e => [...e, { cups: '', nombre: '', indicacion: '' }])
  const removeExamen = (i: number) => setExamenes(e => e.filter((_, idx) => idx !== i))

  const guardar = async () => {
    if (!form.paciente) { toast.error('El paciente es requerido'); return }
    const examenesValidos = examenes.filter(e => e.nombre.trim())
    if (examenesValidos.length === 0) { toast.error('Agrega al menos un examen'); return }
    setSaving(true)
    try {
      await api.post('/api/laboratorio/solicitudes/', { ...form, examenes: examenesValidos })
      toast.success('Solicitud registrada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Nueva solicitud de laboratorio</h2>
            <p className="text-xs text-slate-500">Registrar exámenes clínicos</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">ID del paciente *</label>
            <input value={form.paciente} onChange={set('paciente')} className={INPUT} placeholder="UUID del paciente" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.urgente}
              onChange={e => setForm(f => ({ ...f, urgente: e.target.checked }))} className="rounded" />
            <span className="font-medium text-red-600">Solicitud urgente</span>
          </label>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Indicación clínica</label>
            <textarea value={form.indicacion_clinica} onChange={set('indicacion_clinica')} rows={2}
              className={INPUT} placeholder="Motivo clínico de la solicitud..." />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">Exámenes *</label>
              <Button variant="ghost" className="text-xs py-1 px-2" onClick={addExamen}>
                <Plus className="w-3 h-3" /> Agregar examen
              </Button>
            </div>
            <div className="space-y-2">
              {examenes.map((ex, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-3">
                    <input value={ex.cups} onChange={e => setExamen(i, 'cups', e.target.value)}
                      className={INPUT} placeholder="CUPS" />
                  </div>
                  <div className="col-span-4">
                    <input value={ex.nombre} onChange={e => setExamen(i, 'nombre', e.target.value)}
                      className={INPUT} placeholder="Nombre del examen *" />
                  </div>
                  <div className="col-span-4">
                    <input value={ex.indicacion} onChange={e => setExamen(i, 'indicacion', e.target.value)}
                      className={INPUT} placeholder="Indicación específica" />
                  </div>
                  <div className="col-span-1 flex justify-center pt-1">
                    {examenes.length > 1 && (
                      <button onClick={() => removeExamen(i)} className="p-1 text-red-400 hover:text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Registrar solicitud</Button>
        </div>
      </div>
    </div>
  )
}
