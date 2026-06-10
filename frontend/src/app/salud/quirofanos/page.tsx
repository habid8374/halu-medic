'use client'
import { useState, useEffect } from 'react'
import { quirofanosAPI, mensajeError } from '@/lib/api'
import { Button } from '@/components/ui'
import { Plus, Pencil, Trash2, Scissors, X, Wrench, Sparkles, Activity } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface Quirofano {
  id: string
  nombre: string
  tipo: string
  tipo_label: string
  estado: string
  estado_label: string
  ubicacion: string
  numero: number | null
  capacidad_personal: number
  tiene_rx: boolean
  tiene_laparos: boolean
  tiene_robot: boolean
  observaciones: string
  activo: boolean
}

const TIPOS = [
  { v: 'general',    l: 'General' },
  { v: 'cardiaco',   l: 'Cardíaco' },
  { v: 'laparos',    l: 'Laparoscopía' },
  { v: 'traumato',   l: 'Traumatología' },
  { v: 'oftalmo',    l: 'Oftalmología' },
  { v: 'endoscopia', l: 'Endoscopía' },
  { v: 'urologia',   l: 'Urología' },
  { v: 'otro',       l: 'Otro' },
]

const ESTADOS = [
  { v: 'disponible',    l: 'Disponible' },
  { v: 'en_uso',        l: 'En uso' },
  { v: 'limpieza',      l: 'En limpieza' },
  { v: 'mantenimiento', l: 'Mantenimiento' },
]

const ESTADO_BADGE: Record<string, string> = {
  disponible:    'bg-emerald-100 text-emerald-700',
  en_uso:        'bg-red-100 text-red-700',
  limpieza:      'bg-amber-100 text-amber-700',
  mantenimiento: 'bg-slate-100 text-slate-600',
}

