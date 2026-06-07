'use client'
import { useState } from 'react'
import api, { mensajeError } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, BuscadorPacienteIngreso } from '@/components/ui'
import { Search, X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Paciente {
  id: string
  nombre_completo: string
  numero_documento: string
}

interface ProcedimientoDental {
  id: string
  diente: number
  cara: string
  descripcion_diagnostico: string
  descripcion_tratamiento: string
  cups: string
  estado: 'planificado' | 'en_proceso' | 'completado' | 'cancelado'
  estado_display: string
  valor_cobrado: string
  fecha: string
}

const CUADRANTE_1 = [18, 17, 16, 15, 14, 13, 12, 11]
const CUADRANTE_2 = [21, 22, 23, 24, 25, 26, 27, 28]
const CUADRANTE_3 = [31, 32, 33, 34, 35, 36, 37, 38]
const CUADRANTE_4 = [48, 47, 46, 45, 44, 43, 42, 41]

const estadoBadge = (e: string): 'default' | 'info' | 'success' | 'danger' => {
  if (e === 'planificado') return 'default'
  if (e === 'en_proceso') return 'info'
  if (e === 'completado') return 'success'
  if (e === 'cancelado') return 'danger'
  return 'default'
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

export default function OdontologiaPage() {
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null)
  const [procedimientos, setProcedimientos] = useState<ProcedimientoDental[]>([])
  const [loading, setLoading] = useState(false)
  const [dienteModal, setDienteModal] = useState<number | null>(null)
  const [showBuscador, setShowBuscador] = useState(false)

  const seleccionarPaciente = async (p: Paciente) => {
    setPacienteSeleccionado(p)
    setShowBuscador(false)
    setLoading(true)
    try {
      const { data } = await api.get(`/api/salud/odontologia/procedimientos/?paciente=${p.id}`)
      setProcedimientos(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setLoading(false) }
  }

  // Obtiene el color del diente según procedimientos
  const dienteColor = (diente: number) => {
    const procs = procedimientos.filter(p => p.diente === diente)
    if (procs.length === 0) return 'bg-slate-100 hover:bg-slate-200 border-slate-200'
    if (procs.some(p => p.estado === 'en_proceso')) return 'bg-blue-100 hover:bg-blue-200 border-blue-300'
    if (procs.some(p => p.estado === 'planificado')) return 'bg-amber-100 hover:bg-amber-200 border-amber-300'
    if (procs.every(p => p.estado === 'completado')) return 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300'
    return 'bg-slate-100 hover:bg-slate-200 border-slate-200'
  }

  const renderCuadrante = (dientes: number[], label: string) => (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-slate-400 font-medium mb-1">{label}</span>
      <div className="flex gap-1">
        {dientes.map(d => (
          <button
            key={d}
            onClick={() => pacienteSeleccionado && setDienteModal(d)}
            disabled={!pacienteSeleccionado}
            title={`Diente ${d}`}
            className={clsx(
              'w-9 h-9 rounded-lg border text-xs font-semibold transition-all',
              pacienteSeleccionado
                ? clsx(dienteColor(d), 'cursor-pointer')
                : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed',
              'text-slate-700'
            )}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Odontología"
        description="Historia dental · Odontograma · Procedimientos"
        action={
          pacienteSeleccionado && (
            <Button onClick={() => setDienteModal(0)}>
              <Plus className="w-4 h-4" /> Nuevo procedimiento
            </Button>
          )
        }
      />

      {/* Búsqueda de paciente */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-5">
        <label className="text-xs font-semibold text-slate-600 block mb-2">Paciente</label>
        <button
          type="button"
          onClick={() => setShowBuscador(true)}
          className="w-full max-w-md px-3 py-2 rounded-lg border border-slate-200 text-sm text-left flex items-center justify-between hover:border-halu-400 transition-colors"
        >
          {pacienteSeleccionado ? (
            <span className="text-slate-900 font-medium">{pacienteSeleccionado.nombre_completo}</span>
          ) : (
            <span className="text-slate-400">Buscar paciente por nombre o documento...</span>
          )}
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>
        {pacienteSeleccionado && (
          <div className="flex items-center gap-3 mt-3 p-3 bg-halu-50 rounded-xl border border-halu-100 max-w-md">
            <div className="flex-1">
              <p className="text-sm font-semibold text-halu-800">{pacienteSeleccionado.nombre_completo}</p>
              <p className="text-xs text-halu-600">{pacienteSeleccionado.numero_documento}</p>
            </div>
            <button onClick={() => { setPacienteSeleccionado(null); setProcedimientos([]) }}
              className="p-1 text-halu-400 hover:text-halu-600 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {showBuscador && (
          <BuscadorPacienteIngreso
            onSelect={(p) => seleccionarPaciente(p)}
            onClose={() => setShowBuscador(false)}
          />
        )}
      </div>

      {/* Odontograma */}
      <div className={clsx('bg-white rounded-2xl border border-slate-100 p-5 mb-5', !pacienteSeleccionado && 'opacity-60')}>
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Odontograma</h2>
        <div className="overflow-x-auto">
          <div className="min-w-max space-y-4">
            {/* Superior */}
            <div className="flex gap-8 justify-center">
              {renderCuadrante(CUADRANTE_1, 'Cuadrante 1')}
              {renderCuadrante(CUADRANTE_2, 'Cuadrante 2')}
            </div>
            <div className="border-t border-dashed border-slate-200" />
            {/* Inferior */}
            <div className="flex gap-8 justify-center">
              {renderCuadrante(CUADRANTE_4, 'Cuadrante 4')}
              {renderCuadrante(CUADRANTE_3, 'Cuadrante 3')}
            </div>
          </div>
        </div>
        <div className="flex gap-4 mt-4 flex-wrap text-xs">
          {[
            { color: 'bg-slate-100 border-slate-200', label: 'Sin procedimientos' },
            { color: 'bg-amber-100 border-amber-300', label: 'Planificado' },
            { color: 'bg-blue-100 border-blue-300', label: 'En proceso' },
            { color: 'bg-emerald-100 border-emerald-300', label: 'Completado' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={clsx('w-4 h-4 rounded border', item.color)} />
              <span className="text-slate-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de procedimientos */}
      {pacienteSeleccionado && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Procedimientos del paciente</h2>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-16 mb-2" />)
          ) : procedimientos.length === 0 ? (
            <EmptyState title="Sin procedimientos" description="Haz clic en un diente del odontograma para registrar procedimientos" />
          ) : (
            <div className="space-y-2">
              {procedimientos.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-slate-700">{p.diente}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-medium text-slate-900 text-sm">Diente {p.diente}</span>
                      {p.cara && <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{p.cara}</span>}
                      <Badge variant={estadoBadge(p.estado)}>{p.estado_display}</Badge>
                    </div>
                    {p.descripcion_diagnostico && <p className="text-xs text-slate-600">{p.descripcion_diagnostico}</p>}
                    {p.descripcion_tratamiento && <p className="text-xs text-slate-500">{p.descripcion_tratamiento}</p>}
                    {p.cups && <p className="text-xs text-slate-400">CUPS: {p.cups}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {p.valor_cobrado && (
                      <p className="text-sm font-semibold text-slate-800">
                        ${parseFloat(p.valor_cobrado).toLocaleString('es-CO')}
                      </p>
                    )}
                    <p className="text-xs text-slate-400">{p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO') : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!pacienteSeleccionado && !loading && (
        <EmptyState
          title="Selecciona un paciente"
          description="Busca y selecciona un paciente para ver su odontograma e historial dental"
        />
      )}

      {dienteModal !== null && pacienteSeleccionado && (
        <ProcedimientoModal
          diente={dienteModal}
          pacienteId={pacienteSeleccionado.id}
          onClose={() => setDienteModal(null)}
          onSaved={() => {
            setDienteModal(null)
            // Recargar procedimientos
            api.get(`/api/salud/odontologia/procedimientos/?paciente=${pacienteSeleccionado.id}`)
              .then(({ data }) => setProcedimientos(data.results ?? data))
              .catch(e => toast.error(mensajeError(e)))
          }}
        />
      )}
    </div>
  )
}

function ProcedimientoModal({ diente, pacienteId, onClose, onSaved }: {
  diente: number
  pacienteId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    diente: diente > 0 ? String(diente) : '',
    cara: '', descripcion_diagnostico: '', descripcion_tratamiento: '',
    cups: '', estado: 'planificado', valor_cobrado: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.diente) { toast.error('El número de diente es requerido'); return }
    setSaving(true)
    try {
      await api.post('/api/salud/odontologia/procedimientos/', {
        ...form, paciente: pacienteId,
        diente: Number(form.diente),
        valor_cobrado: form.valor_cobrado || null,
      })
      toast.success('Procedimiento registrado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">
              {diente > 0 ? `Procedimiento · Diente ${diente}` : 'Nuevo procedimiento dental'}
            </h2>
            <p className="text-xs text-slate-500">Diagnóstico y tratamiento odontológico</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">N° diente *</label>
              <input type="number" value={form.diente} onChange={set('diente')}
                className={INPUT} placeholder="Ej. 14" min="11" max="48" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Cara</label>
              <select value={form.cara} onChange={set('cara')} className={INPUT}>
                <option value="">General</option>
                <option value="vestibular">Vestibular</option>
                <option value="lingual">Lingual/Palatino</option>
                <option value="mesial">Mesial</option>
                <option value="distal">Distal</option>
                <option value="oclusal">Oclusal/Incisal</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Estado</label>
              <select value={form.estado} onChange={set('estado')} className={INPUT}>
                <option value="planificado">Planificado</option>
                <option value="en_proceso">En proceso</option>
                <option value="completado">Completado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Descripción diagnóstico</label>
            <textarea value={form.descripcion_diagnostico} onChange={set('descripcion_diagnostico')} rows={2}
              className={INPUT} placeholder="Hallazgos diagnósticos del diente..." />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Descripción tratamiento</label>
            <textarea value={form.descripcion_tratamiento} onChange={set('descripcion_tratamiento')} rows={2}
              className={INPUT} placeholder="Tratamiento realizado o planificado..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">CUPS</label>
              <input value={form.cups} onChange={set('cups')} className={INPUT} placeholder="Código CUPS" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Valor cobrado (COP)</label>
              <input type="number" value={form.valor_cobrado} onChange={set('valor_cobrado')} className={INPUT} placeholder="0" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Guardar procedimiento</Button>
        </div>
      </div>
    </div>
  )
}
