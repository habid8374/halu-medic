'use client'
import { useEffect, useState, useCallback } from 'react'
import { liquidacionCxAPI, mensajeError } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Search, Plus, Loader2, RefreshCw, CheckCircle, Trash2, ChevronDown, X,
} from 'lucide-react'
import clsx from 'clsx'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DQXResult {
  dqx_id: string
  dqx_numero: string
  cups: string
  descripcion: string
  cirujano: string
  fecha: string
  paciente_nombre: string
  paciente_doc: string
  numero_ingreso: string | number
  ingreso_id: string
  liquidacion_id: string | null
}

interface Procedimiento {
  id: string
  orden: number
  cups: string
  descripcion: string
  valor_base: string
  pct_cirujano: string; pct_anestesiologo: string; pct_ayudante: string
  pct_quirofano: string; pct_materiales: string
  valor_cirujano: string; valor_anestesiologo: string; valor_ayudante: string
  valor_quirofano: string; valor_materiales: string
  subtotal: string
}

interface Liquidacion {
  id: string
  descripcion_qx: string | null
  ingreso: string | null
  tipo_tarifario: string
  tipo_liquidacion: string
  estado: string
  observaciones: string
  total_cirujano: string; total_anestesiologo: string; total_ayudante: string
  total_quirofano: string; total_materiales: string; total_general: string
  procedimientos: Procedimiento[]
  paciente_nombre: string; paciente_doc: string; numero_ingreso: string | number
  dqx_numero: string; dqx_cups: string; dqx_descripcion: string
  dqx_cirujano: string; dqx_anestesiologo: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TARIFARIOS = [
  { value: 'ISS_2001', label: 'ISS 2001' },
  { value: 'ISS_2004', label: 'ISS 2004' },
  { value: 'SOAT',     label: 'SOAT' },
]

const TIPOS_LIQUIDACION = [
  { value: 'bilateral',          label: 'Bilateral' },
  { value: 'misma_via',          label: 'Mismo especialista – Misma vía' },
  { value: 'diferente_via',      label: 'Mismo especialista – Diferente vía' },
  { value: 'multiple_misma_a',   label: 'Múltiple especialista – Misma vía (Cir. A)' },
  { value: 'multiple_misma_b',   label: 'Múltiple especialista – Misma vía (Cir. B)' },
  { value: 'multiple_diferente_a', label: 'Múltiple especialista – Diferente vía (Cir. A)' },
  { value: 'multiple_diferente_b', label: 'Múltiple especialista – Diferente vía (Cir. B)' },
]

const ESTADO_COLORS: Record<string, string> = {
  borrador:   'bg-slate-100 text-slate-600',
  finalizada: 'bg-green-100 text-green-700',
  facturada:  'bg-blue-100 text-blue-700',
}

const fmt = (v: string | number) =>
  Number(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

// ── Main Component ────────────────────────────────────────────────────────────
export default function LiquidacionCXPage() {
  const [query, setQuery]           = useState('')
  const [searching, setSearching]   = useState(false)
  const [results, setResults]       = useState<DQXResult[]>([])
  const [liq, setLiq]               = useState<Liquidacion | null>(null)
  const [loading, setLoading]       = useState(false)
  const [recalculating, setRecalc]  = useState(false)

  // Mini-form agregar procedimiento
  const [showAddForm, setShowAddForm] = useState(false)
  const [addCups, setAddCups]         = useState('')
  const [addDesc, setAddDesc]         = useState('')
  const [addValor, setAddValor]       = useState('')
  const [addOrden, setAddOrden]       = useState('')
  const [adding, setAdding]           = useState(false)

  // ── Search DQX ──────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    setLiq(null)
    try {
      const res = await liquidacionCxAPI.buscarDQX(query)
      setResults(res.data)
      if (res.data.length === 0) toast('No se encontraron resultados', { icon: '🔍' })
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setSearching(false)
    }
  }, [query])

  // ── Load / Create liquidacion ───────────────────────────────────────────────
  const loadLiquidacion = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await liquidacionCxAPI.get(id)
      setLiq(res.data)
      setResults([])
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelectDQX = useCallback(async (dqx: DQXResult) => {
    if (dqx.liquidacion_id) {
      await loadLiquidacion(dqx.liquidacion_id)
    } else {
      setLoading(true)
      try {
        const res = await liquidacionCxAPI.create({
          descripcion_qx: dqx.dqx_id,
          ingreso: dqx.ingreso_id || null,
        })
        setLiq(res.data)
        setResults([])
        toast.success('Liquidación creada')
      } catch (e) {
        toast.error(mensajeError(e))
      } finally {
        setLoading(false)
      }
    }
  }, [loadLiquidacion])

