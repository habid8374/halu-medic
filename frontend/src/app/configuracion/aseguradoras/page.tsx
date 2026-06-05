'use client'
import { useState, useEffect } from 'react'
import { aseguradorasAPI, tarifasAPI, mensajeError } from '@/lib/api'
import { PageHeader, Button, Input, Card } from '@/components/ui'
import toast from 'react-hot-toast'
import Link from 'next/link'
import {
  Building2, Plus, Pencil, ArrowLeft, ShieldCheck,
  Search, X, Percent,
} from 'lucide-react'
import clsx from 'clsx'

interface Tarifario {
  id: string
  nombre: string
  tipo: string
  porcentaje_ajuste: string
}

interface Aseguradora {
  id: string
  nombre: string
  nit: string
  codigo: string
  tipo: string
  activa: boolean
  tarifario: string | null
  tarifario_nombre: string
  tarifario_porcentaje: string | null
}

const TIPOS = [
  { value: 'EPS', label: 'EPS' },
  { value: 'PREPAGADA', label: 'Medicina prepagada' },
  { value: 'ARL', label: 'ARL' },
  { value: 'SOAT', label: 'SOAT' },
  { value: 'OTRO', label: 'Otro' },
]

const TIPO_COLOR: Record<string, string> = {
  EPS:       'bg-blue-50 text-blue-700',
  PREPAGADA: 'bg-purple-50 text-purple-700',
  ARL:       'bg-amber-50 text-amber-700',
  SOAT:      'bg-emerald-50 text-emerald-700',
  OTRO:      'bg-slate-100 text-slate-600',
}

const EMPTY: Omit<Aseguradora, 'id' | 'tarifario_nombre' | 'tarifario_porcentaje'> = {
  nombre: '', nit: '', codigo: '', tipo: 'EPS', activa: true, tarifario: null,
}

