'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { prefacturaAPI, itemPrefacturaAPI } from '@/lib/api'
import type { Prefactura, ItemPrefactura, DestinoPrefactura, TipoItemPrefactura } from '@/types'
import toast from 'react-hot-toast'
import {
  ArrowLeft, RefreshCcw, Plus, Trash2, Save, ChevronRight,
  CheckCircle2, AlertTriangle, FileText, Loader2,
} from 'lucide-react'
import clsx from 'clsx'

const DESTINO_LABELS: Record<DestinoPrefactura, string> = {
  eps: 'EPS',
  paciente: 'Paciente',
  no_facturable: 'No facturable',
}
const DESTINO_COLORS: Record<DestinoPrefactura, string> = {
  eps: 'bg-blue-100 text-blue-700',
  paciente: 'bg-amber-100 text-amber-700',
  no_facturable: 'bg-slate-100 text-slate-500',
}
const TIPO_LABELS: Record<TipoItemPrefactura, string> = {
  consulta: 'Consulta', procedimiento: 'Procedimiento', cx: 'Cirugía',
  anestesia: 'Anestesia', derecho_sala: 'Derecho de sala', hoteleria: 'Hotelería',
  medicamento: 'Medicamento', material: 'Material/Insumo', laboratorio: 'Laboratorio',
  imagen: 'Imagen diagnóstica', otro: 'Otro',
}
const ESTADO_STEPS = ['borrador', 'en_revision', 'aprobada', 'facturada']
const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador', en_revision: 'En revisión', aprobada: 'Aprobada', facturada: 'Facturada', anulada: 'Anulada',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

interface ItemRow {
  item: ItemPrefactura
  editDestino: DestinoPrefactura
  editMotivo: string
  dirty: boolean
  saving: boolean
}

