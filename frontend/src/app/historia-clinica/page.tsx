'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ingresosAPI, mensajeError } from '@/lib/api'
import { Ingreso } from '@/types'
import { PageHeader, Button, Spinner, EmptyState } from '@/components/ui'
import { UserCheck, UserMinus, PlusCircle, Search, RefreshCw, ClipboardList } from 'lucide-react'
import clsx from 'clsx'

const TIPO_ATENCION: Record<string, string> = {
  consulta_externa: 'Consulta ext.',
  urgencias:        'Urgencias',
  hospitalizacion:  'Hospitalización',
  procedimiento:    'Procedimiento',
}

const TIPO_EGRESO_LABEL: Record<string, string> = {
  alta_medica:   'Alta médica',
  traslado:      'Traslado',
  voluntario:    'Retiro voluntario',
  fallecimiento: 'Fallecimiento',
  fuga:          'Fuga',
}

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function HistoriaClinicaPage() {
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filtro, setFiltro]     = useState<'activos' | 'egresados' | 'todos'>('activos')
  const [error, setError]       = useState<string | null>(null)

  const cargar = () => {
    setLoading(true)
    const params: Record<string, unknown> = {}
    if (filtro === 'activos')   params.activo = 'true'
    if (filtro === 'egresados') params.activo = 'false'
    if (search) params.search = search
    ingresosAPI.list(params)
      .then(({ data }) => setIngresos(Array.isArray(data) ? data : data.results ?? []))
      .catch(err => setError(mensajeError(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [filtro])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); cargar() }

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Historia Clínica"
        description="Ingresos, egresos e historial clínico de pacientes"
        action={
          <Link href="/historia-clinica/ingresos/nuevo">
            <Button><PlusCircle className="w-4 h-4" />Nuevo Ingreso</Button>
          </Link>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {(['activos', 'egresados', 'todos'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              filtro === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {f === 'activos' && <UserCheck className="w-3.5 h-3.5" />}
            {f === 'egresados' && <UserMinus className="w-3.5 h-3.5" />}
            {f === 'activos' ? 'Activos' : f === 'egresados' ? 'Egresados' : 'Todos'}
          </button>
        ))}

        <form onSubmit={handleSearch} className="ml-auto flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar paciente..."
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" className="px-3"><Search className="w-4 h-4" /></Button>
          <button onClick={cargar} type="button" className="p-1.5 text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </form>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{ingresos.filter(i => i.activo).length}</p>
          <p className="text-xs text-green-600">Pacientes activos</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-700">{ingresos.filter(i => !i.activo).length}</p>
          <p className="text-xs text-slate-500">Egresados</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{ingresos.length}</p>
          <p className="text-xs text-blue-600">Total mostrados</p>
        </div>
      </div>

      {loading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!loading && ingresos.length === 0 && (
        <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Sin ingresos" description="Registra el primer ingreso de un paciente" />
      )}

      <div className="space-y-2">
        {ingresos.map(ing => (
          <Link key={ing.id} href={`/historia-clinica/ingresos/${ing.id}`}>
            <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-wrap gap-3 items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 shrink-0">
                <span className="text-xs font-bold text-slate-600">#{ing.numero_ingreso}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{ing.paciente_nombre}</p>
                <p className="text-xs text-slate-500">{fmtFecha(ing.fecha_ingreso)} · {TIPO_ATENCION[ing.tipo_atencion] || ing.tipo_atencion}</p>
                <p className="text-xs text-slate-400 truncate">{ing.motivo_ingreso}</p>
              </div>
              <div className="text-right shrink-0">
                {ing.activo ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                    <UserCheck className="w-3 h-3" />Activo
                  </span>
                ) : (
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                      <UserMinus className="w-3 h-3" />Egresado
                    </span>
                    {ing.egreso_info && (
                      <p className="text-xs text-slate-400 mt-0.5">{TIPO_EGRESO_LABEL[ing.egreso_info.tipo_egreso]}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
