'use client'
import { useState, useEffect, useCallback } from 'react'
import { tarifasAPI, mensajeError } from '@/lib/api'
import { Button, Input, Card } from '@/components/ui'
import toast from 'react-hot-toast'
import Link from 'next/link'
import {
  Receipt, Plus, Pencil, ArrowLeft,
  Search, X, List, Power, Star,
  ChevronRight, Trash2,
} from 'lucide-react'
import clsx from 'clsx'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tarifario {
  id: string
  nombre: string
  tipo: string
  porcentaje_ajuste: string
  es_predeterminado: boolean
  activo: boolean
  vigente_desde: string | null
  vigente_hasta: string | null
  observaciones: string
  creado_en: string
  total_items: number
}

interface ItemTarifario {
  id: string
  cups: string
  descripcion: string
  valor_base: string
  valor_final: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TIPOS = [
  { value: 'SOAT',       label: 'SOAT' },
  { value: 'ISS_2001',   label: 'ISS 2001' },
  { value: 'ISS_2004',   label: 'ISS 2004' },
  { value: 'PARTICULAR', label: 'Particular' },
  { value: 'CONVENIO',   label: 'Convenio EPS' },
  { value: 'MANUAL',     label: 'Manual interno' },
]

const TIPO_COLOR: Record<string, string> = {
  SOAT:       'bg-emerald-50 text-emerald-700',
  ISS_2001:   'bg-blue-50 text-blue-700',
  ISS_2004:   'bg-blue-50 text-blue-700',
  PARTICULAR: 'bg-violet-50 text-violet-700',
  CONVENIO:   'bg-amber-50 text-amber-700',
  MANUAL:     'bg-slate-100 text-slate-600',
}

const EMPTY_FORM = {
  nombre: '',
  tipo: 'MANUAL',
  porcentaje_ajuste: '0',
  es_predeterminado: false,
  activo: true,
  vigente_desde: '',
  vigente_hasta: '',
  observaciones: '',
}

const EMPTY_ITEM = {
  cups: '',
  descripcion: '',
  valor_base: '',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCOP(val: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(val))
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TarifariosPage() {
  const [lista, setLista]         = useState<Tarifario[]>([])
  const [loading, setLoading]     = useState(true)
  const [busqueda, setBusqueda]   = useState('')

  // Modal tarifario
  const [modalOpen, setModalOpen]   = useState(false)
  const [editando, setEditando]     = useState<Tarifario | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)

  // Modal items
  const [itemsModal, setItemsModal]         = useState(false)
  const [tarifarioActivo, setTarifarioActivo] = useState<Tarifario | null>(null)
  const [items, setItems]                   = useState<ItemTarifario[]>([])
  const [itemsBusqueda, setItemsBusqueda]   = useState('')
  const [loadingItems, setLoadingItems]     = useState(false)

  // Form item
  const [itemForm, setItemForm]     = useState({ ...EMPTY_ITEM })
  const [editandoItem, setEditandoItem] = useState<ItemTarifario | null>(null)
  const [savingItem, setSavingItem] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await tarifasAPI.list({ page_size: 200 })
      setLista(res.data.results ?? res.data)
    } catch {
      toast.error('Error cargando tarifarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const cargarItems = useCallback(async (id: string, search?: string) => {
    setLoadingItems(true)
    try {
      const res = await tarifasAPI.listarItems(id, search ? { search } : undefined)
      setItems(res.data.results ?? res.data)
    } catch {
      toast.error('Error cargando ítems')
    } finally {
      setLoadingItems(false)
    }
  }, [])

  // ── Modal tarifario ────────────────────────────────────────────────────────

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  const abrirEditar = (t: Tarifario) => {
    setEditando(t)
    setForm({
      nombre: t.nombre,
      tipo: t.tipo,
      porcentaje_ajuste: t.porcentaje_ajuste,
      es_predeterminado: t.es_predeterminado,
      activo: t.activo,
      vigente_desde: t.vigente_desde ?? '',
      vigente_hasta: t.vigente_hasta ?? '',
      observaciones: t.observaciones,
    })
    setModalOpen(true)
  }