  // ── Recalcular ──────────────────────────────────────────────────────────────
  const recalcular = useCallback(async (patch: Record<string, string>) => {
    if (!liq) return
    setRecalc(true)
    try {
      const res = await liquidacionCxAPI.recalcular(liq.id, patch)
      setLiq(res.data)
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setRecalc(false)
    }
  }, [liq])

  const onChangeTarifario = (v: string) => {
    if (!liq) return
    setLiq(prev => prev ? { ...prev, tipo_tarifario: v } : prev)
    recalcular({ tipo_tarifario: v })
  }

  const onChangeTipoLiq = (v: string) => {
    if (!liq) return
    setLiq(prev => prev ? { ...prev, tipo_liquidacion: v } : prev)
    recalcular({ tipo_liquidacion: v })
  }

  // ── Agregar procedimiento ───────────────────────────────────────────────────
  const handleAgregar = async () => {
    if (!liq || !addCups) return
    setAdding(true)
    try {
      await liquidacionCxAPI.agregarProcedimiento(liq.id, {
        cups: addCups,
        descripcion: addDesc,
        valor_base: addValor || 0,
        orden: addOrden ? Number(addOrden) : undefined,
      })
      const res = await liquidacionCxAPI.get(liq.id)
      setLiq(res.data)
      setShowAddForm(false)
      setAddCups(''); setAddDesc(''); setAddValor(''); setAddOrden('')
      toast.success('Procedimiento agregado')
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setAdding(false)
    }
  }

  // ── Eliminar procedimiento ──────────────────────────────────────────────────
  const handleEliminar = async (procId: string) => {
    if (!liq) return
    if (!confirm('¿Eliminar este procedimiento?')) return
    try {
      await liquidacionCxAPI.update(liq.id + '/procedimientos/' + procId, {})
      // Refetch
      const res = await liquidacionCxAPI.get(liq.id)
      setLiq(res.data)
    } catch {
      // fallback: just refetch
      try {
        const res = await liquidacionCxAPI.get(liq.id)
        setLiq(res.data)
      } catch { /* ignore */ }
    }
  }

  // ── Finalizar ───────────────────────────────────────────────────────────────
  const handleFinalizar = async () => {
    if (!liq) return
    await recalcular({ estado: liq.estado === 'borrador' ? 'finalizada' : 'borrador' })
    toast.success(liq.estado === 'borrador' ? 'Liquidación finalizada' : 'Volvió a borrador')
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Liquidación de Cirugías</h1>
          <p className="text-xs text-slate-500">ISS 2001 · ISS 2004 · SOAT</p>
        </div>
        {liq && (
          <button
            onClick={() => { setLiq(null); setResults([]); setQuery('') }}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <X size={14} /> Nueva búsqueda
          </button>
        )}
      </div>

      {/* Search bar */}
      {!liq && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-halu-500"
              placeholder="Buscar por documento, N° ingreso o CUPS..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 text-sm bg-halu-600 text-white rounded-lg hover:bg-halu-700 disabled:opacity-50 flex items-center gap-1"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Buscar
          </button>
        </div>
      )}

