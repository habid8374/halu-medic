'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { cie10API } from '@/lib/api'
import { Search, X, Check } from 'lucide-react'
import clsx from 'clsx'

interface Cie10Item {
  codigo: string
  nombre: string
  descripcion: string
  sexo: string
}

interface Props {
  label?: string
  value: string
  onChange: (codigo: string, nombre: string, item: Cie10Item | null) => void
  error?: string
  placeholder?: string
  required?: boolean
}

export function Cie10Autocomplete({ label, value, onChange, error, placeholder, required }: Props) {
  const [query, setQuery]       = useState(value || '')
  const [results, setResults]   = useState<Cie10Item[]>([])
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(!!value)
  const [selNombre, setSelNombre] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) { setQuery(value); setSelected(true) }
    else        { setQuery(''); setSelected(false); setSelNombre('') }
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
      const { data } = await cie10API.buscar(q)
      const items = data.results ?? data
      setResults(Array.isArray(items) ? items : [])
      setOpen(true)
    } catch (err) {
      console.error('Error buscando CIE-10:', err)
      setResults([])
    } finally { setLoading(false) }
  }, [value])

  useEffect(() => {
    if (selected) return
    const t = setTimeout(() => buscar(query), 300)
    return () => clearTimeout(t)
  }, [query, selected, buscar])

  const select = (item: Cie10Item) => {
    setQuery(item.codigo)
    setSelNombre(item.nombre)
    setSelected(true)
    setOpen(false)
    onChange(item.codigo, item.nombre, item)
  }

  const clear = () => {
    setQuery(''); setSelected(false); setResults([]); setSelNombre('')
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
          placeholder={placeholder ?? 'Código CIE-10 o diagnóstico...'}
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
                <span className="font-mono font-semibold text-halu-700 text-xs mt-0.5 flex-shrink-0 w-14">{item.codigo}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 leading-tight">{item.nombre}</p>
                  {item.descripcion && item.descripcion !== item.nombre && (
                    <p className="text-xs text-slate-400 mt-0.5">{item.descripcion}</p>
                  )}
                </div>
                {item.codigo === value && <Check className="w-3.5 h-3.5 text-emerald-500 ml-auto flex-shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && selNombre && (
        <p className="text-xs text-slate-500 pl-1 truncate">{selNombre}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
