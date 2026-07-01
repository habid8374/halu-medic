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
  grupo_soat: number | null
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
  ajuste_pct: string
  valor_smdlv: string
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
  const [addGrupo, setAddGrupo]       = useState('')
  const [adding, setAdding]           = useState(false)
  const [ajusteInput, setAjusteInput] = useState('')
  const [smdlvInput, setSmdlvInput]   = useState('')

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
      let data = res.data
      // Si no hay procedimientos, agregar el del DQX automáticamente
      if (data.procedimientos?.length === 0 && data.dqx_cups) {
        try {
          await liquidacionCxAPI.agregarProcedimiento(id, {
            cups: data.dqx_cups,
            descripcion: data.dqx_descripcion || '',
            orden: 1,
          })
          const refres = await liquidacionCxAPI.get(id)
          data = refres.data
        } catch (_) { /* mostrar igual */ }
      }
      // Si algún procedimiento tiene UVR=0, recalcular para re-leer del tarifario
      const tieneUvrCero = data.procedimientos?.some((p: {valor_base: string}) => Number(p.valor_base) === 0)
      if (tieneUvrCero) {
        try {
          const refres = await liquidacionCxAPI.recalcular(id, {})
          data = refres.data
        } catch (_) { /* mostrar igual */ }
      }
      setLiq(data)
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
      const res = await liquidacionCxAPI.agregarProcedimiento(liq.id, {
        cups: addCups,
        descripcion: addDesc,
        valor_base: addValor || 0,
        grupo_soat: addGrupo || null,
      })
      setLiq(res.data)
      setShowAddForm(false)
      setAddCups(''); setAddDesc(''); setAddValor(''); setAddGrupo('')
      toast.success('Procedimiento agregado — orden asignado por UVR')
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setAdding(false)
    }
  }

  // ── Editar UVR/grupo de un procedimiento ────────────────────────────────────
  const handleEditarProc = async (procId: string, data: Record<string, unknown>) => {
    if (!liq) return
    try {
      const res = await liquidacionCxAPI.editarProcedimiento(liq.id, procId, data)
      setLiq(res.data)
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  // ── Eliminar procedimiento ──────────────────────────────────────────────────
  const handleEliminar = async (procId: string) => {
    if (!liq) return
    if (!confirm('¿Eliminar este procedimiento?')) return
    try {
      const res = await liquidacionCxAPI.eliminarProcedimiento(liq.id, procId)
      setLiq(res.data)
      toast.success('Procedimiento eliminado')
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  // ── Finalizar ───────────────────────────────────────────────────────────────
  const handleFinalizar = async () => {
    if (!liq) return
    await recalcular({ estado: liq.estado === 'borrador' ? 'finalizada' : 'borrador' })
    toast.success(liq.estado === 'borrador' ? 'Liquidación finalizada' : 'Volvió a borrador')
  }

  const editable = liq?.estado === 'borrador'

  useEffect(() => {
    if (liq) {
      setAjusteInput(String(Number(liq.ajuste_pct ?? 0)))
      setSmdlvInput(String(Number(liq.valor_smdlv ?? 0)))
    }
  }, [liq?.id, liq?.ajuste_pct, liq?.valor_smdlv])

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

      {/* Search results — tarjetas clickeables (mobile-friendly) */}
      {results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 border-b">
            {results.length} resultado(s) encontrado(s) — toca para abrir
          </div>
          <div className="divide-y divide-slate-100">
            {results.map(r => (
              <button
                key={r.dqx_id}
                onClick={() => handleSelectDQX(r)}
                className="w-full text-left px-3 py-3 hover:bg-halu-50 active:bg-halu-100 transition-colors flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-slate-800 text-sm">{r.dqx_numero}</span>
                    <span className="font-mono text-halu-700 text-sm font-medium">{r.cups}</span>
                    {r.liquidacion_id
                      ? <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Existente</span>
                      : <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Nueva</span>}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 truncate">{r.descripcion}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {r.paciente_nombre} · {r.paciente_doc} · Ingreso {r.numero_ingreso} · {r.fecha}
                  </div>
                  {r.cirujano && <div className="text-xs text-slate-400">{r.cirujano}</div>}
                </div>
                <span className="shrink-0 px-3 py-1.5 bg-halu-600 text-white rounded-lg text-xs font-medium mt-0.5">
                  {r.liquidacion_id ? 'Ver' : 'Crear'}
                </span>
              </button>
            ))}
          </div>
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
                    disabled={!editable}
                    className={clsx(
                      'px-3 py-1.5 text-xs rounded font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
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
                disabled={!editable}
                className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-halu-500 pr-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {TIPOS_LIQUIDACION.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {liq.tipo_tarifario === 'SOAT' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Valor SMDLV del año</label>
                <input
                  type="number"
                  step="1"
                  value={smdlvInput}
                  onChange={e => setSmdlvInput(e.target.value)}
                  onBlur={() => {
                    const v = smdlvInput === '' ? '0' : smdlvInput
                    if (Number(v) !== Number(liq.valor_smdlv)) recalcular({ valor_smdlv: v })
                  }}
                  disabled={!editable}
                  className="w-28 text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-halu-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="ej. 54117"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Ajuste % {liq.tipo_tarifario === 'SOAT' && <span className="text-amber-600">(contractual)</span>}
              </label>
              <input
                type="number"
                step="0.01"
                value={ajusteInput}
                onChange={e => setAjusteInput(e.target.value)}
                onBlur={() => {
                  const v = ajusteInput === '' ? '0' : ajusteInput
                  if (Number(v) !== Number(liq.ajuste_pct)) recalcular({ ajuste_pct: v })
                }}
                disabled={!editable}
                className="w-24 text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-halu-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="0"
              />
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
              {editable && (
                <button
                  onClick={() => setShowAddForm(v => !v)}
                  className="flex items-center gap-1 text-xs text-halu-600 hover:text-halu-800 font-medium"
                >
                  <Plus size={13} /> Agregar procedimiento
                </button>
              )}
            </div>

            {/* Add form */}
            {showAddForm && editable && (
              <div className="px-3 py-2 bg-blue-50 border-b flex flex-wrap gap-2 items-end">
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
                {liq.tipo_tarifario === 'SOAT' ? (
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">Grupo Qx SOAT *</label>
                    <select value={addGrupo} onChange={e => setAddGrupo(e.target.value)}
                      className="w-32 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-halu-500">
                      <option value="">Seleccione...</option>
                      {[2,3,4,5,6,7,8,9,10,11,12,13,20,21,22,23].map(g => (
                        <option key={g} value={g}>Grupo {g}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-slate-500 mb-0.5">Puntos UVR</label>
                    <input type="number" min="0" value={addValor} onChange={e => setAddValor(e.target.value)}
                      placeholder="0 = buscar tarifario" className="w-36 text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-halu-500" />
                  </div>
                )}
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
                    <th className="px-2 py-1.5 text-right text-slate-600 font-medium">UVR / Grupo</th>
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
                    <tr key={p.id} className={clsx('hover:bg-slate-50', p.orden > 3 && 'bg-amber-50')}>
                      <td className="px-2 py-1.5 font-mono font-bold text-slate-500">
                        {p.orden}
                        {p.orden > 3 && <span title="Del 4° procedimiento en adelante no liquida (0%)" className="ml-1 text-amber-600">⚠</span>}
                      </td>
                      <td className="px-2 py-1.5 font-mono">{p.cups}</td>
                      <td className="px-2 py-1.5 text-slate-600 max-w-[160px] truncate">{p.descripcion}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-500">
                        {liq.tipo_tarifario === 'SOAT' ? (
                          editable ? (
                            <select
                              key={`${p.id}-${p.grupo_soat ?? ''}`}
                              defaultValue={p.grupo_soat ?? ''}
                              onChange={e => handleEditarProc(p.id, { grupo_soat: e.target.value || null })}
                              className="w-16 text-xs border rounded px-1 py-0.5 text-right focus:outline-none focus:ring-1 focus:ring-halu-500"
                            >
                              <option value="">—</option>
                              {[2,3,4,5,6,7,8,9,10,11,12,13,20,21,22,23].map(g => (
                                <option key={g} value={g}>G{g}</option>
                              ))}
                            </select>
                          ) : (p.grupo_soat ? <span className="text-halu-700 font-semibold">G{p.grupo_soat}</span> : '—')
                        ) : (
                          editable ? (
                            <input
                              key={`${p.id}-${p.valor_base}`}
                              type="number"
                              min="0"
                              defaultValue={Number(p.valor_base)}
                              onBlur={e => {
                                const v = Number(e.target.value || 0)
                                if (v !== Number(p.valor_base)) handleEditarProc(p.id, { valor_base: v })
                              }}
                              className={clsx(
                                'w-20 text-xs border rounded px-1 py-0.5 text-right font-mono focus:outline-none focus:ring-1 focus:ring-halu-500',
                                Number(p.valor_base) === 0 && 'border-amber-400 bg-amber-50'
                              )}
                              title="Puntos UVR — editar y salir del campo para recalcular"
                            />
                          ) : `${Number(p.valor_base).toLocaleString('es-CO')} uvr`
                        )}
                      </td>
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
                        {editable && (
                          <button onClick={() => handleEliminar(p.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-1.5 bg-slate-50 border-t text-[11px] text-slate-400">
              El orden se asigna automáticamente ({liq.tipo_tarifario === 'SOAT' ? 'mayor grupo quirúrgico' : 'mayor UVR'} liquida al 100%).
              {liq.tipo_tarifario === 'SOAT' && Number(liq.valor_smdlv) === 0 &&
                <span className="text-amber-600"> Configure el valor SMDLV del año y los grupos quirúrgicos en Tarifas para liquidar por manual SOAT; sin ellos se usa base ISS 2001 + ajuste %.</span>}
              {liq.procedimientos.some(p => p.orden > 3) &&
                <span className="text-amber-600"> Los procedimientos del 4° en adelante liquidan en $0.</span>}
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
              onBlur={async e => {
                try { await liquidacionCxAPI.update(liq.id, { observaciones: e.target.value }) }
                catch (err) { toast.error(mensajeError(err)) }
              }}
              className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-halu-500 resize-none"
              placeholder="Observaciones adicionales..."
            />
          </div>
        </div>
      )}
    </div>
  )
}
