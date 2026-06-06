'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { programacionCxAPI, mensajeError } from '@/lib/api'
import { ProgramacionCx, EstadoProgramacionCx } from '@/types'
import { PageHeader, Spinner, EmptyState } from '@/components/ui'
import { Scissors, FileText, Search } from 'lucide-react'
import clsx from 'clsx'

const ESTADO_BADGE: Record<EstadoProgramacionCx, { label: string; color: string }> = {
  programada: { label: 'Programada', color: 'bg-blue-100 text-blue-700' },
  confirmada: { label: 'Confirmada', color: 'bg-teal-100 text-teal-700' },
  en_curso:   { label: 'En curso',   color: 'bg-amber-100 text-amber-700' },
  realizada:  { label: 'Realizada',  color: 'bg-emerald-100 text-emerald-700' },
  suspendida: { label: 'Suspendida', color: 'bg-orange-100 text-orange-700' },
  cancelada:  { label: 'Cancelada',  color: 'bg-slate-100 text-slate-500' },
}

export default function ProgramacionCxPage() {
  const [lista, setLista]     = useState<ProgramacionCx[]>([])
  const [loading, setLoading] = useState(true)
  const [estado, setEstado]   = useState<EstadoProgramacionCx | ''>('')
  const [fecha, setFecha]     = useState('')
  const [busq, setBusq]       = useState('')

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (estado) params.estado = estado
    if (fecha)  params.fecha  = fecha
    programacionCxAPI.list(params)
      .then(({ data }) => setLista(Array.isArray(data) ? data : data.results ?? []))
      .catch(e => console.error(mensajeError(e)))
      .finally(() => setLoading(false))
  }, [estado, fecha])

  const filtrados = busq
    ? lista.filter(cx =>
        cx.paciente_nombre?.toLowerCase().includes(busq.toLowerCase()) ||
        cx.descripcion_cups?.toLowerCase().includes(busq.toLowerCase()) ||
        String(cx.numero_cx).includes(busq)
      )
    : lista

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Programación quirúrgica"
        description="Agenda de cirugías programadas"
      />

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={busq} onChange={e => setBusq(e.target.value)}
              placeholder="Buscar por paciente, procedimiento..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
          </div>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([
            ['', 'Todas'],
            ['programada', 'Programadas'],
            ['confirmada', 'Confirmadas'],
            ['en_curso',   'En curso'],
            ['realizada',  'Realizadas'],
            ['suspendida', 'Suspendidas'],
          ] as [string, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setEstado(v as EstadoProgramacionCx | '')}
              className={clsx('px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                estado === v
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-16"><Spinner size="lg" /></div>}

      {!loading && filtrados.length === 0 && (
        <EmptyState icon={<Scissors className="w-8 h-8" />}
          title="Sin cirugías programadas"
          description="No hay cirugías en el período seleccionado" />
      )}

      <div className="space-y-3">
        {filtrados.map(cx => {
          const badge = ESTADO_BADGE[cx.estado] ?? ESTADO_BADGE.programada
          return (
            <div key={cx.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', badge.color)}>
                      {badge.label}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      CX-{String(cx.numero_cx).padStart(5, '0')}
                    </span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                      cx.tipo_cirugia === 'emergencia' ? 'bg-red-100 text-red-700' :
                      cx.tipo_cirugia === 'urgente'    ? 'bg-orange-100 text-orange-700' :
                                                          'bg-slate-100 text-slate-600')}>
                      {cx.tipo_cirugia}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900 truncate">
                    {cx.descripcion_cups || cx.cups_principal}
                  </p>
                  <p className="text-sm text-slate-600">{cx.paciente_nombre}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                    <span>📅 {new Date(cx.fecha_programada).toLocaleString('es-CO')}</span>
                    {cx.quirofano && <span>🏥 {cx.quirofano}</span>}
                    {cx.cirujano_info && <span>👨‍⚕️ {cx.cirujano_info.nombre_completo}</span>}
                    {cx.numero_autorizacion && <span>Auth: {cx.numero_autorizacion}</span>}
                  </div>
                </div>
                <Link href={`/salud/cx/${cx.id}/descripcion`}>
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
                    <FileText className="w-3.5 h-3.5" />
                    Informe operatorio
                  </button>
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
