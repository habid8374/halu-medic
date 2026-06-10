'use client'
import { useState, useEffect, useRef } from 'react'
import { tarifasAPI } from '@/lib/api'
import { CupsAutocomplete } from '@/components/ui/CupsAutocomplete'
import { Button, Input, Select, Badge, Card } from '@/components/ui'
import { Plus, Trash2, Upload, Search, ChevronDown, ChevronUp, Star, Pencil, Download, Package } from 'lucide-react'
import toast from 'react-hot-toast'

interface Manual {
  id: string
  nombre: string
  tipo: string
  porcentaje_ajuste: number
  es_predeterminado: boolean
  activo: boolean
  vigente_desde: string | null
  vigente_hasta: string | null
  observaciones: string
  total_items: number
}

interface Item {
  id: string
  cups: string
  descripcion: string
  valor_base: number
  valor_final: number
  es_paquete: boolean
  cups_rips: string
}

const TIPOS = [
  { value: 'SOAT',       label: 'SOAT' },
  { value: 'ISS_2001',   label: 'ISS 2001' },
  { value: 'ISS_2004',   label: 'ISS 2004' },
  { value: 'PARTICULAR', label: 'Particular' },
  { value: 'CONVENIO',   label: 'Convenio EPS' },
  { value: 'MANUAL',     label: 'Manual interno' },
]

const MANUAL_EMPTY = { nombre: '', tipo: 'MANUAL', porcentaje_ajuste: '0', es_predeterminado: false, observaciones: '' }

