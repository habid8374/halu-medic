'use client'
import Link from 'next/link'
import { Paciente } from '@/types'
import { Badge } from '@/components/ui'
import { calcularEdad, iniciales, regimenInfo, tipoDocLabel } from './helpers'
import { Phone, Mail, ChevronRight, User } from 'lucide-react'
import clsx from 'clsx'

// Colores de avatar por inicial
const avatarColors = [
  'bg-halu-600', 'bg-teal-600', 'bg-purple-600',
  'bg-amber-600', 'bg-emerald-600', 'bg-rose-600',
]

function avatarColor(nombre: string) {
  const code = nombre.charCodeAt(0) || 0
  return avatarColors[code % avatarColors.length]
}

export function PacienteCard({ paciente }: { paciente: Paciente }) {
  const regimen = regimenInfo(paciente.regimen)
  const edad    = paciente.fecha_nacimiento ? calcularEdad(paciente.fecha_nacimiento) : null
  const ini     = iniciales(paciente.nombre_completo)

  return (
    <Link
      href={`/pacientes/${paciente.id}`}
      className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100
        hover:border-halu-200 hover:shadow-sm transition-all group"
    >
      {/* Avatar */}
      <div className={clsx(
        'w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0',
        avatarColor(paciente.primer_apellido)
      )}>
        <span className="text-white text-sm font-bold">{ini}</span>
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-slate-900 text-sm truncate">
            {paciente.nombre_completo}
          </p>
          <Badge variant={regimen.color as 'info' | 'success' | 'warning' | 'default' | 'purple'}>
            {regimen.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-xs text-slate-500">
            {tipoDocLabel(paciente.tipo_identificacion)} {paciente.numero_identificacion}
          </span>
          {edad !== null && (
            <span className="text-xs text-slate-400">{edad} años</span>
          )}
          {paciente.aseguradora_nombre && (
            <span className="text-xs text-slate-400 truncate max-w-[140px]">
              {paciente.aseguradora_nombre}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {paciente.telefono && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Phone className="w-3 h-3" />{paciente.telefono}
            </span>
          )}
          {paciente.email && (
            <span className="flex items-center gap-1 text-xs text-slate-400 truncate max-w-[180px]">
              <Mail className="w-3 h-3" />{paciente.email}
            </span>
          )}
        </div>
      </div>

      {/* Flecha */}
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-halu-400 transition-colors flex-shrink-0" />
    </Link>
  )
}

// Versión skeleton para loading
export function PacienteCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 animate-pulse">
      <div className="w-11 h-11 rounded-full bg-slate-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-48" />
        <div className="h-3 bg-slate-100 rounded w-32" />
        <div className="h-3 bg-slate-100 rounded w-24" />
      </div>
    </div>
  )
}
