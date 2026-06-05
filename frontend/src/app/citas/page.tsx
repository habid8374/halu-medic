'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useCitas } from '@/hooks/useCitas'
import { CalendarioSemanal } from '@/components/citas/CalendarioSemanal'
import { ESTADO_CITA } from '@/components/citas/helpers'
import { PageHeader, Button, Badge, Spinner } from '@/components/ui'
import { CalendarPlus, List, CalendarDays } from 'lucide-react'
import clsx from 'clsx'

type Vista = 'semana' | 'lista'

export default function CitasPage() {
  const { usuario }       = useAuth()
  const [vista, setVista] = useState<Vista>('semana')
  const [fechaFiltro, setFechaFiltro] = useState<string | undefined>()
  const { data, loading } = useCitas(fechaFiltro)
  const citas = data?.results ?? []

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Agenda de citas"
        description={`${data?.count ?? 0} citas registradas`}
        action={
          usuario?.permisos.puede_gestionar_citas ? (
            <Link href="/citas/nueva">
              <Button><CalendarPlus className="w-4 h-4" />Nueva cita</Button>
            </Link>
          ) : undefined
        }
      />
      <div className="flex items-center gap-2 mb-5">
        {(['semana', 'lista'] as Vista[]).map(v => (
          <button key={v} onClick={() => setVista(v)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              vista === v ? 'bg-halu-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
            {v === 'semana' ? <CalendarDays className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            {v === 'semana' ? 'Semana' : 'Lista'}
          </button>
        ))}
        {fechaFiltro && (
          <button onClick={() => setFechaFiltro(undefined)} className="text-xs text-slate-500 hover:text-red-500 ml-2">
            ✕ Quitar filtro
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : vista === 'semana' ? (
        <CalendarioSemanal citas={citas} onDiaClick={f => setFechaFiltro(p => p === f ? undefined : f)} />
      ) : (
        <div className="space-y-2">
          {citas.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">No hay citas registradas</div>
          ) : citas.map(cita => {
            const est = ESTADO_CITA[cita.estado]
            return (
              <Link key={cita.id} href={`/citas/${cita.id}`}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:border-halu-200 hover:shadow-sm transition-all">
                <div className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', est.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 text-sm">{cita.paciente_nombre}</p>
                    <Badge variant="default">{est.label}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(cita.fecha_hora_inicio).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}{new Date(cita.fecha_hora_inicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    {' — '}{new Date(cita.fecha_hora_fin).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{cita.duracion_minutos} min
                  </p>
                  <p className="text-xs text-slate-400">{cita.medico_nombre}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
