'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import api, { mensajeError, catalogoMedicamentosAPI } from '@/lib/api'
import { PageHeader, Button, Badge, EmptyState, Card, BuscadorPacienteIngreso } from '@/components/ui'
import { Plus, Search, Package, AlertTriangle, Pill, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Medicamento {
  id: string
  nombre_generico: string
  concentracion: string
  forma_farmaceutica: string
  stock_actual: number
  stock_minimo: number
  precio_unitario: string
  unidad_medida: string
  cum: string
  requiere_formula: boolean
  medicamento_alto_riesgo: boolean
}

interface Dispensacion {
  id: string
  paciente_nombre: string
  medicamento_nombre: string
  cantidad: number
  estado: 'pendiente' | 'dispensado' | 'devuelto'
  estado_display: string
  fecha: string
  dosis: string
  via_administracion: string
}

interface Movimiento {
  id: string
  tipo: string
  tipo_display: string
  medicamento_nombre: string
  cantidad: number
  fecha: string
  usuario_nombre: string
  observaciones: string
}

const estadoBadge = (e: string) => {
  if (e === 'dispensado') return 'success'
  if (e === 'pendiente')  return 'warning'
  return 'default'
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

export default function FarmaciaPage() {
  const [tab, setTab] = useState<'inventario' | 'dispensaciones' | 'movimientos'>('inventario')
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [dispensaciones, setDispensaciones] = useState<Dispensacion[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [showNuevoMed, setShowNuevoMed] = useState(false)
  const [showNuevoDisp, setShowNuevoDisp] = useState(false)
  const [editando, setEditando] = useState<Medicamento | null>(null)

  const cargarMedicamentos = async () => {
    try {
      const { data } = await api.get('/api/farmacia/medicamentos/', { params: { page_size: 500 } })
      setMedicamentos(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const cargarDispensaciones = async () => {
    try {
      const { data } = await api.get('/api/farmacia/dispensaciones/')
      setDispensaciones(data.results ?? data)
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const cargarMovimientos = async () => {
    try {
      const { data } = await api.get('/api/farmacia/lotes/')
      setMovimientos(data.results ?? data)
    } catch { /* silencioso si no hay lotes */ }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([cargarMedicamentos(), cargarDispensaciones(), cargarMovimientos()])
      .finally(() => setLoading(false))
  }, [])

  const medicamentosFiltrados = useMemo(() =>
    medicamentos.filter(m =>
      m.nombre_generico.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.cum?.includes(busqueda)
    ), [medicamentos, busqueda])

  const bajoStock = medicamentos.filter(m => m.stock_actual <= m.stock_minimo).length
  const dispensadosHoy = dispensaciones.filter(d => {
    const hoy = new Date().toISOString().slice(0, 10)
    return d.fecha?.startsWith(hoy) && d.estado === 'dispensado'
  }).length

  const stockColor = (m: Medicamento) => {
    if (m.stock_actual === 0) return 'text-red-600 bg-red-50'
    if (m.stock_actual <= m.stock_minimo) return 'text-amber-600 bg-amber-50'
    return 'text-emerald-600 bg-emerald-50'
  }

  const stockBar = (m: Medicamento) => {
    const pct = m.stock_minimo > 0 ? Math.min((m.stock_actual / (m.stock_minimo * 3)) * 100, 100) : 100
    const color = m.stock_actual === 0 ? 'bg-red-500' : m.stock_actual <= m.stock_minimo ? 'bg-amber-400' : 'bg-emerald-500'
    return { pct, color }
  }

  const TABS = [
    { id: 'inventario', label: 'Inventario' },
    { id: 'dispensaciones', label: 'Dispensaciones' },
    { id: 'movimientos', label: 'Movimientos' },
  ] as const

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Farmacia"
        description="Control de inventario, dispensaciones y movimientos de medicamentos"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowNuevoMed(true)}>
              <Plus className="w-4 h-4" /> Nuevo medicamento
            </Button>
            <Button onClick={() => setShowNuevoDisp(true)}>
              <Plus className="w-4 h-4" /> Nueva dispensación
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border animate-pulse h-20" />
          ))
        ) : (
          <>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-halu-100 rounded-xl flex items-center justify-center">
                <Pill className="w-5 h-5 text-halu-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{medicamentos.length}</p>
                <p className="text-xs text-slate-500">Total medicamentos</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{bajoStock}</p>
                <p className="text-xs text-slate-500">Alertas stock bajo</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{dispensadosHoy}</p>
                <p className="text-xs text-slate-500">Dispensados hoy</p>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Inventario */}
      {tab === 'inventario' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20"
              placeholder="Buscar por nombre genérico o CUM..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-20" />)
          ) : medicamentosFiltrados.length === 0 ? (
            <EmptyState title="Sin medicamentos" description="No hay medicamentos que coincidan con la búsqueda" />
          ) : (
            <div className="space-y-2">
              {medicamentosFiltrados.map(m => {
                const { pct, color } = stockBar(m)
                return (
                  <div key={m.id} className="bg-white rounded-xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{m.nombre_generico}</span>
                          <span className="text-xs text-slate-500">{m.concentracion} · {m.forma_farmaceutica}</span>
                          {m.medicamento_alto_riesgo && (
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Alto riesgo</span>
                          )}
                          {m.requiere_formula && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Requiere fórmula</span>
                          )}
                        </div>
                        {m.cum && <p className="text-xs text-slate-400 mt-0.5">CUM: {m.cum}</p>}
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-500">Stock: {m.stock_actual} {m.unidad_medida} / mín. {m.stock_minimo}</span>
                            <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', stockColor(m))}>
                              {m.stock_actual === 0 ? 'Agotado' : m.stock_actual <= m.stock_minimo ? 'Stock bajo' : 'Disponible'}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <p className="text-sm font-bold text-slate-800">
                          ${parseFloat(m.precio_unitario || '0').toLocaleString('es-CO')}
                        </p>
                        <p className="text-xs text-slate-400">por {m.unidad_medida}</p>
                        <button onClick={() => setEditando(m)}
                          className="text-xs text-halu-600 hover:text-halu-800 font-medium mt-1 underline">
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Dispensaciones */}
      {tab === 'dispensaciones' && (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-20" />)
          ) : dispensaciones.length === 0 ? (
            <EmptyState title="Sin dispensaciones" description="Las dispensaciones aparecerán aquí" />
          ) : (
            dispensaciones.map(d => (
              <div key={d.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 text-sm">{d.paciente_nombre}</span>
                    <Badge variant={estadoBadge(d.estado)}>{d.estado_display}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{d.medicamento_nombre} · {d.cantidad} unidades · {d.dosis} vía {d.via_administracion}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{d.fecha ? new Date(d.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Movimientos */}
      {tab === 'movimientos' && (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-white rounded-xl border animate-pulse h-20" />)
          ) : movimientos.length === 0 ? (
            <EmptyState title="Sin movimientos" description="Los movimientos de inventario aparecerán aquí" />
          ) : (
            movimientos.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 text-sm">{m.medicamento_nombre}</span>
                    <Badge variant={m.tipo === 'entrada' ? 'success' : 'danger'}>{m.tipo_display}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Cantidad: {m.cantidad} · {m.usuario_nombre}</p>
                  {m.observaciones && <p className="text-xs text-slate-400">{m.observaciones}</p>}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO') : ''}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {showNuevoMed && (
        <NuevoMedicamentoModal
          onClose={() => setShowNuevoMed(false)}
          onSaved={() => { setShowNuevoMed(false); cargarMedicamentos() }}
        />
      )}
      {showNuevoDisp && (
        <NuevoDispensacionModal
          medicamentos={medicamentos}
          onClose={() => setShowNuevoDisp(false)}
          onSaved={() => { setShowNuevoDisp(false); cargarDispensaciones() }}
        />
      )}
      {editando && (
        <EditarMedicamentoModal
          medicamento={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); cargarMedicamentos() }}
        />
      )}
    </div>
  )
}

function NuevoMedicamentoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nombre_generico: '', concentracion: '', forma_farmaceutica: '',
    stock_actual: '', stock_minimo: '', precio_unitario: '',
    unidad_medida: 'tableta', cum: '',
    requiere_formula: false, medicamento_alto_riesgo: false,
  })
  const [saving, setSaving] = useState(false)
  const [cumQuery, setCumQuery] = useState('')
  const [cumSugs, setCumSugs] = useState<{cum:string; principio_activo:string; concentracion:string; forma_farmaceutica:string}[]>([])
  const [cumBuscando, setCumBuscando] = useState(false)
  const [showCumSugs, setShowCumSugs] = useState(false)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscarCUM = (q: string) => {
    setCumQuery(q)
    setForm(f => ({ ...f, nombre_generico: q }))
    if (debRef.current) clearTimeout(debRef.current)
    if (q.length < 2) { setCumSugs([]); setShowCumSugs(false); return }
    debRef.current = setTimeout(async () => {
      setCumBuscando(true)
      try {
        const { data } = await catalogoMedicamentosAPI.search(q)
        setCumSugs((data.results ?? data).slice(0, 8))
        setShowCumSugs(true)
      } catch { /* silencioso */ }
      finally { setCumBuscando(false) }
    }, 300)
  }

  const seleccionarCUM = (s: {cum:string; principio_activo:string; concentracion:string; forma_farmaceutica:string}) => {
    setForm(f => ({ ...f, nombre_generico: s.principio_activo, cum: s.cum, concentracion: s.concentracion, forma_farmaceutica: s.forma_farmaceutica }))
    setCumQuery(s.principio_activo)
    setShowCumSugs(false)
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))
  const setCheck = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.checked }))

  const guardar = async () => {
    if (!form.nombre_generico || !form.stock_actual) { toast.error('Nombre y stock son requeridos'); return }
    setSaving(true)
    try {
      await api.post('/api/farmacia/medicamentos/', {
        ...form,
        stock_actual: Number(form.stock_actual),
        stock_minimo: Number(form.stock_minimo),
        precio_unitario: form.precio_unitario || '0',
      })
      toast.success('Medicamento registrado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Nuevo medicamento</h2>
            <p className="text-xs text-slate-500">Registrar medicamento en inventario</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 relative">
              <label className="text-xs font-medium text-slate-600 block mb-1">Nombre genérico / CUM *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input value={cumQuery} onChange={e => buscarCUM(e.target.value)}
                  className={`${INPUT} pl-9`} placeholder="Buscar en catálogo INVIMA..." />
                {cumBuscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
              </div>
              {showCumSugs && cumSugs.length > 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {cumSugs.map((s, i) => (
                    <button key={i} type="button" onClick={() => seleccionarCUM(s)}
                      className="w-full px-4 py-2.5 text-left hover:bg-halu-50 border-b border-slate-100 last:border-0">
                      <p className="text-sm font-medium text-slate-800">{s.principio_activo}</p>
                      <p className="text-xs text-slate-500">CUM: {s.cum} · {s.concentracion} · {s.forma_farmaceutica}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Concentración</label>
              <input value={form.concentracion} onChange={set('concentracion')} className={INPUT} placeholder="Ej. 500mg" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Forma farmacéutica</label>
              <select value={form.forma_farmaceutica} onChange={set('forma_farmaceutica')} className={INPUT}>
                <option value="">Seleccionar...</option>
                <option>Tableta</option><option>Cápsula</option><option>Jarabe</option>
                <option>Inyectable</option><option>Crema</option><option>Gotas</option>
                <option>Parche</option><option>Supositorio</option><option>Polvo</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Stock actual *</label>
              <input type="number" min="0" value={form.stock_actual} onChange={set('stock_actual')} className={INPUT} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Stock mínimo</label>
              <input type="number" min="0" value={form.stock_minimo} onChange={set('stock_minimo')} className={INPUT} placeholder="10" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Precio unitario (COP)</label>
              <input type="number" min="0" value={form.precio_unitario} onChange={set('precio_unitario')} className={INPUT} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Unidad de medida</label>
              <select value={form.unidad_medida} onChange={set('unidad_medida')} className={INPUT}>
                <option value="tableta">Tableta</option><option value="cápsula">Cápsula</option>
                <option value="ml">ml</option><option value="ampolla">Ampolla</option>
                <option value="frasco">Frasco</option><option value="sobre">Sobre</option>
                <option value="parche">Parche</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">CUM</label>
              <input value={form.cum} onChange={set('cum')} className={INPUT} placeholder="Código único de medicamentos" />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.requiere_formula} onChange={setCheck('requiere_formula')} className="rounded" />
              Requiere fórmula médica
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.medicamento_alto_riesgo} onChange={setCheck('medicamento_alto_riesgo')} className="rounded" />
              Medicamento de alto riesgo
            </label>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Guardar medicamento</Button>
        </div>
      </div>
    </div>
  )
}

function EditarMedicamentoModal({ medicamento, onClose, onSaved }: {
  medicamento: Medicamento; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    nombre_generico:       medicamento.nombre_generico,
    concentracion:         medicamento.concentracion,
    forma_farmaceutica:    medicamento.forma_farmaceutica,
    stock_actual:          String(medicamento.stock_actual),
    stock_minimo:          String(medicamento.stock_minimo),
    precio_unitario:       medicamento.precio_unitario,
    unidad_medida:         medicamento.unidad_medida,
    cum:                   medicamento.cum,
    requiere_formula:      medicamento.requiere_formula,
    medicamento_alto_riesgo: medicamento.medicamento_alto_riesgo,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))
  const setCheck = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.checked }))

  const guardar = async () => {
    setSaving(true)
    try {
      await api.patch(`/api/farmacia/medicamentos/${medicamento.id}/`, {
        ...form,
        stock_actual:  Number(form.stock_actual),
        stock_minimo:  Number(form.stock_minimo),
        precio_unitario: form.precio_unitario || '0',
      })
      toast.success('Medicamento actualizado')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Editar medicamento</h2>
            <p className="text-xs text-slate-500">{medicamento.nombre_generico}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Nombre genérico *</label>
              <input value={form.nombre_generico} onChange={set('nombre_generico')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">CUM</label>
              <input value={form.cum} onChange={set('cum')} className={INPUT} placeholder="Código único de medicamentos" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Concentración</label>
              <input value={form.concentracion} onChange={set('concentracion')} className={INPUT} placeholder="Ej. 500mg" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Forma farmacéutica</label>
              <select value={form.forma_farmaceutica} onChange={set('forma_farmaceutica')} className={INPUT}>
                <option value="">Seleccionar...</option>
                {['Tableta','Cápsula','Jarabe','Inyectable','Solución','Crema','Gotas','Parche','Supositorio','Polvo','Ampolla','Frasco'].map(f =>
                  <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Unidad de medida</label>
              <select value={form.unidad_medida} onChange={set('unidad_medida')} className={INPUT}>
                {['tableta','cápsula','ml','ampolla','frasco','sobre','parche','und'].map(u =>
                  <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Stock actual *</label>
              <input type="number" min="0" value={form.stock_actual} onChange={set('stock_actual')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Stock mínimo</label>
              <input type="number" min="0" value={form.stock_minimo} onChange={set('stock_minimo')} className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Precio unitario (COP)</label>
              <input type="number" min="0" value={form.precio_unitario} onChange={set('precio_unitario')} className={INPUT} />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.requiere_formula} onChange={setCheck('requiere_formula')} className="rounded" />
              Requiere fórmula médica
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.medicamento_alto_riesgo} onChange={setCheck('medicamento_alto_riesgo')} className="rounded" />
              Medicamento de alto riesgo
            </label>
          </div>
        </div>
        <div className="p-5 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-halu-600 text-white text-sm font-semibold hover:bg-halu-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}

function NuevoDispensacionModal({ medicamentos, onClose, onSaved }: {
  medicamentos: Medicamento[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    paciente: '', ingreso: '', medicamento: '', cantidad: '',
    dosis: '', frecuencia: '', via_administracion: '', duracion_dias: '',
  })
  const [saving, setSaving] = useState(false)
  const [showBuscador, setShowBuscador] = useState(false)
  const [pacienteNombre, setPacienteNombre] = useState('')
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.paciente || !form.medicamento || !form.cantidad) {
      toast.error('Paciente, medicamento y cantidad son requeridos'); return
    }
    setSaving(true)
    try {
      await api.post('/api/farmacia/dispensaciones/', {
        ...form,
        cantidad: Number(form.cantidad),
        duracion_dias: form.duracion_dias ? Number(form.duracion_dias) : null,
      })
      toast.success('Dispensación registrada')
      onSaved()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Nueva dispensación</h2>
            <p className="text-xs text-slate-500">Registrar entrega de medicamento a paciente</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
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
            <label className="text-xs font-medium text-slate-600 block mb-1">Medicamento *</label>
            <select value={form.medicamento} onChange={set('medicamento')} className={INPUT}>
              <option value="">Seleccionar medicamento...</option>
              {medicamentos.map(m => (
                <option key={m.id} value={m.id}>{m.nombre_generico} {m.concentracion} ({m.stock_actual} disponibles)</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Cantidad *</label>
              <input type="number" min="1" value={form.cantidad} onChange={set('cantidad')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Duración (días)</label>
              <input type="number" min="1" value={form.duracion_dias} onChange={set('duracion_dias')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Dosis</label>
              <input value={form.dosis} onChange={set('dosis')} className={INPUT} placeholder="Ej. 500mg" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Frecuencia</label>
              <input value={form.frecuencia} onChange={set('frecuencia')} className={INPUT} placeholder="Ej. cada 8 horas" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Vía de administración</label>
            <select value={form.via_administracion} onChange={set('via_administracion')} className={INPUT}>
              <option value="">Seleccionar...</option>
              <option>Oral</option><option>Intravenosa</option><option>Intramuscular</option>
              <option>Subcutánea</option><option>Tópica</option><option>Inhalatoria</option>
              <option>Sublingual</option><option>Rectal</option><option>Oftálmica</option>
            </select>
          </div>
        </div>
        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} loading={saving}>Registrar dispensación</Button>
        </div>
      </div>
      {showBuscador && (
        <BuscadorPacienteIngreso
          onSelect={(p, ing) => {
            setForm(f => ({ ...f, paciente: p.id, ingreso: ing?.id || f.ingreso || '' }))
            setPacienteNombre(p.nombre_completo)
            setShowBuscador(false)
          }}
          onClose={() => setShowBuscador(false)}
        />
      )}
    </div>
  )
}
