'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { cupsAPI } from '@/lib/api'
import { Search, X, Check } from 'lucide-react'
import clsx from 'clsx'

interface CupsItem {
  codigo: string
  descripcion: string
  nombre_servicio: string
  grupo_servicio: string
}

interface Props {
  label?: string
  value: string
  descripcion?: string
  onChange: (codigo: string, descripcion: string, item: CupsItem | null) => void
  error?: string
  placeholder?: string
  required?: boolean
}

export function CupsAutocomplete({ label, value, descripcion, onChange, error, placeholder, required }: Props) {
  const [query, setQuery]       = useState(value || '')
  const [results, setResults]   = useState<CupsItem[]>([])
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(!!value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) { setQuery(value); setSelected(true) }
    else        { setQuery(''); setSelected(false) }
  }, [value])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const buscar = useCallback(async (q: string) => {
    if (!q.trim() || q === value) return
    setLoading(true)
    try {
      const { data } = await cupsAPI.buscar(q)
      setResults(data.results ?? data)
      setOpen(true)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [value])

  useEffect(() => {
    if (selected) return
    const t = setTimeout(() => buscar(query), 300)
    return () => clearTimeout(t)
  }, [query, selected, buscar])

  const select = (item: CupsItem) => {
    setQuery(item.codigo)
    setSelected(true)
    setOpen(false)
    onChange(item.codigo, item.descripcion, item)
  }

  const clear = () => {
    setQuery(''); setSelected(false); setResults([])
    onChange('', '', null)
  }

  return (
    <div className="space-y-1.5" ref={ref}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}{required && ' *'}
        </label>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(false) }}
          onFocus={() => { if (results.length > 0 && !selected) setOpen(true) }}
          placeholder={placeholder ?? 'Código o descripción del procedimiento...'}
          className={clsx(
            'w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm transition-all',
            'focus:outline-none focus:ring-2',
            error
              ? 'border-red-300 focus:ring-red-200 bg-red-50'
              : selected
                ? 'border-emerald-300 focus:ring-emerald-200 bg-emerald-50/40'
                : 'border-slate-200 focus:ring-halu-500/20 focus:border-halu-400 bg-slate-50'
          )}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-halu-400 border-t-transparent rounded-full animate-spin" />
        )}
        {selected && !loading && (
          <button type="button" onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {open && results.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
            {results.map(item => (
              <button
                key={item.codigo}
                type="button"
                onClick={() => select(item)}
                className="w-full text-left px-4 py-2.5 hover:bg-halu-50 flex items-start gap-3 border-b border-slate-50 last:border-0 transition-colors"
              >
                <span className="font-mono font-semibold text-halu-700 text-xs mt-0.5 flex-shrink-0 w-16">{item.codigo}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 leading-tight">{item.descripcion}</p>
                  {item.nombre_servicio && (
                    <p className="text-xs text-slate-400 mt-0.5">{item.nombre_servicio}</p>
                  )}
                </div>
                {item.codigo === value && <Check className="w-3.5 h-3.5 text-emerald-500 ml-auto flex-shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && descripcion && (
        <p className="text-xs text-slate-500 pl-1 truncate">{descripcion}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
