'use client'
import { useEffect, useState, useCallback } from 'react'
import { cupsAPI, mensajeError } from '@/lib/api'
import { PageHeader, Badge, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import { Search, Stethoscope, Copy, CheckCircle, ListTree } from 'lucide-react'

interface CodigoCUPS {
  codigo: string
  descripcion: string
  nombre_servicio: string
  grupo_servicio: string
  cobertura: string
  codigo_reps: string
  grupo_rips: string
}

export default function CupsPage() {
  const [items, setItems]     = useState<CodigoCUPS[]>([])
  const [count, setCount]     = useState<number>(0)
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState<string | null>(null)

  const cargar = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const { data } = q.trim()
        ? await cupsAPI.buscar(q.trim())
        : await cupsAPI.list({ page_size: 50 })
      const results = data.results ?? data
      setItems(results)
      setCount(data.count ?? results.length)
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // carga inicial
  useEffect(() => { cargar('') }, [cargar])

  // búsqueda con debounce
  useEffect(() => {
    const t = setTimeout(() => cargar(query), 350)
    return () => clearTimeout(t)
  }, [query, cargar])

  const copiar = (codigo: string) => {
    navigator.clipboard.writeText(codigo)
    setCopiado(codigo)
    toast.success(`CUPS ${codigo} copiado`)
    setTimeout(() => setCopiado(null), 1500)
  }

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Homologador CUPS"
        description="Catálogo nacional de Códigos Únicos de Procedimientos en Salud y su homologación REPS (Res. 2775 / 948 de 2026)"
      />

      {/* Buscador */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código o descripción (ej: 890201, consulta, ecografía)…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm
              focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400
              bg-slate-50 placeholder:text-slate-400 transition-all"
          />
        </div>
        {!query && (
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <ListTree className="w-3.5 h-3.5" />
            {count.toLocaleString('es-CO')} códigos CUPS en el sistema · escribe para buscar
          </p>
        )}
      </div>

      {/* Resultados */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            description="No se encontraron códigos CUPS para esa búsqueda."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3 font-medium">CUPS</th>
                <th className="px-5 py-3 font-medium">Descripción</th>
                <th className="px-5 py-3 font-medium">Grupo</th>
                <th className="px-5 py-3 font-medium">Cobertura</th>
                <th className="px-5 py-3 font-medium">REPS</th>
                <th className="px-5 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.codigo} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <span className="font-mono font-semibold text-halu-700">{c.codigo}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-700 max-w-md">
                    <p>{c.descripcion}</p>
                    {c.nombre_servicio && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Stethoscope className="w-3 h-3" />{c.nombre_servicio}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{c.grupo_servicio || '—'}</td>
                  <td className="px-5 py-3">
                    {c.cobertura
                      ? <Badge variant={c.cobertura.toUpperCase().includes('NO') ? 'warning' : 'success'}>{c.cobertura}</Badge>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs font-mono">{c.codigo_reps || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => copiar(c.codigo)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-halu-600 hover:bg-halu-50 transition-all"
                      title="Copiar código">
                      {copiado === c.codigo
                        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        : <Copy className="w-3.5 h-3.5" />}
                      Copiar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
