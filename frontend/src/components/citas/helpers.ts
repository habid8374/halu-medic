import { EstadoCita } from '@/types'

export const ESTADO_CITA: Record<EstadoCita, { label: string; color: string; bg: string; dot: string }> = {
  programada:  { label: 'Programada',  color: 'text-halu-700',    bg: 'bg-halu-50',    dot: 'bg-halu-500' },
  confirmada:  { label: 'Confirmada',  color: 'text-teal-700',    bg: 'bg-teal-50',    dot: 'bg-teal-500' },
  en_curso:    { label: 'En curso',    color: 'text-amber-700',   bg: 'bg-amber-50',   dot: 'bg-amber-500' },
  atendida:    { label: 'Atendida',    color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  cancelada:   { label: 'Cancelada',   color: 'text-red-600',     bg: 'bg-red-50',     dot: 'bg-red-400' },
  no_asistio:  { label: 'No asistió',  color: 'text-slate-500',   bg: 'bg-slate-100',  dot: 'bg-slate-400' },
}

export function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

export function formatFechaCita(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short'
  })
}

// Genera los slots de hora para la agenda (cada 20 min, 7am-7pm)
export function generarSlots(inicio = 7, fin = 19, intervalo = 20): string[] {
  const slots: string[] = []
  for (let h = inicio; h < fin; h++) {
    for (let m = 0; m < 60; m += intervalo) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}

// Semana actual — array de 7 fechas desde el lunes
export function semanaDesde(fecha: Date): Date[] {
  const d = new Date(fecha)
  const dia = d.getDay()
  const lunes = new Date(d)
  lunes.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const f = new Date(lunes)
    f.setDate(lunes.getDate() + i)
    return f
  })
}

export function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
