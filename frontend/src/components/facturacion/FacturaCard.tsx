'use client'
import Link from 'next/link'
import { Factura } from '@/types'
import { Badge } from '@/components/ui'
import { ESTADO_FACTURA, formatCOP, formatFechaFactura, tipoOperacionLabel } from './helpers'
import { CheckCircle, AlertCircle, Clock, FileText, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const estadoIcono = {
  borrador: FileText,
  enviada:  Clock,
  validada: CheckCircle,
  error:    AlertCircle,
  anulada:  FileText,
}

export function FacturaCard({ factura }: { factura: Factura }) {
  const est   = ESTADO_FACTURA[factura.estado]
  const Icono = estadoIcono[factura.estado]

  return (
    <Link
      href={`/facturacion/${factura.id}`}
      className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100
        hover:border-halu-200 hover:shadow-sm transition-all group"
    >
      {/* Icono estado */}
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', est.bg)}>
        <Icono className={clsx('w-5 h-5', est.color)} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-slate-900 text-sm truncate">
            {factura.consulta_info?.paciente ?? '—'}
          </p>
          <Badge variant={est.badge}>{est.label}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {factura.numero_factus && (
            <span className="text-xs font-mono text-slate-500">{factura.numero_factus}</span>
          )}
          <span className="text-xs text-slate-400">
            {tipoOperacionLabel(factura)}
          </span>
          <span className="text-xs text-slate-400">
            {formatFechaFactura(factura.creado_en)}
          </span>
        </div>
        {factura.cufe && (
          <p className="text-xs font-mono text-slate-300 truncate mt-0.5 max-w-xs">
            CUFE: {factura.cufe.slice(0, 32)}...
          </p>
        )}
      </div>

      {/* Total */}
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-slate-900 text-sm">{formatCOP(factura.total)}</p>
        {factura.valor_copago > 0 && (
          <p className="text-xs text-slate-400 mt-0.5">
            Copago: {formatCOP(factura.valor_copago)}
          </p>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-halu-400 transition-colors flex-shrink-0" />
    </Link>
  )
}

export function FacturaCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-slate-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-40" />
        <div className="h-3 bg-slate-100 rounded w-56" />
      </div>
      <div className="w-20 h-4 bg-slate-200 rounded" />
    </div>
  )
}