function ModalNuevoItem({ prefacturaId, onClose, onSaved }: { prefacturaId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    tipo: 'procedimiento' as TipoItemPrefactura,
    descripcion: '',
    cups: '',
    cantidad: 1,
    valor_unitario: 0,
    descuento: 0,
    destino: 'eps' as DestinoPrefactura,
    cie10: '',
    fecha_servicio: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.descripcion || form.valor_unitario <= 0) {
      toast.error('Descripción y valor unitario son obligatorios')
      return
    }
    setSaving(true)
    try {
      await itemPrefacturaAPI.create({ ...form, prefactura: prefacturaId, es_manual: true })
      toast.success('Ítem agregado')
      onSaved()
      onClose()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Agregar ítem manual</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Tipo</label>
              <select className="input-base w-full" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs">Destino</label>
              <select className="input-base w-full" value={form.destino} onChange={e => set('destino', e.target.value)}>
                {Object.entries(DESTINO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-xs">Descripción *</label>
            <input className="input-base w-full" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción del servicio o insumo" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-xs">CUPS</label>
              <input className="input-base w-full" value={form.cups} onChange={e => set('cups', e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <label className="label-xs">Cantidad</label>
              <input type="number" min={1} className="input-base w-full" value={form.cantidad} onChange={e => set('cantidad', Number(e.target.value))} />
            </div>
            <div>
              <label className="label-xs">Valor unitario *</label>
              <input type="number" min={0} className="input-base w-full" value={form.valor_unitario} onChange={e => set('valor_unitario', Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Descuento ($)</label>
              <input type="number" min={0} className="input-base w-full" value={form.descuento} onChange={e => set('descuento', Number(e.target.value))} />
            </div>
            <div>
              <label className="label-xs">CIE-10</label>
              <input className="input-base w-full" value={form.cie10} onChange={e => set('cie10', e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div>
            <label className="label-xs">Fecha del servicio</label>
            <input type="date" className="input-base w-full" value={form.fecha_servicio} onChange={e => set('fecha_servicio', e.target.value)} />
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-halu-600 text-white rounded-lg hover:bg-halu-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PrefacturaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [prefactura, setPrefactura] = useState<Prefactura | null>(null)
  const [rows, setRows] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [autoLoading, setAutoLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [estadoLoading, setEstadoLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await prefacturaAPI.get(id)
      const pre = res.data as Prefactura
      setPrefactura(pre)
      setRows(pre.items.map(item => ({
        item,
        editDestino: item.destino,
        editMotivo: item.motivo_exclusion || '',
        dirty: false,
        saving: false,
      })))
    } catch {
      toast.error('No se pudo cargar la prefactura')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleAutocargar = async () => {
    setAutoLoading(true)
    try {
      const res = await prefacturaAPI.autocargar(id)
      toast.success(res.data.message || 'Ítems cargados')
      await load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || 'Error al autocargar')
    } finally {
      setAutoLoading(false)
    }
  }

  const handleRowChange = (idx: number, field: 'editDestino' | 'editMotivo', val: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val as DestinoPrefactura, dirty: true } : r))
  }

  const saveRow = async (idx: number) => {
    const row = rows[idx]
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, saving: true } : r))
    try {
      await itemPrefacturaAPI.update(row.item.id, {
        destino: row.editDestino,
        motivo_exclusion: row.editMotivo || null,
      })
      toast.success('Guardado')
      await load()
    } catch {
      toast.error('Error al guardar')
      setRows(prev => prev.map((r, i) => i === idx ? { ...r, saving: false } : r))
    }
  }

  const deleteRow = async (itemId: string) => {
    if (!confirm('¿Eliminar este ítem?')) return
    try {
      await itemPrefacturaAPI.delete(itemId)
      toast.success('Ítem eliminado')
      await load()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const handleEstado = async (nuevoEstado: string) => {
    if (!prefactura) return
    const mensajes: Record<string, string> = {
      en_revision: '¿Enviar a revisión?',
      aprobada: '¿Aprobar la prefactura? Esto la bloquea para edición.',
      borrador: '¿Regresar a borrador?',
    }
    if (!confirm(mensajes[nuevoEstado] || `¿Cambiar estado a ${nuevoEstado}?`)) return
    setEstadoLoading(true)
    try {
      await prefacturaAPI.cambiarEstado(id, nuevoEstado)
      toast.success(`Estado actualizado: ${ESTADO_LABELS[nuevoEstado]}`)
      await load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || 'Error al cambiar estado')
    } finally {
      setEstadoLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-halu-600" />
    </div>
  )
  if (!prefactura) return null

  const esEditable = prefactura.estado === 'borrador'
  const stepIdx = ESTADO_STEPS.indexOf(prefactura.estado)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{prefactura.numero_formateado}</h1>
          <p className="text-sm text-slate-500">{prefactura.paciente_nombre}</p>
        </div>
        <span className={clsx('px-3 py-1.5 rounded-full text-sm font-medium',
          prefactura.estado === 'aprobada' ? 'bg-green-100 text-green-700' :
          prefactura.estado === 'en_revision' ? 'bg-amber-100 text-amber-700' :
          prefactura.estado === 'facturada' ? 'bg-blue-100 text-blue-700' :
          prefactura.estado === 'anulada' ? 'bg-red-100 text-red-700' :
          'bg-slate-100 text-slate-600'
        )}>
          {ESTADO_LABELS[prefactura.estado]}
        </span>
      </div>

      {/* Progress bar */}
      {prefactura.estado !== 'anulada' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-center gap-2">
            {ESTADO_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  i < stepIdx ? 'bg-green-500 text-white' :
                  i === stepIdx ? 'bg-halu-600 text-white' : 'bg-slate-100 text-slate-400'
                )}>
                  {i < stepIdx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={clsx('text-xs font-medium flex-shrink-0',
                  i === stepIdx ? 'text-halu-700' : i < stepIdx ? 'text-green-600' : 'text-slate-400'
                )}>{ESTADO_LABELS[s]}</span>
                {i < ESTADO_STEPS.length - 1 && <div className={clsx('flex-1 h-0.5', i < stepIdx ? 'bg-green-300' : 'bg-slate-100')} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info + totales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Información</p>
          {prefactura.convenio_info && (
            <p className="text-sm text-slate-700"><span className="font-medium">Convenio:</span> {prefactura.convenio_info.nombre}</p>
          )}
          <p className="text-sm text-slate-700"><span className="font-medium">Creado:</span> {new Date(prefactura.creado_en).toLocaleDateString('es-CO')}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 text-center">
          <p className="text-xs font-medium text-blue-500 mb-1">Total EPS</p>
          <p className="text-2xl font-bold text-blue-700">{fmt(prefactura.subtotal_eps)}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 text-center">
          <p className="text-xs font-medium text-amber-500 mb-1">Total Paciente</p>
          <p className="text-2xl font-bold text-amber-700">{fmt(prefactura.subtotal_paciente)}</p>
        </div>
      </div>

      {/* Herramientas */}
      {esEditable && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleAutocargar}
            disabled={autoLoading}
            className="flex items-center gap-2 px-4 py-2 bg-halu-600 text-white text-sm font-medium rounded-xl hover:bg-halu-700 disabled:opacity-50"
          >
            {autoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Autocargar ítems
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" />
            Ítem manual
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-amber-700">Marca como &ldquo;No facturable&rdquo; los insumos incluidos en UVR o sin documentación</span>
          </div>
        </div>
      )}

      {/* Tabla de ítems */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-700 text-sm">Ítems de prefactura ({rows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descripción</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cant.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">V. Unit.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Destino</th>
                {esEditable && <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Motivo exclusión</th>}
                {esEditable && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                    No hay ítems. Usa &ldquo;Autocargar ítems&rdquo; para cargar desde los módulos clínicos.
                  </td>
                </tr>
              )}
              {rows.map((row, idx) => (
                <tr key={row.item.id} className={clsx('hover:bg-slate-50/50',
                  row.editDestino === 'no_facturable' ? 'opacity-60' : ''
                )}>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                      {TIPO_LABELS[row.item.tipo]}
                    </span>
                    {row.item.es_manual && <span className="ml-1 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">M</span>}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-slate-800 font-medium truncate">{row.item.descripcion}</p>
                    {row.item.cups && <p className="text-xs text-slate-400">{row.item.cups}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{row.item.cantidad}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmt(row.item.valor_unitario)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(row.item.valor_total)}</td>
                  <td className="px-4 py-3 text-center">
                    {esEditable ? (
                      <select
                        value={row.editDestino}
                        onChange={e => handleRowChange(idx, 'editDestino', e.target.value)}
                        className={clsx('text-xs px-2 py-1 rounded-lg border font-medium',
                          row.editDestino === 'eps' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                          row.editDestino === 'paciente' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                          'border-slate-200 bg-slate-50 text-slate-500'
                        )}
                      >
                        <option value="eps">EPS</option>
                        <option value="paciente">Paciente</option>
                        <option value="no_facturable">No facturable</option>
                      </select>
                    ) : (
                      <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', DESTINO_COLORS[row.item.destino])}>
                        {DESTINO_LABELS[row.item.destino]}
                      </span>
                    )}
                  </td>
                  {esEditable && (
                    <td className="px-4 py-3">
                      {row.editDestino === 'no_facturable' && (
                        <input
                          className="input-base w-full text-xs"
                          placeholder="Motivo (incluido en UVR, sin doc...)"
                          value={row.editMotivo}
                          onChange={e => handleRowChange(idx, 'editMotivo', e.target.value)}
                        />
                      )}
                    </td>
                  )}
                  {esEditable && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {row.dirty && (
                          <button
                            onClick={() => saveRow(idx)}
                            disabled={row.saving}
                            className="p-1.5 text-halu-600 hover:bg-halu-50 rounded-lg"
                            title="Guardar cambio"
                          >
                            {row.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={() => deleteRow(row.item.id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales pie */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex justify-end">
            <div className="space-y-1 text-sm min-w-56">
              <div className="flex justify-between gap-8 text-slate-500">
                <span>Subtotal EPS</span><span className="font-medium text-blue-700">{fmt(prefactura.subtotal_eps)}</span>
              </div>
              <div className="flex justify-between gap-8 text-slate-500">
                <span>Subtotal Paciente</span><span className="font-medium text-amber-700">{fmt(prefactura.subtotal_paciente)}</span>
              </div>
              <div className="flex justify-between gap-8 text-slate-400 text-xs">
                <span>No facturable</span><span>{fmt(prefactura.subtotal_no_facturable)}</span>
              </div>
              <div className="flex justify-between gap-8 font-bold text-slate-800 pt-1 border-t border-slate-100 text-base">
                <span>TOTAL</span><span>{fmt(prefactura.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones de flujo */}
      {prefactura.estado !== 'anulada' && prefactura.estado !== 'facturada' && (
        <div className="flex items-center justify-end gap-3">
          {prefactura.estado === 'en_revision' && (
            <button
              onClick={() => handleEstado('borrador')}
              disabled={estadoLoading}
              className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50"
            >
              Regresar a borrador
            </button>
          )}
          {prefactura.estado === 'borrador' && (
            <button
              onClick={() => handleEstado('en_revision')}
              disabled={estadoLoading}
              className="px-5 py-2 text-sm bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
            >
              {estadoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Enviar a revisión
            </button>
          )}
          {prefactura.estado === 'en_revision' && (
            <button
              onClick={() => handleEstado('aprobada')}
              disabled={estadoLoading}
              className="px-5 py-2 text-sm bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {estadoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Aprobar prefactura
            </button>
          )}
          {prefactura.estado === 'aprobada' && (
            <button
              onClick={() => router.push('/facturacion/nueva')}
              className="px-5 py-2 text-sm bg-halu-600 text-white font-medium rounded-xl hover:bg-halu-700 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Generar FEV
            </button>
          )}
        </div>
      )}

      {showModal && (
        <ModalNuevoItem
          prefacturaId={id}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
