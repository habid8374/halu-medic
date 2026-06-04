'use client'
import { use } from 'react'
import Link from 'next/link'
import { useCita } from '@/hooks/useCitas'
import { useAuth } from '@/lib/auth-context'
import { ESTADO_CITA, formatHora, formatFechaCita } from '@/components/citas/helpers'
import { Badge, Button, Card, Spinner, PageHeader } from '@/components/ui'
import { ArrowLeft, User, Clock, CalendarDays, ClipboardPlus } from 'lucide-react'
import clsx from 'clsx'

export default function CitaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { usuario } = useAuth()
  const { cita, loading } = useCita(id)

  if (loading) return <div className="p-8 flex justify-center py-20"><Spinner size="lg" /></div>
  if (!cita)   return <div className="p-8"><p className="text-slate-500">Cita no encontrada.</p></div>

  const est = ESTADO_CITA[cita.estado]

  return (
    <div className="p-8 max-w-2xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/citas"><Button variant="ghost" className="px-2"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <PageHeader title="Detalle de cita" />
      </div>
      <div className="space-y-4">
        <Card>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900 text-lg">{cita.paciente_nombre}</h2>
              <p className="text-sm text-slate-500">{cita.medico_nombre}</p>
            </div>
            <span className={clsx('px-3 py-1 rounded-full text-xs font-medium', est.bg, est.color)}>
              {est.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Fecha</p>
                <p className="text-sm font-medium text-slate-800">{formatFechaCita(cita.fecha_hora_inicio)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">Hora</p>
                <p className="text-sm font-medium text-slate-800">
                  {formatHora(cita.fecha_hora_inicio)} — {formatHora(cita.fecha_hora_fin)}
                  <span className="text-slate-400 ml-1">({cita.duracion_minutos} min)</span>
                </p>
              </div>
            </div>
          </div>
          {cita.motivo_consulta && (
            <div className="mt-4 pt-4 border-t border-slate-50">
              <p className="text-xs text-slate-400 mb-1">Motivo</p>
              <p className="text-sm text-slate-700">{cita.motivo_consulta}</p>
            </div>
          )}
        </Card>
        {usuario?.permisos.puede_editar_clinica && cita.estado !== 'atendida' && (
          <Link href={`/consultas/nueva?cita=${cita.id}&paciente=${cita.paciente}`}>
            <Button className="w-full">
              <ClipboardPlus className="w-4 h-4" />
              Iniciar consulta
            </Button>
          </Link>
        )}
        <Link href={`/pacientes/${cita.paciente}`}>
          <Button variant="secondary" className="w-full">
            <User className="w-4 h-4" />
            Ver paciente
          </Button>
        </Link>
      </div>
    </div>
  )
}
