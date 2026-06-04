import { EstadoFactura } from '@/types'

export const ESTADO_FACTURA: Record<EstadoFactura, {
  label: string; color: string; bg: string; badge: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
}> = {
  borrador:  { label: 'Borrador',        color: 'text-slate-600',   bg: 'bg-slate-50',   badge: 'default' },
  enviada:   { label: 'Enviada a DIAN',  color: 'text-amber-700',  bg: 'bg-amber-50',   badge: 'warning' },
  validada:  { label: 'Validada DIAN',   color: 'text-emerald-700',bg: 'bg-emerald-50', badge: 'success' },
  error:     { label: 'Error DIAN',      color: 'text-red-600',    bg: 'bg-red-50',     badge: 'danger'  },
  anulada:   { label: 'Anulada',         color: 'text-slate-400',  bg: 'bg-slate-100',  badge: 'default' },
}

export function formatCOP(valor: number | string): string {
  const n = typeof valor === 'string' ? parseFloat(valor) : valor
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

export function formatFechaFactura(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Tipo de operación SS según si tiene convenio y copago
export function tipoOperacionLabel(factura: { convenio?: string; valor_copago: number }): string {
  if (!factura.convenio) return 'SS-SinAporte (Particular)'
  if (factura.valor_copago > 0) return 'SS-CUFE (Con aporte EPS)'
  return 'SS-CUFE (Sin copago)'
}