export function TarifariosTab() {
  const [manuales, setManuales] = useState<Manual[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [items, setItems] = useState<Record<string, Item[]>>({})
  const [loadingItems, setLoadingItems] = useState<string | null>(null)
  const [busquedaItem, setBusquedaItem] = useState('')
  const [showNuevo, setShowNuevo] = useState(false)
  const [nuevoForm, setNuevoForm] = useState({ ...MANUAL_EMPTY })
  const [guardando, setGuardando] = useState(false)

  // Form para agregar ítem inline
  const [nuevoCups, setNuevoCups] = useState('')
  const [nuevoCupsDesc, setNuevoCupsDesc] = useState('')
  const [nuevoValor, setNuevoValor] = useState('')
  // Modo paquete
  const [modoPaquete, setModoPaquete] = useState(false)
  const [paqueteCupsBase, setPaqueteCupsBase] = useState('')
  const [paqueteSufijo, setPaqueteSufijo] = useState('-1')
  const [paqueteDesc, setPaqueteDesc] = useState('')
  const [paqueteValor, setPaqueteValor] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const [importando, setImportando] = useState(false)

  const descargarPlantilla = async () => {
    try {
      const { data } = await tarifasAPI.plantilla()
      const url = URL.createObjectURL(new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))
      const a = document.createElement('a')
      a.href = url; a.download = 'plantilla_tarifario.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Error descargando plantilla') }
  }

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await tarifasAPI.list()
      setManuales(data.results ?? data)
    } catch { toast.error('Error cargando tarifarios') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const toggleExpandir = async (id: string) => {
    if (expandido === id) { setExpandido(null); return }
    setExpandido(id)
    if (!items[id]) {
      setLoadingItems(id)
      try {
        const { data } = await tarifasAPI.listarItems(id, { page_size: 15000 })
        setItems(prev => ({ ...prev, [id]: data.results ?? data }))
      } catch { toast.error('Error cargando ítems') }
      finally { setLoadingItems(null) }
    }
  }

  const crearManual = async () => {
    if (!nuevoForm.nombre.trim()) { toast.error('El nombre es requerido'); return }
    setGuardando(true)
    try {
      await tarifasAPI.create({
        nombre: nuevoForm.nombre,
        tipo: nuevoForm.tipo,
        porcentaje_ajuste: parseFloat(nuevoForm.porcentaje_ajuste) || 0,
        es_predeterminado: nuevoForm.es_predeterminado,
        observaciones: nuevoForm.observaciones,
      })
      toast.success('Tarifario creado')
      setShowNuevo(false)
      setNuevoForm({ ...MANUAL_EMPTY })
      await cargar()
    } catch { toast.error('Error creando tarifario') }
    finally { setGuardando(false) }
  }

  const eliminarManual = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el tarifario "${nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await tarifasAPI.delete(id)
      toast.success('Tarifario eliminado')
      await cargar()
    } catch { toast.error('Error eliminando tarifario') }
  }

  const agregarItem = async (manualId: string) => {
    if (!nuevoCups || !nuevoValor) { toast.error('CUPS y valor son requeridos'); return }
    try {
      const { data: item } = await tarifasAPI.agregarItem(manualId, {
        cups: nuevoCups,
        descripcion: nuevoCupsDesc,
        valor_base: parseFloat(nuevoValor),
        es_paquete: false,
      })
      setItems(prev => ({ ...prev, [manualId]: [...(prev[manualId] ?? []), item] }))
      setNuevoCups(''); setNuevoCupsDesc(''); setNuevoValor('')
      setManuales(m => m.map(x => x.id === manualId ? { ...x, total_items: x.total_items + 1 } : x))
      toast.success('Ítem agregado')
    } catch { toast.error('Error agregando ítem') }
  }

  const agregarPaquete = async (manualId: string) => {
    if (!paqueteCupsBase || !paqueteValor) { toast.error('Código base y valor son requeridos'); return }
    const codigoPaquete = `${paqueteCupsBase.trim()}${paqueteSufijo.trim()}`
    try {
      const { data: item } = await tarifasAPI.agregarItem(manualId, {
        cups: codigoPaquete,
        descripcion: paqueteDesc,
        valor_base: parseFloat(paqueteValor),
        es_paquete: true,
        cups_rips: paqueteCupsBase.trim(),
      })
      setItems(prev => ({ ...prev, [manualId]: [...(prev[manualId] ?? []), item] }))
      setPaqueteCupsBase(''); setPaqueteSufijo('-1'); setPaqueteDesc(''); setPaqueteValor('')
      setManuales(m => m.map(x => x.id === manualId ? { ...x, total_items: x.total_items + 1 } : x))
      toast.success(`Paquete ${codigoPaquete} agregado`)
    } catch { toast.error('Error agregando paquete') }
  }

  const eliminarItem = async (manualId: string, itemId: string) => {
    try {
      await tarifasAPI.eliminarItem(manualId, itemId)
      setItems(prev => ({ ...prev, [manualId]: prev[manualId].filter(i => i.id !== itemId) }))
      setManuales(m => m.map(x => x.id === manualId ? { ...x, total_items: x.total_items - 1 } : x))
      toast.success('Ítem eliminado')
    } catch { toast.error('Error eliminando ítem') }
  }

  const importarArchivo = async (manualId: string, file: File) => {
    setImportando(true)
    try {
      const { data } = await tarifasAPI.importar(manualId, file)
      if (data.importados > 0 || data.actualizados > 0) {
        toast.success(`✓ ${data.importados} nuevos · ${data.actualizados} actualizados${data.errores ? ` · ${data.errores} errores` : ''}`)
      } else if (data.errores > 0) {
        const detalle = data.detalle_errores?.join('\n') ?? ''
        toast.error(`Sin registros importados. ${data.errores} errores.\n${detalle}`, { duration: 8000 })
      }
      const { data: nuevosItems } = await tarifasAPI.listarItems(manualId, { page_size: 15000 })
      setItems(prev => ({ ...prev, [manualId]: nuevosItems.results ?? nuevosItems }))
      setManuales(m => m.map(x => x.id === manualId ? { ...x, total_items: data.total_items } : x))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error importando archivo'
      toast.error(msg, { duration: 6000 })
    }
    finally { setImportando(false) }
  }

  if (loading) return (
    <div className="animate-pulse space-y-3">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
    </div>
  )

  const itemsFiltrados = (id: string) => {
    const lista = items[id] ?? []
    if (!busquedaItem) return lista
    const q = busquedaItem.toLowerCase()
    return lista.filter(i => i.cups.toLowerCase().includes(q) || i.descripcion.toLowerCase().includes(q))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Manuales tarifarios</h2>
          <p className="text-xs text-slate-500 mt-0.5">Gestiona los tarifarios del consultorio (SOAT, ISS, Particular, etc.)</p>
        </div>
        <Button onClick={() => setShowNuevo(v => !v)} variant={showNuevo ? 'secondary' : 'primary'}>
          <Plus className="w-4 h-4" />Nuevo tarifario
        </Button>
      </div>

      {/* Form nuevo tarifario */}
      {showNuevo && (
        <Card className="border-halu-200 bg-halu-50/30">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Nuevo tarifario</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre *" value={nuevoForm.nombre}
              onChange={e => setNuevoForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: SOAT 2026, Particular, ISS..." />
            <Select label="Tipo" value={nuevoForm.tipo}
              onChange={e => setNuevoForm(f => ({ ...f, tipo: e.target.value }))}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Input label="% ajuste (0 = sin ajuste)" type="number" value={nuevoForm.porcentaje_ajuste}
              onChange={e => setNuevoForm(f => ({ ...f, porcentaje_ajuste: e.target.value }))}
              placeholder="30 = +30%, -10 = -10%" />
            <div className="flex items-center gap-3 mt-6">
              <input type="checkbox" id="predeterminado" checked={nuevoForm.es_predeterminado}
                onChange={e => setNuevoForm(f => ({ ...f, es_predeterminado: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-halu-600" />
              <label htmlFor="predeterminado" className="text-sm text-slate-700 cursor-pointer">
                Tarifa predeterminada del consultorio
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="secondary" onClick={() => { setShowNuevo(false); setNuevoForm({ ...MANUAL_EMPTY }) }}>
              Cancelar
            </Button>
            <Button onClick={crearManual} loading={guardando}>Crear tarifario</Button>
          </div>
        </Card>
      )}

      {/* Lista de tarifarios */}
      {manuales.length === 0 ? (
        <Card>
          <p className="text-center text-slate-500 text-sm py-8">
            No hay tarifarios configurados. Crea el primero con el botón &quot;Nuevo tarifario&quot;.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {manuales.map(manual => (
            <div key={manual.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              {/* Cabecera del manual */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpandir(manual.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{manual.nombre}</span>
                    {manual.es_predeterminado && (
                      <Badge variant="info" className="flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" />Predeterminada
                      </Badge>
                    )}
                    {!manual.activo && <Badge variant="warning">Inactivo</Badge>}
                    <Badge variant="default">{TIPOS.find(t => t.value === manual.tipo)?.label ?? manual.tipo}</Badge>
                    {manual.porcentaje_ajuste !== 0 && (
                      <Badge variant={manual.porcentaje_ajuste > 0 ? 'success' : 'danger'}>
                        {manual.porcentaje_ajuste > 0 ? '+' : ''}{manual.porcentaje_ajuste}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{manual.total_items} procedimientos</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); eliminarManual(manual.id, manual.nombre) }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {expandido === manual.id
                    ? <ChevronUp className="w-4 h-4 text-slate-400" />
                    : <ChevronDown className="w-4 h-4 text-slate-400" />
                  }
                </div>
              </div>

              {/* Panel expandido */}
              {expandido === manual.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-4">

                  {/* Acciones del manual */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) importarArchivo(manual.id, file)
                        if (fileRef.current) fileRef.current.value = ''
                      }}
                    />
                    <Button
                      variant="secondary"
                      className="text-xs py-1.5 px-3"
                      onClick={descargarPlantilla}
                    >
                      <Download className="w-3.5 h-3.5" />Plantilla CSV
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs py-1.5 px-3"
                      onClick={() => fileRef.current?.click()}
                      loading={importando}
                    >
                      <Upload className="w-3.5 h-3.5" />Subir Excel/CSV
                    </Button>
                    <div className="relative flex-1 min-w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      <input
                        type="search"
                        value={busquedaItem}
                        onChange={e => setBusquedaItem(e.target.value)}
                        placeholder="Buscar por CUPS o descripción..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white
                          focus:outline-none focus:ring-2 focus:ring-halu-500/20 focus:border-halu-400"
                      />
                    </div>
                  </div>

                  {/* Tabla de ítems */}
                  {loadingItems === manual.id ? (
                    <div className="text-center py-6 text-slate-400 text-xs">Cargando ítems...</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600 w-20">CUPS</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Descripción</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600 w-28">Valor base</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600 w-28">Valor final</th>
                            <th className="w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {itemsFiltrados(manual.id).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-6 text-slate-400">
                                {items[manual.id]?.length === 0
                                  ? 'Sin ítems. Agrega uno manualmente o sube un archivo.'
                                  : 'Sin resultados para la búsqueda.'
                                }
                              </td>
                            </tr>
                          ) : (
                            itemsFiltrados(manual.id).map(item => (
                              <tr key={item.id} className="border-t border-slate-100 hover:bg-white transition-colors">
                                <td className="px-3 py-2 font-mono font-semibold text-halu-700">
                                  <div className="flex items-center gap-1.5">
                                    {item.cups}
                                    {item.es_paquete && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">
                                        <Package className="w-2.5 h-2.5" />PKG
                                      </span>
                                    )}
                                  </div>
                                  {item.es_paquete && item.cups_rips && (
                                    <p className="text-[10px] text-slate-400 font-normal">RIPS: {item.cups_rips}</p>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-slate-700 max-w-xs truncate">{item.descripcion}</td>
                                <td className="px-3 py-2 text-right text-slate-600">${Number(item.valor_base).toLocaleString('es-CO')}</td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-900">${Number(item.valor_final).toLocaleString('es-CO')}</td>
                                <td className="px-2 py-2">
                                  <button
                                    type="button"
                                    onClick={() => eliminarItem(manual.id, item.id)}
                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Agregar ítem / paquete */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
                    {/* Toggle modo */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModoPaquete(false)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!modoPaquete ? 'bg-halu-100 text-halu-700' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        <Pencil className="w-3 h-3" />Ítem normal
                      </button>
                      <button
                        onClick={() => setModoPaquete(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${modoPaquete ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}
                      >
                        <Package className="w-3 h-3" />Paquete tarifario
                      </button>
                    </div>

                    {!modoPaquete ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <CupsAutocomplete
                            label="CUPS"
                            value={nuevoCups}
                            descripcion={nuevoCupsDesc}
                            onChange={(cod, desc) => { setNuevoCups(cod); setNuevoCupsDesc(desc) }}
                            placeholder="Código..."
                          />
                          <Input label="Descripción" value={nuevoCupsDesc}
                            onChange={e => setNuevoCupsDesc(e.target.value)}
                            placeholder="Se autocompleta..." />
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Input label="Valor base $" type="number" value={nuevoValor}
                              onChange={e => setNuevoValor(e.target.value)}
                              placeholder="85000" />
                          </div>
                          <Button className="py-2.5 px-4 flex-shrink-0"
                            onClick={() => agregarItem(manual.id)}
                            disabled={!nuevoCups || !nuevoValor}
                          >
                            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Agregar</span>
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-violet-700 bg-violet-50 rounded-lg px-3 py-2">
                          El paquete se factura con código sufijado (ej: <strong>876122-1</strong>) pero el RIPS reporta el CUPS base (<strong>876122</strong>).
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Código CUPS base *</label>
                            <input
                              value={paqueteCupsBase}
                              onChange={e => setPaqueteCupsBase(e.target.value)}
                              placeholder="Ej: 876122"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-halu-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Sufijo del paquete</label>
                            <input
                              value={paqueteSufijo}
                              onChange={e => setPaqueteSufijo(e.target.value)}
                              placeholder="-1"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-halu-500"
                            />
                          </div>
                        </div>
                        {paqueteCupsBase && (
                          <p className="text-xs text-slate-500">
                            Código final: <span className="font-mono font-semibold text-violet-700">{paqueteCupsBase}{paqueteSufijo}</span>
                            {' '}· RIPS usará: <span className="font-mono font-semibold text-halu-700">{paqueteCupsBase}</span>
                          </p>
                        )}
                        <Input label="Descripción del paquete *" value={paqueteDesc}
                          onChange={e => setPaqueteDesc(e.target.value)}
                          placeholder="Ej: Paquete cateterismo + hospitalización 3 días" />
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Input label="Valor del paquete $" type="number" value={paqueteValor}
                              onChange={e => setPaqueteValor(e.target.value)} placeholder="1500000" />
                          </div>
                          <Button className="py-2.5 px-4 flex-shrink-0 bg-violet-600 hover:bg-violet-700"
                            onClick={() => agregarPaquete(manual.id)}
                            disabled={!paqueteCupsBase || !paqueteValor}
                          >
                            <Package className="w-4 h-4" /><span className="hidden sm:inline">Agregar</span>
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
