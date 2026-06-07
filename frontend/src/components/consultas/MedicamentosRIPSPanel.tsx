'use client'
import { useState, useEffect, useRef } from 'react'
import { consultaMedicamentosAPI, farmaciaInventarioAPI, catalogoMedicamentosAPI, mensajeError } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Pill, Search, X, Loader2, AlertCircle } from 'lucide-react'

interface MedItem {
  id: string
  nombre: string
  cum: string
  tipo: string
  concentracion: string
  unidad_medida: string
  forma_farmaceutica: string
  unidades: number
  dias_tratamiento: number
  valor_unitario: string
  valor_dispensacion: string
  valor_total: string
}

interface FarmaciaMed {
  id: string
  nombre_generico: string
  nombre_comercial: string
  cum: string
  concentracion: string
  unidad_medida: string
  forma_farmaceutica: string
  precio_unitario: string
}

interface CatalogoMed {
  cum: string
  principio_activo: string
  concentracion: string
  forma_farmaceutica: string
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 focus:border-halu-400 bg-white'

const EMPTY_FORM = {
  nombre: '',
  cum: '',
  tipo: '1',
  concentracion: '',
  unidad_medida: 'und',
  forma_farmaceutica: '',
  unidades: 1,
  dias_tratamiento: 1,
  valor_unitario: '',
  valor_dispensacion: '0',
}

export default function MedicamentosRIPSPanel({ consultaId }: { consultaId: string }) {
  const [items, setItems]         = useState<MedItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)

