'use client'
import { useState } from 'react'
import { ordenesMedicasAPI, mensajeError } from '@/lib/api'
import { Button, Card } from '@/components/ui'
import { Cie10Autocomplete } from '@/components/ui/Cie10Autocomplete'
import { Plus, Trash2, FlaskConical, Scan, ArrowRightLeft, Pill, Scissors, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

interface Orden {
  id?: string
  tipo: string
  descripcion: string
  cups: string
  cum: string
  cie10: string
  indicacion: string
  dosis: string
  frecuencia: string
  duracion: string
  via_admin: string
  cantidad: number
  vigencia_dias: number
  observaciones: string
  estado: string
  _local?: boolean  // aún no guardada en servidor
}

const TIPO_ICONS: Record<string, React.ReactNode> = {
  lab:           <FlaskConical className="w-3.5 h-3.5" />,
  imagen:        <Scan className="w-3.5 h-3.5" />,
  interconsulta: <ArrowRightLeft className="w-3.5 h-3.5" />,
  medicamento:   <Pill className="w-3.5 h-3.5" />,
  procedimiento: <Scissors className="w-3.5 h-3.5" />,
  otro:          <FileText className="w-3.5 h-3.5" />,
}

const TIPO_LABELS: Record<string, string> = {
  lab: 'Laboratorio', imagen: 'Imagen diagnóstica', interconsulta: 'Interconsulta',
  medicamento: 'Medicamento', procedimiento: 'Procedimiento', otro: 'Otro',
}

const TIPO_COLORS: Record<string, string> = {
  lab: 'bg-blue-50 text-blue-700 border-blue-100',
  imagen: 'bg-purple-50 text-purple-700 border-purple-100',
  interconsulta: 'bg-teal-50 text-teal-700 border-teal-100',
  medicamento: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  procedimiento: 'bg-orange-50 text-orange-700 border-orange-100',
  otro: 'bg-slate-50 text-slate-700 border-slate-100',
}

const EMPTY_ORDEN: Orden = {
  tipo: 'lab', descripcion: '', cups: '', cum: '', cie10: '', indicacion: '',
  dosis: '', frecuencia: '', duracion: '', via_admin: '',
  cantidad: 1, vigencia_dias: 30, observaciones: '', estado: 'pendiente', _local: true,
}

interface Props {
  consultaId: string
  ordenes?: Orden[]
}

export function OrdenesPanel({ consultaId, ordenes: init = [] }: Props) {
  const [ordenes, setOrdenes] = useState<Orden[]>(init)
  const [nueva, setNueva] = useState<Orden | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandida, setExpandida] = useState<string | null>(null)

  const abrirNueva = () => setNueva({ ...EMPTY_ORDEN })

  const setNuevaField = (field: keyof Orden) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setNueva(o => o ? { ...o, [field]: e.target.value } : o)

  const guardarOrden = async () => {
    if (!nueva?.descripcion) { toast.error('La descripción es requerida'); return }
    setSaving(true)
    try {
      const { data } = await ordenesMedicasAPI.create({
        ...nueva, consulta: consultaId, _local: undefined,
      })
      setOrdenes(o => [...o, data])
      setNueva(null)
      toast.success('Orden guardada')
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setSaving(false) }
  }

  const eliminarOrden = async (id: string) => {
    try {
      await ordenesMedicasAPI.delete(id)
      setOrdenes(o => o.filter(x => x.id !== id))
      toast.success('Orden eliminada')
    } catch { toast.error('Error al eliminar') }
  }

  const esMedicamento = (tipo: string) => tipo === 'medicamento'
  const tieneCUPS = (tipo: string) => ['lab', 'imagen', 'procedimiento', 'interconsulta'].includes(tipo)

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Órdenes médicas</h3>
          {ordenes.length > 0 && (
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">{ordenes.length}</span>
          )}
        </div>
        <Button type="button" variant="secondary" onClick={abrirNueva} className="text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5 mr-1" /> Nueva orden
        </Button>
      </div>

      {/* Lista de órdenes */}
      {ordenes.length > 0 && (
        <div className="space-y-2 mb-4">
          {ordenes.map((o, i) => (
            <div key={o.id ?? i} className={`rounded-xl border p-3 ${TIPO_COLORS[o.tipo] || TIPO_COLORS.otro}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {TIPO_ICONS[o.tipo]}
                  <div>
                    <span className="text-xs font-semibold">{TIPO_LABELS[o.tipo]}</span>
                    {o.cups && <span className="ml-2 font-mono text-xs opacity-70">{o.cups}</span>}
                    <p className="text-sm font-medium leading-tight">{o.descripcion}</p>
                    {o.indicacion && <p className="text-xs opacity-70 mt-0.5">{o.indicacion}</p>}
                    {esMedicamento(o.tipo) && o.dosis && (
                      <p className="text-xs opacity-70">{o.dosis} — {o.frecuencia} — {o.duracion}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setExpandida(expandida === (o.id ?? String(i)) ? null : (o.id ?? String(i)))}
                    className="p-1 rounded opacity-60 hover:opacity-100">
                    {expandida === (o.id ?? String(i)) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {o.id && (
                    <button onClick={() => eliminarOrden(o.id!)} className="p-1 rounded opacity-60 hover:opacity-100 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {expandida === (o.id ?? String(i)) && o.observaciones && (
                <p className="text-xs mt-2 pt-2 border-t border-current/10 opacity-70">{o.observaciones}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formulario nueva orden */}
      {nueva && (
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">Nueva orden médica</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tipo *</label>
              <select value={nueva.tipo} onChange={setNuevaField('tipo')}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20">
                <option value="lab">Laboratorio clínico</option>
                <option value="imagen">Imagen diagnóstica</option>
                <option value="interconsulta">Interconsulta / Remisión</option>
                <option value="medicamento">Medicamento</option>
                <option value="procedimiento">Procedimiento</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Cantidad</label>
              <input type="number" min={1} value={nueva.cantidad}
                onChange={setNuevaField('cantidad')}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Descripción / nombre *</label>
            <input value={nueva.descripcion} onChange={setNuevaField('descripcion')}
              placeholder={nueva.tipo === 'medicamento' ? 'Ej: Amoxicilina 500mg cápsulas' : 'Ej: Hemograma completo, Rx de tórax PA...'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20" />
          </div>

          {tieneCUPS(nueva.tipo) && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Código CUPS</label>
              <input value={nueva.cups} onChange={setNuevaField('cups')} placeholder="Ej: 903818"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-halu-500/20" />
            </div>
          )}

          {esMedicamento(nueva.tipo) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">CUM (opcional)</label>
                  <input value={nueva.cum} onChange={setNuevaField('cum')} placeholder="Código único medicamento"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Vía administración</label>
                  <input value={nueva.via_admin} onChange={setNuevaField('via_admin')} placeholder="Oral, IV, IM..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Dosis</label>
                  <input value={nueva.dosis} onChange={setNuevaField('dosis')} placeholder="500mg"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Frecuencia</label>
                  <input value={nueva.frecuencia} onChange={setNuevaField('frecuencia')} placeholder="Cada 8 horas"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Duración</label>
                  <input value={nueva.duracion} onChange={setNuevaField('duracion')} placeholder="7 días"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20" />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Cie10Autocomplete
                label="CIE-10 relacionado"
                value={nueva.cie10}
                onChange={(codigo) => setNueva(n => ({ ...n, cie10: codigo }))}
                placeholder="Código CIE-10 o diagnóstico..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Vigencia (días)</label>
              <input type="number" min={1} max={365} value={nueva.vigencia_dias}
                onChange={setNuevaField('vigencia_dias')}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Indicación clínica</label>
            <textarea value={nueva.indicacion} onChange={setNuevaField('indicacion')} rows={2}
              placeholder="Justificación clínica de la orden..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-halu-500/20 resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={guardarOrden} loading={saving} className="text-sm">
              Guardar orden
            </Button>
            <Button type="button" variant="secondary" onClick={() => setNueva(null)} className="text-sm">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {ordenes.length === 0 && !nueva && (
        <p className="text-sm text-slate-400 text-center py-4">
          Sin órdenes médicas. Usa &quot;Nueva orden&quot; para agregar lab, imágenes, medicamentos o interconsultas.
        </p>
      )}
    </Card>
  )
}
