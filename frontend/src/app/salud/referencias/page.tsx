'use client'
import { useState, useEffect } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card, BuscadorPacienteIngreso } from '@/components/ui'
import { Plus, Send, Clock, FileText, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Referencia {
  id: string
  paciente_nombre: string
  tipo: 'referencia' | 'contrareferencia' | 'interconsulta'
  tipo_display: string
  institucion_destino: string
  servicio_destino: string
  diagnostico_cie10: string
  motivo_referencia: string
  resumen_clinico: string
  prioridad: 'inmediata' | 'urgente' | 'prioritaria' | 'no_urgente'
  prioridad_display: string
  estado: 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'completada'
  estado_display: string
  requiere_ambulancia: boolean
  fecha: string
}

const prioridadBadge = (p: string): 'danger' | 'warning' | 'info' | 'success' => {
  if (p === 'inmediata') return 'danger'
  if (p === 'urgente') return 'warning'
  if (p === 'prioritaria') return 'info'
  return 'success'
}

const estadoBadge = (e: string): 'default' | 'warning' | 'info' | 'success' | 'danger' => {
  if (e === 'borrador') return 'default'
  if (e === 'enviada') return 'info'
  if (e === 'aceptada') return 'success'
  if (e === 'rechazada') return 'danger'
  if (e === 'completada') return 'success'
  return 'default'
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

export default function ReferenciasPage() {
  const [referencias, setReferencias] = useState<Referencia[]>([])
  const [loading, setLoading] = useState(true)
  const [showNueva, setShowNueva] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const cargar = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filtroTipo) params.tipo = filtroTipo
      if (filtroEstado) params.estado = filtroEstado
      const { data } = await api.get('/api/salud/referencias/', { params })
      setReferencias(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [filtroTipo, filtroEstado])

  const generadas = referencias.length
  const enviadas = referencias.filter(r => r.estado === 'enviada' || r.estado === 'aceptada' || r.estado === 'completada').length
  const pendientes = referencias.filter(r => r.estado === 'enviada').length

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Referencia y Contrarreferencia"
        description="Gestión de referencias según Resolución 3047/2008"
        action={
          <Button onClick={() => setShowNueva(true)}>
            <Plus className="w-4 h-4" /> Nueva referencia
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
                <FileText className="w-5 h-5 text-halu-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{generadas}</p>
                <p className="text-xs text-slate-500">Generadas</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{enviadas}</p>
                <p className="text-xs text-slate-500">Enviadas</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{pendientes}</p>
                <p className="text-xs text-slate-500">Pendientes respuesta</p>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20">
          <option value="">Todos los tipos</option>
          <option value="referencia">Referencia</option>
          <option value="contrareferencia">Contrarreferencia</option>
          <option value="interconsulta">Interconsulta</option>
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20">
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="enviada">Enviada</option>
          <option value="aceptada">Aceptada</option>
          <option value="rechazada">Rechazada</option>
          <option value="completada">Completada</option>
        </select>
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-20" />)
        ) : referencias.length === 0 ? (
          <EmptyState title="Sin referencias" description="Las referencias y contrarreferencias aparecerán aquí" />
        ) : (
          referencias.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-slate-900 text-sm">{r.paciente_nombre}</span>
                    <Badge variant="default">{r.tipo_display}</Badge>
                    <Badge variant={prioridadBadge(r.prioridad)}>{r.prioridad_display}</Badge>
                    <Badge variant={estadoBadge(r.estado)}>{r.estado_display}</Badge>
                    {r.requiere_ambulancia && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Requiere ambulancia</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">
                    <span className="font-medium">Destino:</span> {r.institucion_destino}
                    {r.servicio_destino && ` · ${r.servicio_destino}`}
                  </p>
                  {r.diagnostico_cie10 && (
                    <p className="text-xs text-slate-500">CIE-10: {r.diagnostico_cie10}</p>
                  )}
                  {r.motivo_referencia && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{r.motivo_referencia}</p>
                  )}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {r.fecha ? new Date(r.fecha).toLocaleDateString('es-CO') : ''}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {showNueva && (
        <NuevaReferenciaModal
          onClose={() => setShowNueva(false)}
          onSaved={() => { setShowNueva(false); cargar() }}
        />
      )}
    </div>
  )
}

function NuevaReferenciaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    paciente: '', tipo: 'referencia', institucion_destino: '', servicio_destino: '',
    diagnostico_cie10: '', motivo_referencia: '', resumen_clinico: '',
    prioridad: 'prioritaria', requiere_ambulancia: false,
  })
  const [saving, setSaving] = useState(false)
  const [showBuscador, setShowBuscador] = useState(false)
  const [pacienteNombre, setPacienteNombre] = useState('')
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.paciente || !form.institucion_destino || !form.motivo_referencia) {
      toast.error('Paciente, institución destino y motivo son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/salud/referencias/', form)
      toast.success('Referencia registrada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Nueva referencia</h2>
            <p className="text-xs text-slate-500">Res. 3047/2008 · Sistema obligatorio de garantía de calidad</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo *</label>
              <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                <option value="referencia">Referencia</option>
                <option value="contrareferencia">Contrarreferencia</option>
                <option value="interconsulta">Interconsulta</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Institución destino *</label>
              <input value={form.institucion_destino} onChange={set('institucion_destino')} className={INPUT} placeholder="Nombre de la institución" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Servicio destino</label>
              <input value={form.servicio_destino} onChange={set('servicio_destino')} className={INPUT} placeholder="Ej. Cardiología" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Diagnóstico CIE-10</label>
              <input value={form.diagnostico_cie10} onChange={set('diagnostico_cie10')} className={INPUT} placeholder="Código CIE-10" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Prioridad *</label>
              <select value={form.prioridad} onChange={set('prioridad')} className={INPUT}>
                <option value="inmediata">Inmediata (emergencia)</option>
                <option value="urgente">Urgente (&lt;6 horas)</option>
                <option value="prioritaria">Prioritaria (&lt;24 horas)</option>
                <option value="no_urgente">No urgente (programada)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Motivo de referencia *</label>
            <textarea value={form.motivo_referencia} onChange={set('motivo_referencia')} rows={2}
              className={INPUT} placeholder="Motivo principal por el cual se refiere al paciente..." />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Resumen clínico</label>
            <textarea value={form.resumen_clinico} onChange={set('resumen_clinico')} rows={4}
              className={INPUT} placeholder="Historia relevante, diagnósticos previos, tratamientos actuales, exámenes recientes..." />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.requiere_ambulancia}
              onChange={e => setForm(f => ({ ...f, requiere_ambulancia: e.target.checked }))} className="rounded" />
            Requiere traslado en ambulancia
          </label>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Guardar referencia</Button>
        </div>
      </div>
      {showBuscador && (
        <BuscadorPacienteIngreso
          onSelect={(p, ing) => {
            setForm(f => ({ ...f, paciente: p.id, ingreso: ing?.id || '' }))
            setPacienteNombre(p.nombre_completo)
            setShowBuscador(false)
          }}
          onClose={() => setShowBuscador(false)}
        />
      )}
    </div>
  )
}