  // autocomplete
  const [query, setQuery]         = useState('')
  const [sugerencias, setSugerencias] = useState<(FarmaciaMed | CatalogoMed)[]>([])
  const [buscando, setBuscando]   = useState(false)
  const [showSug, setShowSug]     = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { cargar() }, [consultaId])

  const cargar = async () => {
    try {
      const { data } = await consultaMedicamentosAPI.list(consultaId)
      setItems(data.results ?? data)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  const buscar = (q: string) => {
    setQuery(q)
    setForm(f => ({ ...f, nombre: q }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setSugerencias([]); setShowSug(false); return }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const [{ data: farmData }, { data: catData }] = await Promise.all([
          farmaciaInventarioAPI.search(q),
          catalogoMedicamentosAPI.search(q),
        ])
        const farm: FarmaciaMed[] = (farmData.results ?? farmData).slice(0, 5)
        const cat: CatalogoMed[] = (catData.results ?? catData).slice(0, 5)
        setSugerencias([...farm, ...cat])
        setShowSug(true)
      } catch { /* silencioso */ }
      finally { setBuscando(false) }
    }, 300)
  }

  const seleccionar = (item: FarmaciaMed | CatalogoMed) => {
    if ('nombre_generico' in item) {
      // MedicamentoFarmacia
      setForm(f => ({
        ...f,
        nombre:            item.nombre_generico,
        cum:               item.cum,
        concentracion:     item.concentracion,
        unidad_medida:     item.unidad_medida || 'und',
        forma_farmaceutica: item.forma_farmaceutica,
        valor_unitario:    item.precio_unitario || '',
      }))
      setQuery(item.nombre_generico)
    } else {
      // CatalogoMedicamento
      setForm(f => ({
        ...f,
        nombre:            item.principio_activo,
        cum:               item.cum,
        concentracion:     item.concentracion,
        forma_farmaceutica: item.forma_farmaceutica,
      }))
      setQuery(item.principio_activo)
    }
    setShowSug(false)
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    if (!form.nombre) { toast.error('Ingresa el nombre del medicamento'); return }
    if (!form.valor_unitario) { toast.error('Ingresa el valor unitario'); return }
    setSaving(true)
    try {
      await consultaMedicamentosAPI.create({
        consulta:          consultaId,
        nombre:            form.nombre,
        cum:               form.cum,
        tipo:              form.tipo,
        concentracion:     form.concentracion,
        unidad_medida:     form.unidad_medida,
        forma_farmaceutica: form.forma_farmaceutica,
        unidades:          Number(form.unidades),
        dias_tratamiento:  Number(form.dias_tratamiento),
        valor_unitario:    form.valor_unitario,
        valor_dispensacion: form.valor_dispensacion || '0',
        fecha:             new Date().toISOString(),
      })
      toast.success('Medicamento agregado')
      setForm({ ...EMPTY_FORM })
      setQuery('')
      setShowForm(false)
      cargar()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  const eliminar = async (id: string) => {
    try {
      await consultaMedicamentosAPI.delete(id)
      setItems(prev => prev.filter(x => x.id !== id))
      toast.success('Eliminado')
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const total = items.reduce((s, x) => s + parseFloat(x.valor_total || '0'), 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-slate-800">Medicamentos RIPS</h3>
          {items.length > 0 && (
            <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">{items.length}</span>
          )}
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Agregar
        </button>
      </div>

      {/* Aviso RIPS */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 mb-4 text-xs text-amber-700">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>Estos medicamentos se incluyen en el RIPS (registros AM). El CUM y <strong>valor dispensación</strong> son obligatorios desde Res. 948 julio 2026.</span>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 mb-4 bg-slate-50 space-y-3">
          {/* Buscador autocomplete */}
          <div className="relative">
            <label className="text-xs font-semibold text-slate-600 block mb-1">Buscar medicamento *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={query}
                onChange={e => buscar(e.target.value)}
                placeholder="Nombre o CUM desde inventario/catálogo..."
                className={`${INPUT} pl-9`}
              />
              {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
            </div>
            {showSug && sugerencias.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {sugerencias.map((s, i) => {
                  const esFarmacia = 'nombre_generico' in s
                  return (
                    <button key={i} type="button"
                      onClick={() => seleccionar(s)}
                      className="w-full px-4 py-2.5 text-left hover:bg-halu-50 border-b border-slate-100 last:border-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {esFarmacia ? (s as FarmaciaMed).nombre_generico : (s as CatalogoMed).principio_activo}
                          </p>
                          <p className="text-xs text-slate-500">
                            CUM: {s.cum || '—'} · {esFarmacia ? (s as FarmaciaMed).concentracion : (s as CatalogoMed).concentracion}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${esFarmacia ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {esFarmacia ? 'Inventario' : 'INVIMA'}
                        </span>
                      </div>
                    </button>
                  )
                })}
                <button type="button" onClick={() => setShowSug(false)}
                  className="w-full px-4 py-2 text-xs text-slate-400 hover:bg-slate-50 flex items-center justify-center gap-1">
                  <X className="w-3 h-3" /> Cerrar
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">CUM (INVIMA)</label>
              <input value={form.cum} onChange={set('cum')} placeholder="Ej. 20044321" className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Tipo</label>
              <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                <option value="1">Medicamento</option>
                <option value="2">Dispositivo médico</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Concentración</label>
              <input value={form.concentracion} onChange={set('concentracion')} placeholder="Ej. 500mg" className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Forma farmacéutica</label>
              <select value={form.forma_farmaceutica} onChange={set('forma_farmaceutica')} className={INPUT}>
                <option value="">Seleccionar...</option>
                {['Tableta','Cápsula','Jarabe','Inyectable','Solución','Crema','Gotas','Parche','Supositorio','Polvo','Ampolla'].map(f =>
                  <option key={f}>{f}</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Unidades</label>
              <input type="number" min="1" value={form.unidades} onChange={set('unidades')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Días tratamiento *</label>
              <input type="number" min="1" value={form.dias_tratamiento} onChange={set('dias_tratamiento')} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Valor unitario (COP) *</label>
              <input type="number" min="0" value={form.valor_unitario} onChange={set('valor_unitario')} placeholder="0" className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Valor dispensación (COP) *</label>
              <input type="number" min="0" value={form.valor_dispensacion} onChange={set('valor_dispensacion')} placeholder="0" className={INPUT} />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setQuery('') }}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button onClick={guardar} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-6">Sin medicamentos registrados</p>
      ) : (
        <div className="space-y-2">
          {items.map(m => (
            <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Pill className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{m.nombre}</p>
                <p className="text-xs text-slate-500">
                  CUM: <span className={m.cum ? 'text-green-700 font-medium' : 'text-red-500 font-medium'}>{m.cum || 'Sin CUM'}</span>
                  {m.concentracion && ` · ${m.concentracion}`}
                  {m.forma_farmaceutica && ` · ${m.forma_farmaceutica}`}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {m.unidades} und · {m.dias_tratamiento} días · ${parseFloat(m.valor_unitario).toLocaleString()} c/u
                  {parseFloat(m.valor_dispensacion) > 0 && ` · Disp: $${parseFloat(m.valor_dispensacion).toLocaleString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-slate-700">${parseFloat(m.valor_total).toLocaleString()}</span>
                <button onClick={() => eliminar(m.id)}
                  className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700">Total: ${total.toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  )
}