const CARD_BG: Record<string, string> = {
  disponible:    'border-emerald-200 bg-emerald-50',
  en_uso:        'border-red-200 bg-red-50',
  limpieza:      'border-amber-200 bg-amber-50',
  mantenimiento: 'border-slate-200 bg-slate-50',
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/20 bg-white'

const EMPTY = {
  nombre: '', tipo: 'general', estado: 'disponible', ubicacion: '',
  numero: '', capacidad_personal: '5',
  tiene_rx: false, tiene_laparos: false, tiene_robot: false,
  observaciones: '', activo: true,
}

export default function QuirofanosPage() {
  const [lista, setLista]       = useState<Quirofano[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<Quirofano | null>(null)
  const [form, setForm]         = useState({ ...EMPTY })
  const [saving, setSaving]     = useState(false)

  const cargar = async () => {
    try {
      const { data } = await quirofanosAPI.list()
      setLista(data.results ?? data)
    } catch { toast.error('Error cargando quirófanos') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const abrir = (q?: Quirofano) => {
    if (q) {
      setEditando(q)
      setForm({
        nombre: q.nombre, tipo: q.tipo, estado: q.estado,
        ubicacion: q.ubicacion ?? '',
        numero: q.numero?.toString() ?? '',
        capacidad_personal: String(q.capacidad_personal),
        tiene_rx: q.tiene_rx, tiene_laparos: q.tiene_laparos, tiene_robot: q.tiene_robot,
        observaciones: q.observaciones ?? '', activo: q.activo,
      })
    } else {
      setEditando(null)
      setForm({ ...EMPTY })
    }
    setModal(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        numero: form.numero ? parseInt(String(form.numero)) : null,
        capacidad_personal: parseInt(String(form.capacidad_personal)) || 5,
      }
      if (editando) {
        await quirofanosAPI.update(editando.id, payload)
        toast.success('Quirófano actualizado')
      } else {
        await quirofanosAPI.create(payload)
        toast.success('Quirófano creado')
      }
      setModal(false)
      cargar()
    } catch (e) { toast.error(mensajeError(e)) }
    finally { setSaving(false) }
  }

  const eliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await quirofanosAPI.delete(id)
      toast.success('Quirófano eliminado')
      cargar()
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const cambiarEstado = async (q: Quirofano, estado: string) => {
    try {
      await quirofanosAPI.update(q.id, { estado })
      setLista(prev => prev.map(x =>
        x.id === q.id ? { ...x, estado, estado_label: ESTADOS.find(e => e.v === estado)?.l ?? estado } : x
      ))
    } catch (e) { toast.error(mensajeError(e)) }
  }

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const disponibles    = lista.filter(q => q.estado === 'disponible').length
  const en_uso         = lista.filter(q => q.estado === 'en_uso').length
  const mantenimiento  = lista.filter(q => q.estado === 'mantenimiento' || q.estado === 'limpieza').length

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Scissors className="w-5 h-5 text-halu-600" />Quirófanos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de salas de cirugía y su disponibilidad</p>
        </div>
        <Button onClick={() => abrir()}><Plus className="w-4 h-4" />Nuevo quirófano</Button>
      </div>

      {/* Resumen */}
      {lista.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{disponibles}</p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">Disponibles</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{en_uso}</p>
            <p className="text-xs text-red-600 font-medium mt-0.5">En uso</p>
          </div>
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-600">{mantenimiento}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Limpieza / Mant.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <div className="mt-12 text-center text-slate-400">
          <Scissors className="w-12 h-12 mx-auto mb-3 opacity-25" />
          <p className="font-semibold text-slate-600">No hay quirófanos registrados</p>
          <p className="text-sm mt-1">Crea el primero con el botón &quot;Nuevo quirófano&quot;</p>
          <Button className="mt-4" onClick={() => abrir()}>
            <Plus className="w-4 h-4" /> Crear primer quirófano
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map(q => (
            <div key={q.id} className={clsx('rounded-2xl border p-4 space-y-3 transition-all', CARD_BG[q.estado] ?? 'border-slate-200 bg-white')}>
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{q.nombre}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {q.tipo_label}{q.ubicacion ? ` · ${q.ubicacion}` : ''}
                    {q.numero ? ` · #${q.numero}` : ''}
                  </p>
                </div>
                <span className={clsx('text-xs px-2 py-1 rounded-full font-medium flex-shrink-0', ESTADO_BADGE[q.estado])}>
                  {q.estado_label}
                </span>
              </div>

              {/* Equipamiento */}
              {(q.tiene_laparos || q.tiene_rx || q.tiene_robot) && (
                <div className="flex flex-wrap gap-1">
                  {q.tiene_laparos && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Activity className="w-2.5 h-2.5" />Laparoscopía
                    </span>
                  )}
                  {q.tiene_rx && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />Rx intraop.
                    </span>
                  )}
                  {q.tiene_robot && (
                    <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Wrench className="w-2.5 h-2.5" />Robótico
                    </span>
                  )}
                </div>
              )}

              {/* Cambio rápido de estado */}
              <div className="grid grid-cols-2 gap-1">
                {ESTADOS.map(e => (
                  <button key={e.v} onClick={() => cambiarEstado(q, e.v)}
                    className={clsx(
                      'text-[10px] px-2 py-1.5 rounded-lg border font-medium transition-all text-center',
                      q.estado === e.v
                        ? 'border-halu-400 bg-halu-50 text-halu-700 ring-1 ring-halu-300'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    )}>
                    {e.l}
                  </button>
                ))}
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-1 border-t border-black/5">
                <button onClick={() => abrir(q)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-white/80 font-medium transition-colors">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button onClick={() => eliminar(q.id, q.nombre)}
                  className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">
                {editando ? 'Editar quirófano' : 'Nuevo quirófano'}
              </h2>
              <button onClick={() => setModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Nombre *</label>
                  <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                    placeholder="Ej: Quirófano 1, Sala CX-A" className={INPUT} autoFocus />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Número</label>
                  <input type="number" min="1" value={form.numero}
                    onChange={e => set('numero', e.target.value)}
                    placeholder="1" className={INPUT} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={INPUT}>
                    {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Estado inicial</label>
                  <select value={form.estado} onChange={e => set('estado', e.target.value)} className={INPUT}>
                    {ESTADOS.map(e => <option key={e.v} value={e.v}>{e.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Cap. personal</label>
                  <input type="number" min="1" value={form.capacidad_personal}
                    onChange={e => set('capacidad_personal', e.target.value)} className={INPUT} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Ubicación</label>
                  <input value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)}
                    placeholder="Ej: Piso 2, Bloque B" className={INPUT} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-2">Equipamiento especial</label>
                <div className="space-y-2">
                  {[
                    { k: 'tiene_laparos', l: 'Torre de laparoscopía' },
                    { k: 'tiene_rx',      l: 'Rayos X intraoperatorio' },
                    { k: 'tiene_robot',   l: 'Sistema robótico (Da Vinci u otro)' },
                  ].map(eq => (
                    <label key={eq.k} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox"
                        checked={form[eq.k as keyof typeof form] as boolean}
                        onChange={e => set(eq.k, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-halu-600 cursor-pointer" />
                      <span className="text-sm text-slate-700 group-hover:text-slate-900">{eq.l}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Observaciones</label>
                <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
                  rows={2} placeholder="Equipos adicionales, notas de mantenimiento..."
                  className={INPUT + ' resize-none'} />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.activo}
                  onChange={e => set('activo', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-halu-600" />
                <span className="text-sm text-slate-700">Quirófano activo</span>
              </label>
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-100">
              <Button variant="secondary" className="flex-1" onClick={() => setModal(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={guardar} loading={saving}>
                {editando ? 'Guardar cambios' : 'Crear quirófano'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