export default function AseguradorasPage() {
  const [lista, setLista]       = useState<Aseguradora[]>([])
  const [tarifarios, setTarifarios] = useState<Tarifario[]>([])
  const [loading, setLoading]   = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando]   = useState<Aseguradora | null>(null)
  const [form, setForm]           = useState({ ...EMPTY })
  const [saving, setSaving]       = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const [resA, resT] = await Promise.all([
        aseguradorasAPI.list({ todas: '1' }),
        tarifasAPI.list({ page_size: 100 }),
      ])
      setLista(resA.data.results ?? resA.data)
      setTarifarios(resT.data.results ?? resT.data)
    } catch {
      toast.error('Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const abrirNueva = () => {
    setEditando(null)
    setForm({ ...EMPTY })
    setModalOpen(true)
  }

  const abrirEditar = (a: Aseguradora) => {
    setEditando(a)
    setForm({
      nombre: a.nombre,
      nit: a.nit,
      codigo: a.codigo,
      tipo: a.tipo,
      activa: a.activa,
      tarifario: a.tarifario,
    })
    setModalOpen(true)
  }

  const cerrar = () => { setModalOpen(false); setEditando(null) }

  const guardar = async () => {
    if (!form.nombre || !form.nit || !form.codigo) {
      toast.error('Nombre, NIT y código son obligatorios')
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, tarifario: form.tarifario || null }
      if (editando) {
        await aseguradorasAPI.update(editando.id, payload)
        toast.success('Aseguradora actualizada')
      } else {
        await aseguradorasAPI.create(payload)
        toast.success('Aseguradora creada')
      }
      cerrar()
      cargar()
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setSaving(false)
    }
  }

  const filtradas = lista.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.nit.includes(busqueda)
  )

  const tarifarioSeleccionado = tarifarios.find(t => t.id === form.tarifario)

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="px-4 pt-16 pb-4 lg:px-8 lg:pt-8">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/configuracion" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Aseguradoras</h1>
          <div className="flex-1" />
          <Button onClick={abrirNueva} className="text-sm px-3 py-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva</span>
          </Button>
        </div>
        <p className="text-xs text-slate-500 ml-11">EPS, prepagadas, ARL y SOAT · Asigna tarifario por aseguradora</p>
      </div>

      <div className="px-4 lg:px-8 pb-8">
      {/* Buscador */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o NIT…"
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
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <Card className="text-center py-12 text-slate-400">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {busqueda ? 'Sin resultados para tu búsqueda' : 'Aún no hay aseguradoras registradas'}
          </p>
          {!busqueda && (
            <button onClick={abrirNueva} className="mt-4 text-sm text-halu-600 hover:underline">
              Crear la primera aseguradora
            </button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtradas.map(a => (
            <div key={a.id}
              className={clsx(
                'bg-white border rounded-2xl p-4 flex items-center gap-4 transition-all',
                a.activa ? 'border-slate-100 hover:shadow-sm' : 'border-slate-100 opacity-60'
              )}
            >
              <div className="w-10 h-10 bg-halu-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-halu-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900 text-sm">{a.nombre}</p>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', TIPO_COLOR[a.tipo] ?? 'bg-slate-100 text-slate-600')}>
                    {a.tipo}
                  </span>
                  {!a.activa && (
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Inactiva</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">NIT: {a.nit} · Código: {a.codigo}</p>
                {a.tarifario_nombre ? (
                  <p className="text-xs text-halu-600 mt-0.5 flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    {a.tarifario_nombre}
                    {a.tarifario_porcentaje !== null && ` · ${a.tarifario_porcentaje}%`}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">Sin tarifario asignado</p>
                )}
              </div>
              <button
                onClick={() => abrirEditar(a)}
                className="p-2 text-slate-400 hover:text-halu-600 hover:bg-halu-50 rounded-lg transition-colors"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear / editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
            {/* Handle indicator for mobile bottom sheet */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">
                {editando ? 'Editar aseguradora' : 'Nueva aseguradora'}
              </h2>
              <button onClick={cerrar} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 gap-4">
                <Input label="Nombre *" value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: SURA EPS" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="NIT *" value={form.nit}
                    onChange={e => setForm(f => ({ ...f, nit: e.target.value }))}
                    placeholder="Ej: 800251440" />
                  <Input label="Código RIPS *" value={form.codigo}
                    onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                    placeholder="Ej: EPS010" />
                </div>

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

                {/* Tarifario */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Tarifario de facturación
                  </label>
                  <select
                    value={form.tarifario ?? ''}
                    onChange={e => setForm(f => ({ ...f, tarifario: e.target.value || null }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-halu-500"
                  >
                    <option value="">— Sin tarifario asignado —</option>
                    {tarifarios.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} ({t.tipo}) — {t.porcentaje_ajuste}%
                      </option>
                    ))}
                  </select>
                  {tarifarioSeleccionado && (
                    <p className="text-xs text-halu-600 mt-1.5 flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      Se aplicará un ajuste de <strong>{tarifarioSeleccionado.porcentaje_ajuste}%</strong> en la facturación a esta aseguradora
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    El porcentaje de ajuste del tarifario se usará para calcular los valores en facturas y RIPS.
                  </p>
                </div>

                {/* Activa toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Aseguradora activa</p>
                    <p className="text-xs text-slate-400">Las inactivas no aparecen en formularios</p>
                  </div>
                  <button
                    onClick={() => setForm(f => ({ ...f, activa: !f.activa }))}
                    className={clsx(
                      'relative w-11 h-6 rounded-full transition-colors',
                      form.activa ? 'bg-halu-500' : 'bg-slate-300'
                    )}
                  >
                    <span className={clsx(
                      'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                      form.activa ? 'translate-x-5' : 'translate-x-0'
                    )} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
              <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
              <Button onClick={guardar} loading={saving}>
                {editando ? 'Guardar cambios' : 'Crear aseguradora'}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end px wrapper */}
    </div>
  )
}
