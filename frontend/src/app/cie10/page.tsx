'use client'
import { useEffect, useState, useCallback } from 'react'
import { cie10API, mensajeError } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/ui'
import toast from 'react-hot-toast'
import { Search, Copy, CheckCircle, BookOpen, User, Baby } from 'lucide-react'
import clsx from 'clsx'

interface CodigoCIE10 {
  codigo: string
  nombre: string
  descripcion: string
  capitulo_codigo: string
  capitulo_desc: string
  sexo: string
  edad_minima: number
  edad_maxima: number
  habilitado: boolean
}

const SEXO_LABEL: Record<string, string> = { A: 'Ambos', M: 'Masculino', F: 'Femenino' }
const SEXO_COLOR: Record<string, string> = {
  A: 'bg-slate-100 text-slate-600',
  M: 'bg-blue-50 text-blue-700',
  F: 'bg-pink-50 text-pink-700',
}

export default function Cie10Page() {
  const [items, setItems]     = useState<CodigoCIE10[]>([])
  const [count, setCount]     = useState(0)
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState<string | null>(null)

  const cargar = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const { data } = q.trim()
        ? await cie10API.buscar(q.trim())
        : await cie10API.list({ page_size: 50 })
      const results = data.results ?? data
      setItems(results)
      setCount(data.count ?? results.length)
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar('') }, [cargar])

  useEffect(() => {
    const t = setTimeout(() => cargar(query), 350)
    return () => clearTimeout(t)
  }, [query, cargar])

  const copiar = (codigo: string) => {
    navigator.clipboard.writeText(codigo)
    setCopiado(codigo)
    toast.success(`CIE-10 ${codigo} copiado`)
    setTimeout(() => setCopiado(null), 1500)
  }

  const edadLabel = (min: number, max: number) => {
    if (min === 0 && max >= 999) return null
    if (max >= 999) return `≥ ${min} a`
    if (min === 0) return `≤ ${max} a`
    return `${min}–${max} a`
  }

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Diagnósticos CIE-10"
        description="Clasificación Internacional de Enfermedades, 10.ª revisión — 12.634 diagnósticos habilitados"
      />

      {/* Buscador */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código o diagnóstico (ej: J189, diabetes, hipertensión)…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm
              focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400
              bg-slate-50 placeholder:text-slate-400 transition-all"
          />
        </div>
        {!query && (
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            {count.toLocaleString('es-CO')} diagnósticos en el sistema · escribe para buscar
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
            description="No se encontraron diagnósticos CIE-10 para esa búsqueda."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Diagnóstico</th>
                <th className="px-5 py-3 font-medium">Capítulo</th>
                <th className="px-5 py-3 font-medium">Sexo</th>
                <th className="px-5 py-3 font-medium">Edad</th>
                <th className="px-5 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const edad = edadLabel(c.edad_minima, c.edad_maxima)
                return (
                  <tr key={c.codigo} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <span className="font-mono font-semibold text-halu-700">{c.codigo}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-700 max-w-xs">
                      <p className="leading-tight">{c.nombre}</p>
                      {c.descripcion && c.descripcion !== c.nombre && (
                        <p className="text-xs text-slate-400 mt-0.5">{c.descripcion}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs max-w-[180px]">
                      <span className="font-mono text-slate-400 mr-1">{c.capitulo_codigo}</span>
                      <span className="line-clamp-2">{c.capitulo_desc}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={clsx('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
                        SEXO_COLOR[c.sexo] || SEXO_COLOR.A)}>
                        <User className="w-3 h-3" />
                        {SEXO_LABEL[c.sexo] ?? c.sexo}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {edad
                        ? <span className="inline-flex items-center gap-1"><Baby className="w-3 h-3" />{edad}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
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
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
