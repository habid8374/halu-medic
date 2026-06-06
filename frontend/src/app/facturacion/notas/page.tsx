'use client'
import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { mensajeError } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  FileText, Plus, Search, Loader2, X, Send, ChevronRight,
  AlertTriangle, CheckCircle2, CreditCard,
} from 'lucide-react'
import clsx from 'clsx'

interface Factura { id: string; numero_factus: string | null; cufe: string | null; estado: string; creado_en: string }
interface NotaDocumento {
  id: string
  tipo: 'NC' | 'ND'
  tipo_label: string
  factura_referencia: string
  factura_numero: string
  factura_cufe: string
  concepto: string
  descripcion_concepto: string
  subtotal: number
  valor_descuento: number
  total: number
  numero_factus: string
  cufe: string
  estado: string
  estado_label: string
  errores_dian: unknown[] | null
  observaciones: string
  creado_por_nombre: string
  creado_en: string
}

const CONCEPTOS_NC = [
  { value: '1', label: 'Devolución parcial / no aceptación de servicios' },
  { value: '2', label: 'Anulación de factura electrónica' },
  { value: '3', label: 'Rebaja o descuento parcial' },
  { value: '4', label: 'Ajuste de precio' },
  { value: '5', label: 'Otros' },
]
const CONCEPTOS_ND = [
  { value: '1', label: 'Intereses' },
  { value: '2', label: 'Gastos por cobrar' },
  { value: '3', label: 'Cambio del valor' },
  { value: '4', label: 'Otros' },
]
const ESTADO_COLOR: Record<string, string> = {
  borrador:  'bg-slate-100 text-slate-600',
  enviada:   'bg-blue-100 text-blue-700',
  validada:  'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-600',
  anulada:   'bg-slate-100 text-slate-400',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function ModalNuevaNota({ facturas, onClose, onSaved }: {
  facturas: Factura[]; onClose: () => void; onSaved: () => void
}) {
  const [tipo, setTipo]               = useState<'NC' | 'ND'>('NC')
  const [facturaId, setFacturaId]     = useState('')
  const [concepto, setConcepto]       = useState('2')
  const [descripcion, setDescripcion] = useState('')
  const [subtotal, setSubtotal]       = useState(0)
  const [descuento, setDescuento]     = useState(0)
  const [obs, setObs]                 = useState('')
  const [saving, setSaving]           = useState(false)

  const conceptos = tipo === 'NC' ? CONCEPTOS_NC : CONCEPTOS_ND
  const total     = subtotal - descuento

  const guardar = async () => {
    if (!facturaId || !descripcion.trim()) {
      toast.error('Selecciona la factura y describe el motivo')
      return
    }
    setSaving(true)
    try {
      await api.post('/api/facturacion/notas/', {
        tipo, factura_referencia: facturaId, concepto, descripcion_concepto: descripcion,
        subtotal, valor_descuento: descuento, total, observaciones: obs,
      })
      toast.success(`${tipo === 'NC' ? 'Nota crédito' : 'Nota débito'} creada`)
      onSaved()
      onClose()
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setSaving(false) }
  }

  const facturasSel = facturas.filter(f => ['validada', 'enviada'].includes(f.estado))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-halu-600" />
            <div>
              <p className="font-semibold text-slate-900">Nueva nota crédito / débito</p>
              <p className="text-xs text-slate-400">FEV sector salud · Factus / DIAN</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-auto space-y-4">
          {/* Tipo NC / ND */}
          <div className="grid grid-cols-2 gap-3">
            {(['NC', 'ND'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTipo(t); setConcepto(t === 'NC' ? '2' : '1') }}
                className={clsx(
                  'p-3 rounded-xl border-2 text-center transition-all',
                  tipo === t ? (t === 'NC' ? 'border-red-400 bg-red-50' : 'border-blue-400 bg-blue-50') : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <p className={clsx('font-bold text-lg', tipo === t ? (t === 'NC' ? 'text-red-700' : 'text-blue-700') : 'text-slate-400')}>{t}</p>
                <p className="text-xs text-slate-500">{t === 'NC' ? 'Nota crédito' : 'Nota débito'}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t === 'NC' ? 'Reduce el valor' : 'Aumenta el valor'}</p>
              </button>
            ))}
          </div>

          {/* Aviso normativo */}
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              {tipo === 'NC'
                ? 'La NC reduce o anula el valor de la factura original. Conceptos: devolución, descuento, anulación o ajuste de precio.'
                : 'La ND aumenta el valor de la factura original. Requiere justificación clara para evitar glosas del pagador.'}
            </p>
          </div>

          <div>
            <label className="label-xs">Factura original *</label>
            {facturasSel.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No hay facturas validadas disponibles.</p>
            ) : (
              <select className="input-base w-full" value={facturaId} onChange={e => setFacturaId(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {facturasSel.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.numero_factus} · {new Date(f.creado_en).toLocaleDateString('es-CO')}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Concepto *</label>
              <select className="input-base w-full" value={concepto} onChange={e => setConcepto(e.target.value)}>
                {conceptos.map(c => <option key={c.value} value={c.value}>{c.value}. {c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label-xs">Descripción del motivo *</label>
            <textarea
              className="input-base w-full min-h-[70px] resize-none"
              placeholder="Describe el motivo de la nota crédito/débito con detalle suficiente para el pagador..."
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-xs">Subtotal ($)</label>
              <input type="number" min={0} className="input-base w-full" value={subtotal} onChange={e => setSubtotal(Number(e.target.value))} />
            </div>
            <div>
              <label className="label-xs">Descuento ($)</label>
              <input type="number" min={0} className="input-base w-full" value={descuento} onChange={e => setDescuento(Number(e.target.value))} />
            </div>
            <div>
              <label className="label-xs">Total</label>
              <p className={clsx('input-base w-full bg-slate-50 font-semibold', tipo === 'NC' ? 'text-red-600' : 'text-blue-700')}>
                {fmt(total)}
              </p>
            </div>
          </div>

          <div>
            <label className="label-xs">Observaciones internas</label>
            <input className="input-base w-full" placeholder="Opcional" value={obs} onChange={e => setObs(e.target.value)} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">Cancelar</button>
          <button
            onClick={guardar}
            disabled={saving || facturasSel.length === 0}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl text-white disabled:opacity-50',
              tipo === 'NC' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear {tipo === 'NC' ? 'nota crédito' : 'nota débito'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NotasPage() {
  const [notas, setNotas]           = useState<NotaDocumento[]>([])
  const [facturas, setFacturas]     = useState<Factura[]>([])
  const [loading, setLoading]       = useState(true)
  const [busqueda, setBusqueda]     = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'NC' | 'ND' | ''>('')
  const [showModal, setShowModal]   = useState(false)
  const [enviando, setEnviando]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rN, rF] = await Promise.all([
        api.get('/api/facturacion/notas/'),
        api.get('/api/facturacion/facturas/?page_size=200'),
      ])
      setNotas(rN.data.results ?? rN.data)
      setFacturas(rF.data.results ?? rF.data)
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const enviar = async (id: string) => {
    if (!confirm('¿Enviar esta nota a la DIAN vía Factus?')) return
    setEnviando(id)
    try {
      await api.post(`/api/facturacion/notas/${id}/enviar/`)
      toast.success('Nota enviada')
      load()
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setEnviando(null) }
  }

  const filtradas = notas.filter(n =>
    (!filtroTipo || n.tipo === filtroTipo) &&
    (!busqueda || n.factura_numero?.toLowerCase().includes(busqueda.toLowerCase()) || n.descripcion_concepto.toLowerCase().includes(busqueda.toLowerCase()))
  )

  const nc = notas.filter(n => n.tipo === 'NC').length
  const nd = notas.filter(n => n.tipo === 'ND').length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-halu-100 rounded-2xl flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-halu-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Notas crédito / débito</h1>
          <p className="text-sm text-slate-500">Documentos de ajuste FEV · DIAN · Factus</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-halu-600 text-white text-sm font-medium rounded-xl hover:bg-halu-700"
        >
          <Plus className="w-4 h-4" />
          Nueva nota
        </button>
      </div>

      {/* Explicación normativa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="font-semibold text-red-700 text-sm flex items-center gap-2"><FileText className="w-4 h-4" />Nota crédito (NC)</p>
          <p className="text-xs text-red-600 mt-1">Reduce o anula el valor de una factura ya emitida. Conceptos: devolución, descuento, anulación, ajuste de precio. Referencia el CUFE original.</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="font-semibold text-blue-700 text-sm flex items-center gap-2"><FileText className="w-4 h-4" />Nota débito (ND)</p>
          <p className="text-xs text-blue-600 mt-1">Aumenta el valor de una factura ya emitida. Conceptos: intereses, gastos adicionales, cambio del valor. Requiere justificación ante el pagador.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{notas.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total notas</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{nc}</p>
          <p className="text-xs text-red-500 mt-0.5">Notas crédito</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{nd}</p>
          <p className="text-xs text-blue-500 mt-0.5">Notas débito</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input-base w-full pl-9"
            placeholder="Buscar por factura o descripción..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <select className="input-base" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as 'NC' | 'ND' | '')}>
          <option value="">Todos los tipos</option>
          <option value="NC">Nota crédito</option>
          <option value="ND">Nota débito</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-halu-600" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No hay notas crédito/débito registradas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Factura orig.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Concepto / Motivo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Número DIAN</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtradas.map(n => (
                <tr key={n.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'inline-block text-xs font-bold px-2 py-1 rounded-lg',
                      n.tipo === 'NC' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    )}>{n.tipo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{n.factura_numero || '—'}</p>
                    <p className="text-xs text-slate-400">{new Date(n.creado_en).toLocaleDateString('es-CO')}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-slate-700 text-xs line-clamp-2">{n.descripcion_concepto}</p>
                  </td>
                  <td className={clsx('px-4 py-3 text-right font-semibold', n.tipo === 'NC' ? 'text-red-600' : 'text-blue-600')}>
                    {fmt(n.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', ESTADO_COLOR[n.estado] || 'bg-slate-100 text-slate-600')}>
                      {n.estado_label}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs font-mono text-slate-400">
                    {n.numero_factus || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {n.estado === 'borrador' && (
                        <button
                          onClick={() => enviar(n.id)}
                          disabled={enviando === n.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-halu-600 border border-halu-100 hover:bg-halu-50 transition-all"
                          title="Enviar a DIAN"
                        >
                          {enviando === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">Enviar</span>
                        </button>
                      )}
                      {n.estado === 'validada' && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" title="Validada DIAN" />
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-200" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <ModalNuevaNota
          facturas={facturas}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