  const cerrarModal = () => { setModalOpen(false); setEditando(null) }

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        porcentaje_ajuste: parseFloat(form.porcentaje_ajuste) || 0,
        vigente_desde: form.vigente_desde || null,
        vigente_hasta: form.vigente_hasta || null,
      }
      if (editando) {
        await tarifasAPI.update(editando.id, payload)
        toast.success('Tarifario actualizado')
      } else {
        await tarifasAPI.create(payload)
        toast.success('Tarifario creado')
      }
      cerrarModal()
      cargar()
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (t: Tarifario) => {
    try {
      await tarifasAPI.update(t.id, { activo: !t.activo })
      toast.success(t.activo ? 'Tarifario desactivado' : 'Tarifario activado')
      cargar()
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  // ── Modal ítems ────────────────────────────────────────────────────────────

  const abrirItems = (t: Tarifario) => {
    setTarifarioActivo(t)
    setItemsBusqueda('')
    setItems([])
    setAddItemOpen(false)
    setItemForm({ ...EMPTY_ITEM })
    setEditandoItem(null)
    setItemsModal(true)
    cargarItems(t.id)
  }

  const cerrarItems = () => {
    setItemsModal(false)
    setTarifarioActivo(null)
    cargar() // refresh item count
  }

  const buscarItems = (q: string) => {
    setItemsBusqueda(q)
    if (tarifarioActivo) cargarItems(tarifarioActivo.id, q)
  }

  const abrirEditarItem = (item: ItemTarifario) => {
    setEditandoItem(item)
    setItemForm({ cups: item.cups, descripcion: item.descripcion, valor_base: item.valor_base })
    setAddItemOpen(true)
  }

  const cerrarItemForm = () => {
    setAddItemOpen(false)
    setEditandoItem(null)
    setItemForm({ ...EMPTY_ITEM })
  }

  const guardarItem = async () => {
    if (!itemForm.cups.trim() || !itemForm.valor_base) {
      toast.error('CUPS y valor son obligatorios')
      return
    }
    if (!tarifarioActivo) return
    setSavingItem(true)
    try {
      const payload = {
        cups: itemForm.cups.trim().toUpperCase(),
        descripcion: itemForm.descripcion,
        valor_base: parseFloat(itemForm.valor_base),
      }
      if (editandoItem) {
        await tarifasAPI.editarItem(tarifarioActivo.id, editandoItem.id, payload)
        toast.success('Ítem actualizado')
      } else {
        await tarifasAPI.agregarItem(tarifarioActivo.id, payload)
        toast.success('Ítem agregado')
      }
      cerrarItemForm()
      cargarItems(tarifarioActivo.id, itemsBusqueda)
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setSavingItem(false)
    }
  }

  const eliminarItem = async (itemId: string) => {
    if (!tarifarioActivo) return
    if (!confirm('¿Eliminar este ítem del tarifario?')) return
    try {
      await tarifasAPI.eliminarItem(tarifarioActivo.id, itemId)
      toast.success('Ítem eliminado')
      cargarItems(tarifarioActivo.id, itemsBusqueda)
    } catch (err) {
      toast.error(mensajeError(err))
    }
  }

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtrados = lista.filter(t =>
    t.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    t.tipo.toLowerCase().includes(busqueda.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="px-4 pt-16 pb-2 lg:px-8 lg:pt-8">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <Link href="/configuracion" className="hover:text-halu-600 transition-colors">Configuración</Link>
          <span>/</span>
          <span className="text-slate-700 font-medium">Tarifarios</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/configuracion" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 flex-1">Tarifarios</h1>
          <Button onClick={abrirNuevo} className="text-sm px-3 py-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo tarifario</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-1 ml-11">SOAT, ISS, Particular y convenios · Configura ítems CUPS con sus valores</p>
      </div>

      <div className="px-4 lg:px-8 pb-8">
        {/* Buscador */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o tipo…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <Card className="text-center py-12 text-slate-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {busqueda ? 'Sin resultados para tu búsqueda' : 'Aún no hay tarifarios registrados'}
            </p>
            {!busqueda && (
              <button onClick={abrirNuevo} className="mt-4 text-sm text-halu-600 hover:underline">
                Crear el primer tarifario
              </button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filtrados.map(t => (
              <div
                key={t.id}
                className={clsx(
                  'bg-white border rounded-2xl p-4 flex items-center gap-4 transition-all',
                  t.activo ? 'border-slate-100 hover:shadow-sm' : 'border-slate-100 opacity-60'
                )}
              >
                <div className="w-10 h-10 bg-halu-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-5 h-5 text-halu-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">{t.nombre}</p>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', TIPO_COLOR[t.tipo] ?? 'bg-slate-100 text-slate-600')}>
                      {TIPOS.find(x => x.value === t.tipo)?.label ?? t.tipo}
                    </span>
                    {t.es_predeterminado && (
                      <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" />Predeterminado
                      </span>
                    )}
                    {!t.activo && (
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ajuste: {Number(t.porcentaje_ajuste) >= 0 ? '+' : ''}{t.porcentaje_ajuste}% ·{' '}
                    <span className="text-halu-600 font-medium">{t.total_items} ítems</span>
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => abrirItems(t)}
                    className="p-2 text-slate-400 hover:text-halu-600 hover:bg-halu-50 rounded-lg transition-colors"
                    title="Ver ítems"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => abrirEditar(t)}
                    className="p-2 text-slate-400 hover:text-halu-600 hover:bg-halu-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActivo(t)}
                    className={clsx(
                      'p-2 rounded-lg transition-colors',
                      t.activo
                        ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                        : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                    )}
                    title={t.activo ? 'Desactivar' : 'Activar'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: Nuevo / Editar tarifario ────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">
                {editando ? 'Editar tarifario' : 'Nuevo tarifario'}
              </h2>
              <button onClick={cerrarModal} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <Input
                label="Nombre *"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: ISS 2001 + 30%, SOAT 2026, Particular"
              />

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo *</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                      className={clsx(
                        'py-2 px-3 rounded-xl text-sm font-medium border transition-all',
                        form.tipo === t.value
                          ? 'border-halu-500 bg-halu-50 text-halu-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Porcentaje ajuste */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Porcentaje de ajuste
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={form.porcentaje_ajuste}
                    onChange={e => setForm(f => ({ ...f, porcentaje_ajuste: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  30 = ISS+30% · 0 = sin ajuste · -10 = descuento 10%
                </p>
              </div>

              {/* Vigencia */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Vigente desde</label>
                  <input
                    type="date"
                    value={form.vigente_desde}
                    onChange={e => setForm(f => ({ ...f, vigente_desde: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Vigente hasta</label>
                  <input
                    type="date"
                    value={form.vigente_hasta}
                    onChange={e => setForm(f => ({ ...f, vigente_hasta: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Observaciones</label>
                <textarea
                  value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500 resize-none"
                  placeholder="Notas adicionales…"
                />
              </div>

              {/* Predeterminado toggle */}
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-slate-700">Tarifario predeterminado</p>
                  <p className="text-xs text-slate-400">Se usa cuando el paciente no tiene tarifa asignada</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, es_predeterminado: !f.es_predeterminado }))}
                  className={clsx(
                    'relative w-11 h-6 rounded-full transition-colors',
                    form.es_predeterminado ? 'bg-yellow-500' : 'bg-slate-300'
                  )}
                >
                  <span className={clsx(
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                    form.es_predeterminado ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </button>
              </div>

              {/* Activo toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-slate-700">Tarifario activo</p>
                  <p className="text-xs text-slate-400">Los inactivos no aparecen en formularios</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
                  className={clsx(
                    'relative w-11 h-6 rounded-full transition-colors',
                    form.activo ? 'bg-halu-500' : 'bg-slate-300'
                  )}
                >
                  <span className={clsx(
                    'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                    form.activo ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
              <Button variant="ghost" onClick={cerrarModal}>Cancelar</Button>
              <Button onClick={guardar} loading={saving}>
                {editando ? 'Guardar cambios' : 'Crear tarifario'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Ítems del tarifario ──────────────────────────────────────── */}
      {itemsModal && tarifarioActivo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={cerrarItems} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg flex-shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900 truncate">{tarifarioActivo.nombre}</h2>
                  <p className="text-xs text-slate-400">
                    {items.length} ítems · Ajuste {Number(tarifarioActivo.porcentaje_ajuste) >= 0 ? '+' : ''}{tarifarioActivo.porcentaje_ajuste}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditandoItem(null); setItemForm({ ...EMPTY_ITEM }); setAddItemOpen(v => !v) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-halu-600 text-white rounded-lg text-sm font-medium hover:bg-halu-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Agregar</span>
                </button>
                <button onClick={cerrarItems} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Form agregar/editar item */}
            {addItemOpen && (
              <div className="px-6 py-4 bg-halu-50 border-b border-halu-100">
                <p className="text-sm font-semibold text-halu-800 mb-3">
                  {editandoItem ? 'Editar ítem' : 'Nuevo ítem'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Código CUPS *</label>
                    <input
                      value={itemForm.cups}
                      onChange={e => setItemForm(f => ({ ...f, cups: e.target.value }))}
                      placeholder="Ej: 890201"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                    <input
                      value={itemForm.descripcion}
                      onChange={e => setItemForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Nombre del procedimiento"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Valor base (COP) *</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={itemForm.valor_base}
                      onChange={e => setItemForm(f => ({ ...f, valor_base: e.target.value }))}
                      placeholder="Ej: 50000"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={cerrarItemForm} className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 rounded-lg">
                    Cancelar
                  </button>
                  <button
                    onClick={guardarItem}
                    disabled={savingItem}
                    className="px-4 py-1.5 bg-halu-600 text-white rounded-lg text-sm font-medium hover:bg-halu-700 disabled:opacity-60 transition-colors"
                  >
                    {savingItem ? 'Guardando…' : editandoItem ? 'Actualizar' : 'Agregar'}
                  </button>
                </div>
              </div>
            )}

            {/* Buscador items */}
            <div className="px-6 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={itemsBusqueda}
                  onChange={e => buscarItems(e.target.value)}
                  placeholder="Buscar por CUPS o descripción…"
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500"
                />
                {itemsBusqueda && (
                  <button onClick={() => buscarItems('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabla de ítems */}
            <div className="overflow-y-auto flex-1">
              {loadingItems ? (
                <div className="space-y-2 p-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-slate-100 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <List className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {itemsBusqueda ? 'Sin resultados' : 'Este tarifario aún no tiene ítems'}
                  </p>
                  {!itemsBusqueda && (
                    <button
                      onClick={() => { setEditandoItem(null); setItemForm({ ...EMPTY_ITEM }); setAddItemOpen(true) }}
                      className="mt-3 text-sm text-halu-600 hover:underline"
                    >
                      Agregar el primer ítem
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-6 py-2.5 font-medium">CUPS</th>
                      <th className="text-left px-3 py-2.5 font-medium">Descripción</th>
                      <th className="text-right px-3 py-2.5 font-medium">Valor base</th>
                      <th className="text-right px-6 py-2.5 font-medium">Valor final</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs font-semibold text-halu-700">{item.cups}</td>
                        <td className="px-3 py-3 text-slate-700 text-xs max-w-[200px] truncate">{item.descripcion || '—'}</td>
                        <td className="px-3 py-3 text-right text-slate-500 text-xs">{formatCOP(item.valor_base)}</td>
                        <td className="px-6 py-3 text-right font-semibold text-slate-900 text-xs">{formatCOP(item.valor_final)}</td>
                        <td className="pr-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => abrirEditarItem(item)}
                              className="p-1.5 text-slate-300 hover:text-halu-600 hover:bg-halu-50 rounded-md transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => eliminarItem(item.id)}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end px-6 py-4 border-t border-slate-100">
              <Button variant="ghost" onClick={cerrarItems}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
