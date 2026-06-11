'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { prefacturaAPI, mensajeError } from '@/lib/api'
import type { Prefactura, EstadoPrefactura } from '@/types'
import toast from 'react-hot-toast'
import { FileText, Search, Plus, Loader2, ChevronRight, Trash2 } from 'lucide-react'
import clsx from 'clsx'

const ESTADO_COLORS: Record<EstadoPrefactura, string> = {
  borrador:    'bg-slate-100 text-slate-600',
  en_revision: 'bg-amber-100 text-amber-700',
  aprobada:    'bg-green-100 text-green-700',
  facturada:   'bg-blue-100 text-blue-700',
  anulada:     'bg-red-100 text-red-500',
}
const ESTADO_LABELS: Record<EstadoPrefactura, string> = {
  borrador: 'Borrador', en_revision: 'En revisión', aprobada: 'Aprobada',
  facturada: 'Facturada', anulada: 'Anulada',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

export default function PrefacturasPage() {
  const [prefacturas, setPrefacturas] = useState<Prefactura[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoPrefactura | ''>('')
  const [aEliminar, setAEliminar] = useState<Prefactura | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filtroEstado) params.estado = filtroEstado
      const res = await prefacturaAPI.list(params)
      setPrefacturas(res.data.results ?? res.data)
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setLoading(false)
    }
  }, [filtroEstado])

  useEffect(() => { load() }, [load])

  const eliminar = async () => {
    if (!aEliminar) return
    setEliminando(true)
    try {
      await prefacturaAPI.delete(aEliminar.id)
      toast.success(`${aEliminar.numero_formateado} eliminada`)
      setAEliminar(null)
      load()
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setEliminando(false)
    }
  }

  const puedeEliminar = (p: Prefactura) => p.estado !== 'facturada'

  const filtradas = prefacturas.filter(p =>
    !busqueda ||
    p.paciente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.numero_formateado.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-2xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Prefacturas</h1>
          <p className="text-sm text-slate-500">Preliquidación interna antes de generar FEV</p>
        </div>
        <Link
          href="/facturacion/prefacturas/nueva"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700"
        >
          <Plus className="w-4 h-4" />
          Nueva prefactura
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input-base w-full pl-9"
              placeholder="Buscar por paciente o número..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
          <select className="input-base" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as EstadoPrefactura | '')}>
            <option value="">Todos los estados</option>
            {(Object.entries(ESTADO_LABELS) as [EstadoPrefactura, string][]).map(([k, v]) =>
              <option key={k} value={k}>{v}</option>
            )}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(ESTADO_LABELS) as EstadoPrefactura[]).map(estado => (
          <button
            key={estado}
            onClick={() => setFiltroEstado(filtroEstado === estado ? '' : estado)}
            className={clsx('bg-white rounded-xl border p-3 text-center transition-all',
              filtroEstado === estado ? 'border-violet-300 ring-1 ring-violet-200' : 'border-slate-100 hover:border-slate-200'
            )}
          >
            <p className="text-2xl font-bold text-slate-800">{prefacturas.filter(p => p.estado === estado).length}</p>
            <p className={clsx('text-xs font-medium mt-0.5 px-1.5 py-0.5 rounded-full inline-block', ESTADO_COLORS[estado])}>{ESTADO_LABELS[estado]}</p>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay prefacturas</p>
          </div>
        ) : (
          <>
            {/* Tabla — escritorio */}
            <table className="w-full text-sm hidden md:table">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Paciente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Convenio</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total EPS</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Pac.</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Creada</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtradas.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.numero_formateado}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.paciente_nombre}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.convenio_info?.nombre || '—'}</td>
                    <td className="px-4 py-3 text-right text-blue-700 font-medium">{fmt(p.subtotal_eps)}</td>
                    <td className="px-4 py-3 text-right text-amber-700 font-medium">{fmt(p.subtotal_paciente)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', ESTADO_COLORS[p.estado])}>
                        {ESTADO_LABELS[p.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(p.creado_en).toLocaleDateString('es-CO')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {puedeEliminar(p) && (
                          <button
                            onClick={() => setAEliminar(p)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg inline-flex"
                            title="Eliminar prefactura"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          href={`/facturacion/prefactura/${p.id}`}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg inline-flex"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tarjetas — móvil */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtradas.map(p => (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/facturacion/prefactura/${p.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-500">{p.numero_formateado}</span>
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_COLORS[p.estado])}>
                          {ESTADO_LABELS[p.estado]}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mt-1 truncate">{p.paciente_nombre}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {p.convenio_info?.nombre || 'Sin convenio'} · {new Date(p.creado_en).toLocaleDateString('es-CO')}
                      </p>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="text-blue-700 font-medium">EPS: {fmt(p.subtotal_eps)}</span>
                        <span className="text-amber-700 font-medium">Pac: {fmt(p.subtotal_paciente)}</span>
                      </div>
                    </Link>
                    <div className="flex flex-col gap-1 shrink-0">
                      {puedeEliminar(p) && (
                        <button
                          onClick={() => setAEliminar(p)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Eliminar prefactura"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <Link
                        href={`/facturacion/prefactura/${p.id}`}
                        className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal confirmar eliminación */}
      {aEliminar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Eliminar {aEliminar.numero_formateado}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Se eliminará la prefactura de <strong>{aEliminar.paciente_nombre}</strong> con todos sus ítems. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={eliminar}
                disabled={eliminando}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {eliminando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
              <button
                onClick={() => setAEliminar(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
