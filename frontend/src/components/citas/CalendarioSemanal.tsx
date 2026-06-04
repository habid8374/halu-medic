'use client'
import { useState, useMemo } from 'react'
import { Cita } from '@/types'
import { ESTADO_CITA, semanaDesde, isoDate, DIAS_SEMANA, formatHora } from './helpers'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'

const HORAS = Array.from({ length: 13 }, (_, i) => i + 7) // 7am a 7pm

interface Props {
  citas: Cita[]
  onDiaClick?: (fecha: string) => void
}

export function CalendarioSemanal({ citas, onDiaClick }: Props) {
  const [baseDate, setBaseDate] = useState(new Date())
  const semana = useMemo(() => semanaDesde(baseDate), [baseDate])
  const hoy = isoDate(new Date())

  const navSemana = (dir: number) => {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + dir * 7)
    setBaseDate(d)
  }

  // Indexar citas por fecha-hora para renderizado rápido
  const citasPorFecha = useMemo(() => {
    const idx: Record<string, Cita[]> = {}
    citas.forEach(c => {
      const f = c.fecha_hora_inicio.split('T')[0]
      if (!idx[f]) idx[f] = []
      idx[f].push(c)
    })
    return idx
  }, [citas])

  const labelSemana = () => {
    const ini = semana[0]
    const fin = semana[6]
    const mes = ini.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    return `${ini.getDate()} – ${fin.getDate()} de ${mes}`
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Header navegación */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-halu-600" />
          <span className="font-semibold text-slate-900 text-sm capitalize">{labelSemana()}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBaseDate(new Date())}
            className="px-3 py-1.5 text-xs font-medium text-halu-600 hover:bg-halu-50 rounded-lg transition-colors"
          >
            Hoy
          </button>
          <button onClick={() => navSemana(-1)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navSemana(1)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid días */}
      <div className="grid grid-cols-8 border-b border-slate-100">
        <div className="py-2 px-2 text-xs text-slate-400 text-center border-r border-slate-100" />
        {semana.map((dia, i) => {
          const iso = isoDate(dia)
          const esHoy = iso === hoy
          const nCitas = citasPorFecha[iso]?.length ?? 0
          return (
            <button
              key={iso}
              onClick={() => onDiaClick?.(iso)}
              className={clsx(
                'py-2 px-1 text-center border-r border-slate-100 last:border-0',
                'hover:bg-slate-50 transition-colors',
                esHoy && 'bg-halu-50'
              )}
            >
              <p className={clsx('text-xs font-medium', esHoy ? 'text-halu-600' : 'text-slate-500')}>
                {DIAS_SEMANA[i]}
              </p>
              <p className={clsx(
                'text-sm font-bold mt-0.5 w-7 h-7 rounded-full flex items-center justify-center mx-auto',
                esHoy ? 'bg-halu-600 text-white' : 'text-slate-900'
              )}>
                {dia.getDate()}
              </p>
              {nCitas > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 bg-teal-500 text-white text-[10px] font-bold rounded-full mt-0.5">
                  {nCitas}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Grid horas */}
      <div className="overflow-y-auto max-h-[520px]">
        {HORAS.map(hora => (
          <div key={hora} className="grid grid-cols-8 border-b border-slate-50 min-h-[52px]">
            {/* Etiqueta hora */}
            <div className="py-2 px-2 border-r border-slate-100 flex items-start justify-center pt-2">
              <span className="text-xs text-slate-400 font-mono">{hora}:00</span>
            </div>
            {/* Celdas por día */}
            {semana.map(dia => {
              const iso = isoDate(dia)
              const esHoy = iso === hoy
              const citasHora = (citasPorFecha[iso] ?? []).filter(c => {
                const h = new Date(c.fecha_hora_inicio).getHours()
                return h === hora
              })
              return (
                <div
                  key={iso}
                  className={clsx(
                    'border-r border-slate-50 last:border-0 p-1 space-y-0.5',
                    esHoy && 'bg-halu-50/40'
                  )}
                >
                  {citasHora.map(cita => {
                    const estado = ESTADO_CITA[cita.estado]
                    return (
                      <Link
                        key={cita.id}
                        href={`/citas/${cita.id}`}
                        className={clsx(
                          'block px-1.5 py-1 rounded-lg text-[10px] font-medium leading-tight',
                          'border-l-2 hover:opacity-80 transition-opacity',
                          estado.bg, estado.color
                        )}
                        style={{ borderLeftColor: estado.dot.replace('bg-', '') }}
                      >
                        <p className="truncate">{formatHora(cita.fecha_hora_inicio)}</p>
                        <p className="truncate opacity-80">{cita.paciente_nombre?.split(' ')[0]}</p>
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