      {/* Search results */}
      {results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 border-b">
            {results.length} resultado(s) encontrado(s)
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {['DQX','CUPS','Descripción','Cirujano','Fecha','Paciente','Documento','Ingreso','Liquidación'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-slate-600 font-medium">{h}</th>
                ))}
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(r => (
                <tr key={r.dqx_id} className="hover:bg-slate-50">
                  <td className="px-2 py-1.5 font-mono font-medium text-slate-700">{r.dqx_numero}</td>
                  <td className="px-2 py-1.5 font-mono">{r.cups}</td>
                  <td className="px-2 py-1.5 text-slate-600 max-w-[160px] truncate">{r.descripcion}</td>
                  <td className="px-2 py-1.5">{r.cirujano}</td>
                  <td className="px-2 py-1.5">{r.fecha}</td>
                  <td className="px-2 py-1.5">{r.paciente_nombre}</td>
                  <td className="px-2 py-1.5 font-mono">{r.paciente_doc}</td>
                  <td className="px-2 py-1.5">{r.numero_ingreso}</td>
                  <td className="px-2 py-1.5">
                    {r.liquidacion_id
                      ? <span className="text-green-600 font-medium">Existente</span>
                      : <span className="text-amber-600">Nueva</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => handleSelectDQX(r)}
                      className="px-2 py-1 bg-halu-600 text-white rounded text-xs hover:bg-halu-700"
                    >
                      {r.liquidacion_id ? 'Ver' : 'Crear'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-halu-500" />
        </div>
      )}

      {/* Liquidacion panel */}
      {liq && !loading && (
        <div className="space-y-4">
          {/* Info header */}
          <div className="bg-white border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-slate-400 uppercase font-medium mb-0.5">Paciente</p>
              <p className="font-semibold text-slate-800">{liq.paciente_nombre || '—'}</p>
              <p className="text-slate-500 font-mono">{liq.paciente_doc}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-medium mb-0.5">Ingreso</p>
              <p className="font-semibold text-slate-800">{liq.numero_ingreso || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-medium mb-0.5">DQX / CUPS</p>
              <p className="font-semibold text-slate-800">{liq.dqx_numero} · {liq.dqx_cups}</p>
              <p className="text-slate-500 truncate">{liq.dqx_descripcion}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-medium mb-0.5">Cirujano / Anestesiólogo</p>
              <p className="text-slate-700">{liq.dqx_cirujano || '—'}</p>
              <p className="text-slate-500">{liq.dqx_anestesiologo || '—'}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white border rounded-lg p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tarifario</label>
              <div className="flex gap-1">
                {TARIFARIOS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => onChangeTarifario(t.value)}
                    className={clsx(
                      'px-3 py-1.5 text-xs rounded font-medium border transition-colors',
                      liq.tipo_tarifario === t.value
                        ? 'bg-halu-600 text-white border-halu-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-halu-400'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Tipo de liquidación</label>
              <select
                value={liq.tipo_liquidacion}
                onChange={e => onChangeTipoLiq(e.target.value)}
                className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-halu-500 pr-6"
              >
                {TIPOS_LIQUIDACION.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2 ml-auto">
              <span className={clsx('text-xs px-2 py-1 rounded-full', ESTADO_COLORS[liq.estado] || 'bg-slate-100 text-slate-600')}>
                {liq.estado.charAt(0).toUpperCase() + liq.estado.slice(1)}
              </span>
              {recalculating && <Loader2 size={14} className="animate-spin text-halu-500" />}
              <button
                onClick={() => recalcular({})}
                disabled={recalculating}
                className="flex items-center gap-1 text-xs px-3 py-1.5 border rounded hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={12} /> Recalcular
              </button>
              <button
                onClick={handleFinalizar}
                disabled={recalculating}
                className={clsx(
                  'flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium disabled:opacity-50',
                  liq.estado === 'borrador'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                )}
              >
                <CheckCircle size={12} />
                {liq.estado === 'borrador' ? 'Finalizar' : 'Reabrir'}
              </button>
            </div>
          </div>

          {/* Procedures table */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Procedimientos ({liq.procedimientos.length})</span>
              <button
                onClick={() => setShowAddForm(v => !v)}
                className="flex items-center gap-1 text-xs text-halu-600 hover:text-halu-800 font-medium"
              >
                <Plus size={13} /> Agregar procedimiento
              </button>
            </div>

            {/* Add form */}
            {showAddForm && (
              <div className="px-3 py-2 bg-blue-50 border-b flex flex-wrap gap-2 items-end">
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Orden</label>
                  <input type="number" min="1" value={addOrden} onChange={e => setAddOrden(e.target.value)}
                    placeholder="Auto" className="w-16 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-halu-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">CUPS *</label>
                  <input value={addCups} onChange={e => setAddCups(e.target.value)}
                    placeholder="ej. 5721001" className="w-28 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-halu-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Descripción</label>
                  <input value={addDesc} onChange={e => setAddDesc(e.target.value)}
                    placeholder="Descripción (opcional)" className="w-48 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-halu-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-0.5">Valor base</label>
                  <input type="number" min="0" value={addValor} onChange={e => setAddValor(e.target.value)}
                    placeholder="0 = buscar tarifario" className="w-36 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-halu-500" />
                </div>
                <button onClick={handleAgregar} disabled={adding || !addCups}
                  className="flex items-center gap-1 px-3 py-1 bg-halu-600 text-white text-xs rounded hover:bg-halu-700 disabled:opacity-50">
                  {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar
                </button>
                <button onClick={() => setShowAddForm(false)} className="text-xs text-slate-500 hover:text-slate-700">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-slate-600 font-medium w-8">#</th>
                    <th className="px-2 py-1.5 text-left text-slate-600 font-medium">CUPS</th>
                    <th className="px-2 py-1.5 text-left text-slate-600 font-medium">Descripción</th>
                    <th className="px-2 py-1.5 text-right text-slate-600 font-medium">Valor Base</th>
                    <th className="px-2 py-1.5 text-right text-blue-600 font-medium">% Cir</th>
                    <th className="px-2 py-1.5 text-right text-blue-600 font-medium">Cirujano</th>
                    <th className="px-2 py-1.5 text-right text-purple-600 font-medium">% Anest</th>
                    <th className="px-2 py-1.5 text-right text-purple-600 font-medium">Anestesiólogo</th>
                    <th className="px-2 py-1.5 text-right text-indigo-600 font-medium">% Ayud</th>
                    <th className="px-2 py-1.5 text-right text-indigo-600 font-medium">Ayudante</th>
                    <th className="px-2 py-1.5 text-right text-emerald-600 font-medium">% Quir</th>
                    <th className="px-2 py-1.5 text-right text-emerald-600 font-medium">Quirófano</th>
                    <th className="px-2 py-1.5 text-right text-orange-600 font-medium">% Mat</th>
                    <th className="px-2 py-1.5 text-right text-orange-600 font-medium">Materiales</th>
                    <th className="px-2 py-1.5 text-right text-slate-700 font-medium">Subtotal</th>
                    <th className="px-2 py-1.5 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {liq.procedimientos.length === 0 && (
                    <tr>
                      <td colSpan={16} className="py-6 text-center text-slate-400">
                        Sin procedimientos — agregue al menos uno
                      </td>
                    </tr>
                  )}
                  {liq.procedimientos.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-2 py-1.5 font-mono font-bold text-slate-500">{p.orden}</td>
                      <td className="px-2 py-1.5 font-mono">{p.cups}</td>
                      <td className="px-2 py-1.5 text-slate-600 max-w-[160px] truncate">{p.descripcion}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmt(p.valor_base)}</td>
                      <td className="px-2 py-1.5 text-right text-blue-600">{p.pct_cirujano}%</td>
                      <td className="px-2 py-1.5 text-right font-mono text-blue-700">{fmt(p.valor_cirujano)}</td>
                      <td className="px-2 py-1.5 text-right text-purple-600">{p.pct_anestesiologo}%</td>
                      <td className="px-2 py-1.5 text-right font-mono text-purple-700">{fmt(p.valor_anestesiologo)}</td>
                      <td className="px-2 py-1.5 text-right text-indigo-600">{p.pct_ayudante}%</td>
                      <td className="px-2 py-1.5 text-right font-mono text-indigo-700">{fmt(p.valor_ayudante)}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-600">{p.pct_quirofano}%</td>
                      <td className="px-2 py-1.5 text-right font-mono text-emerald-700">{fmt(p.valor_quirofano)}</td>
                      <td className="px-2 py-1.5 text-right text-orange-600">{p.pct_materiales}%</td>
                      <td className="px-2 py-1.5 text-right font-mono text-orange-700">{fmt(p.valor_materiales)}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-800">{fmt(p.subtotal)}</td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => handleEliminar(p.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary table */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b">
              <span className="text-xs font-medium text-slate-700">Resumen de liquidación</span>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-1.5 text-left text-slate-600 font-medium">Servicio</th>
                  <th className="px-3 py-1.5 text-right text-slate-600 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { label: 'Cirujano',        value: liq.total_cirujano,      color: 'text-blue-700',    dot: 'bg-blue-500' },
                  { label: 'Anestesiólogo',   value: liq.total_anestesiologo, color: 'text-purple-700',  dot: 'bg-purple-500' },
                  { label: 'Ayudante quirúrgico', value: liq.total_ayudante, color: 'text-indigo-700',  dot: 'bg-indigo-500' },
                  { label: 'Quirófano (sala)', value: liq.total_quirofano,    color: 'text-emerald-700', dot: 'bg-emerald-500' },
                  { label: 'Materiales',       value: liq.total_materiales,   color: 'text-orange-700',  dot: 'bg-orange-500' },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="px-3 py-2 flex items-center gap-2">
                      <span className={clsx('w-2 h-2 rounded-full', row.dot)} />
                      {row.label}
                    </td>
                    <td className={clsx('px-3 py-2 text-right font-mono font-semibold', row.color)}>
                      {fmt(row.value)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td className="px-3 py-2 text-slate-800 text-sm">Total general</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-900 text-sm">{fmt(liq.total_general)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Observaciones */}
          <div className="bg-white border rounded-lg p-3">
            <label className="block text-xs text-slate-500 mb-1">Observaciones</label>
            <textarea
              rows={2}
              value={liq.observaciones}
              onChange={e => setLiq(prev => prev ? { ...prev, observaciones: e.target.value } : prev)}
              onBlur={e => recalcular({ observaciones: e.target.value })}
              className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-halu-500 resize-none"
              placeholder="Observaciones adicionales..."
            />
          </div>
        </div>
      )}
    </div>
  )
}
