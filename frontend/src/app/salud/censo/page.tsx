'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ingresosAPI, mensajeError } from '@/lib/api'
import { Ingreso } from '@/types'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { BedDouble, Clock, FileText, Microscope, Scissors, Search } from 'lucide-react'
import clsx from 'clsx'

const TIPO_BADGE: Record<string, { label: string; color: string }> = {
  consulta_externa: { label: 'Consulta externa', color: 'bg-blue-100 text-blue-700' },
  urgencias:        { label: 'Urgencias',         color: 'bg-red-100 text-red-700' },
  hospitalizacion:  { label: 'Hospitalización',   color: 'bg-purple-100 text-purple-700' },
  procedimiento:    { label: 'Procedimiento',     color: 'bg-amber-100 text-amber-700' },
}

export default function CensoPage() {
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [loading, setLoading]   = useState(true)
  const [busq, setBusq]         = useState('')
  const [tipo, setTipo]         = useState('')

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = { activo: 'true' }
    if (tipo) params.tipo_atencion = tipo
    ingresosAPI.list(params)
      .then(({ data }) => setIngresos(Array.isArray(data) ? data : data.results ?? []))
      .catch(e => console.error(mensajeError(e)))
      .finally(() => setLoading(false))
  }, [tipo])

  const filtrados = busq
    ? ingresos.filter(i =>
        i.paciente_nombre?.toLowerCase().includes(busq.toLowerCase()) ||
        String(i.numero_ingreso).includes(busq)
      )
    : ingresos

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Censo de pacientes"
        description="Pacientes activos en el servicio"
      />

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={busq}
            onChange={e => setBusq(e.target.value)}
            placeholder="Buscar paciente o número de ingreso..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { value: '', label: 'Todos' },
            { value: 'hospitalizacion', label: 'Hospitalizados' },
            { value: 'urgencias',       label: 'Urgencias' },
            { value: 'consulta_externa', label: 'Consulta' },
          ].map(f => (
            <button key={f.value} onClick={() => setTipo(f.value)}
              className={clsx('px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                tipo === f.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}

      {!loading && filtrados.length === 0 && (
        <EmptyState icon={<BedDouble className="w-8 h-8" />}
          title="Sin pacientes activos"
          description="No hay pacientes registrados en el censo actual"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtrados.map(ingreso => {
          const badge = TIPO_BADGE[ingreso.tipo_atencion] ?? TIPO_BADGE.consulta_externa
          const dias = ingreso.fecha_ingreso
            ? Math.floor((Date.now() - new Date(ingreso.fecha_ingreso).getTime()) / 86400000)
            : 0
          return (
            <Link key={ingreso.id} href={`/salud/ingreso/${ingreso.id}`}>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', badge.color)}>
                      {badge.label}
                    </span>
                    <p className="font-semibold text-slate-900 mt-1.5">{ingreso.paciente_nombre}</p>
                    <p className="text-xs text-slate-500">Ingreso #{ingreso.numero_ingreso}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {dias === 0 ? 'Hoy' : `${dias}d`}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">{ingreso.motivo_ingreso}</p>
                <div className="flex gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {(ingreso as any).notas_count ?? 0} notas
                  </span>
                  <span className="flex items-center gap-1">
                    <Microscope className="w-3 h-3" />
                    {(ingreso as any).ayudas_count ?? 0} ayudas
                  </span>
                  <span className="flex items-center gap-1">
                    <Scissors className="w-3 h-3" />
                    {(ingreso as any).cx_count ?? 0} CX
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
