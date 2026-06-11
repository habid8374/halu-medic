'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { prefacturaAPI, itemPrefacturaAPI, liquidacionCxAPI, mensajeError } from '@/lib/api'
import BuscadorPacienteIngreso from '@/components/ui/BuscadorPacienteIngreso'
import type { PacienteResumen, IngresoResumen } from '@/components/ui/BuscadorPacienteIngreso'
import toast from 'react-hot-toast'
import { ArrowLeft, User, BedDouble, Search, FileText, Loader2, Scissors, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

const INPUT = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 focus:border-halu-400 bg-white'

interface LiquidacionCx {
  id: string
  dqx_cups: string | null
  dqx_descripcion: string | null
  dqx_numero: string | null
  estado: string
  total_cirujano: string
  total_anestesiologo: string
  total_ayudante: string
  total_quirofano: string
  total_materiales: string
  total_general: string
}

type ItemKey = 'cirujano' | 'anestesiologo' | 'ayudante' | 'quirofano' | 'materiales'

const ITEM_LABELS: Record<ItemKey, string> = {
  cirujano:      'Cirujano',
  anestesiologo: 'Anestesiólogo',
  ayudante:      'Ayudante',
  quirofano:     'Quirófano',
  materiales:    'Materiales',
}

function totalField(liq: LiquidacionCx, key: ItemKey): number {
  const map: Record<ItemKey, string> = {
    cirujano:      liq.total_cirujano,
    anestesiologo: liq.total_anestesiologo,
    ayudante:      liq.total_ayudante,
    quirofano:     liq.total_quirofano,
    materiales:    liq.total_materiales,
  }
  return parseFloat(map[key]) || 0
}

function fmt(v: string | number) {
  return Number(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

export default function NuevaPrefacturaPage() {
  const router = useRouter()

  const [paciente, setPaciente]   = useState<PacienteResumen | null>(null)
  const [ingreso, setIngreso]     = useState<IngresoResumen | null>(null)
  const [showBuscador, setShowBuscador] = useState(false)

  const [form, setForm] = useState({
    convenio: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin:    new Date().toISOString().split('T')[0],
    observaciones: '',
  })
  const [saving, setSaving] = useState(false)

  // Cirugías liquidadas
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionCx[]>([])
  const [cxExpanded, setCxExpanded] = useState(false)
  // checked[liqId][itemKey] = true/false
  const [checked, setChecked] = useState<Record<string, Record<ItemKey, boolean>>>({})

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSelect = (p: PacienteResumen, ing: IngresoResumen | null) => {
    setPaciente(p)
    setIngreso(ing)
    if (ing?.fecha_ingreso) {
      const today = new Date().toISOString().split('T')[0]
      setForm(f => ({ ...f, fecha_inicio: ing.fecha_ingreso.split('T')[0], fecha_fin: today }))
    }
    setShowBuscador(false)
  }

  // Fetch liquidaciones finalizadas cuando cambia el ingreso
  useEffect(() => {
    if (!ingreso?.id) {
      setLiquidaciones([])
      setChecked({})
      setCxExpanded(false)
      return
    }
    liquidacionCxAPI.porIngreso(String(ingreso.id)).then(({ data }) => {
      const results: LiquidacionCx[] = data.results ?? data
      setLiquidaciones(results)
      if (results.length > 0) {
        setCxExpanded(true)
        // pre-marcar todos los ítems con valor > 0
        const init: Record<string, Record<ItemKey, boolean>> = {}
        for (const liq of results) {
          init[liq.id] = {
            cirujano:      parseFloat(liq.total_cirujano) > 0,
            anestesiologo: parseFloat(liq.total_anestesiologo) > 0,
            ayudante:      parseFloat(liq.total_ayudante) > 0,
            quirofano:     parseFloat(liq.total_quirofano) > 0,
            materiales:    parseFloat(liq.total_materiales) > 0,
          }
        }
        setChecked(init)
      }
    }).catch(() => {
      // silencioso: no bloquear flujo si el endpoint falla
    })
  }, [ingreso?.id])

  const toggleItem = (liqId: string, key: ItemKey) => {
    setChecked(prev => ({
      ...prev,
      [liqId]: { ...prev[liqId], [key]: !prev[liqId]?.[key] }
    }))
  }

  const crear = async () => {
    if (!paciente) { toast.error('Selecciona un paciente'); return }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        paciente: paciente.id,
        fecha_inicio: form.fecha_inicio,
        fecha_fin:    form.fecha_fin,
        observaciones: form.observaciones,
      }
      if (ingreso)      payload.ingreso  = ingreso.id
      if (form.convenio) payload.convenio = form.convenio
      const { data } = await prefacturaAPI.create(payload)
      const prefacturaId: string = data.id

      // Importar ítems de cirugías seleccionadas
      const keys: ItemKey[] = ['cirujano', 'anestesiologo', 'ayudante', 'quirofano', 'materiales']
      const itemPromises: Promise<unknown>[] = []
      for (const liq of liquidaciones) {
        const sel = checked[liq.id] ?? {}
        for (const key of keys) {
          if (!sel[key]) continue
          const valor = totalField(liq, key)
          if (valor <= 0) continue
          const cups = liq.dqx_cups || null
          const descripcion = `${ITEM_LABELS[key]}${liq.dqx_descripcion ? ` - ${liq.dqx_descripcion}` : ''}`
          itemPromises.push(
            itemPrefacturaAPI.create({
              prefactura: prefacturaId,
              descripcion,
              cantidad: 1,
              valor_unitario: valor,
              ...(cups ? { cups } : {}),
            })
          )
        }
      }
      if (itemPromises.length > 0) {
        await Promise.all(itemPromises)
        toast.success(`Prefactura creada con ${itemPromises.length} ítem(s) de cirugía importados`)
      } else {
        toast.success('Prefactura creada')
      }
      router.push(`/facturacion/prefactura/${prefacturaId}`)
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setSaving(false)
    }
  }

  const hayItemsSeleccionados = liquidaciones.some(liq =>
    (['cirujano', 'anestesiologo', 'ayudante', 'quirofano', 'materiales'] as ItemKey[]).some(
      k => checked[liq.id]?.[k] && totalField(liq, k) > 0
    )
  )

  return (
    <div className="page-padding animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/facturacion/prefacturas"
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-10 h-10 bg-violet-100 rounded-2xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nueva prefactura</h1>
          <p className="text-sm text-slate-500">Selecciona paciente e ingreso para preliquidar</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">

        {/* Paciente */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">Paciente *</label>
          <button
            type="button"
            onClick={() => setShowBuscador(true)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:border-halu-400 transition-colors text-left"
          >
            {paciente ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-halu-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-halu-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{paciente.nombre_completo}</p>
                  <p className="text-xs text-slate-500">{paciente.tipo_documento} {paciente.numero_documento}</p>
                </div>
              </div>
            ) : (
              <span className="text-sm text-slate-400">Buscar paciente por nombre o documento...</span>
            )}
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>
        </div>

        {/* Ingreso asociado */}
        {paciente && (
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Ingreso asociado</label>
            {ingreso ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                <BedDouble className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {ingreso.numero_ingreso ? `Ingreso #${ingreso.numero_ingreso}` : 'Ingreso'} · {ingreso.tipo_ingreso_display || ingreso.tipo_ingreso}
                  </p>
                  {ingreso.servicio && <p className="text-xs text-slate-500">{ingreso.servicio}</p>}
                </div>
                <button onClick={() => setIngreso(null)} className="text-xs text-slate-400 hover:text-slate-600">
                  Quitar
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 px-1">Sin ingreso (consulta ambulatoria)</p>
            )}
          </div>
        )}

        {/* ── Cirugías liquidadas ──────────────────────────────────────── */}
        {liquidaciones.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
            <button
              type="button"
              onClick={() => setCxExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">
                  Cirugías liquidadas ({liquidaciones.length})
                </span>
                {hayItemsSeleccionados && (
                  <span className="text-xs bg-emerald-600 text-white rounded-full px-2 py-0.5">
                    Importar seleccionados
                  </span>
                )}
              </div>
              {cxExpanded
                ? <ChevronUp className="w-4 h-4 text-emerald-600" />
                : <ChevronDown className="w-4 h-4 text-emerald-600" />
              }
            </button>

            {cxExpanded && (
              <div className="border-t border-emerald-200 px-4 pb-4 space-y-4 pt-3">
                {liquidaciones.map(liq => (
                  <div key={liq.id} className="bg-white rounded-xl border border-emerald-100 p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {liq.dqx_numero ? `DQX #${liq.dqx_numero}` : 'Cirugía'}
                      </span>
                      {liq.dqx_cups && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                          {liq.dqx_cups}
                        </span>
                      )}
                      {liq.dqx_descripcion && (
                        <span className="text-xs text-slate-500 truncate">{liq.dqx_descripcion}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {(['cirujano', 'anestesiologo', 'ayudante', 'quirofano', 'materiales'] as ItemKey[]).map(key => {
                        const valor = totalField(liq, key)
                        if (valor <= 0) return null
                        const isChecked = checked[liq.id]?.[key] ?? false
                        return (
                          <label
                            key={key}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isChecked ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-100 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleItem(liq.id, key)}
                                className="accent-emerald-600"
                              />
                              <span className="text-xs font-medium text-slate-700">{ITEM_LABELS[key]}</span>
                            </div>
                            <span className="text-xs font-semibold text-slate-800">{fmt(valor)}</span>
                          </label>
                        )
                      })}
                    </div>

                    <div className="flex justify-end pt-1">
                      <span className="text-xs text-slate-500">
                        Total liquidación: <span className="font-semibold text-slate-700">{fmt(liq.total_general)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Período */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Fecha inicio período *</label>
            <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Fecha fin período *</label>
            <input type="date" value={form.fecha_fin} onChange={set('fecha_fin')} className={INPUT} />
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1.5">Observaciones</label>
          <textarea
            value={form.observaciones}
            onChange={set('observaciones')}
            rows={3}
            placeholder="Notas internas sobre esta preliquidación..."
            className={INPUT}
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <Link href="/facturacion/prefacturas"
            className="flex-1 text-center px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </Link>
          <button
            onClick={crear}
            disabled={saving || !paciente}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {hayItemsSeleccionados ? 'Crear e importar cirugías' : 'Crear prefactura'}
          </button>
        </div>
      </div>

      {showBuscador && (
        <BuscadorPacienteIngreso
          onSelect={handleSelect}
          onClose={() => setShowBuscador(false)}
          titulo="Seleccionar paciente"
        />
      )}
    </div>
  )
}
