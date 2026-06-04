'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useFacturas } from '@/hooks/useFacturas'
import { FacturaCard, FacturaCardSkeleton } from '@/components/facturacion/FacturaCard'
import { ESTADO_FACTURA } from '@/components/facturacion/helpers'
import { PageHeader, Button, EmptyState, Badge } from '@/components/ui'
import { Receipt, Filter } from 'lucide-react'
import clsx from 'clsx'
import { EstadoFactura } from '@/types'

const ESTADOS: { value: EstadoFactura | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'enviada',  label: 'Enviada' },
  { value: 'validada', label: 'Validadas' },
  { value: 'error',    label: 'Con error' },
  { value: 'anulada',  label: 'Anuladas' },
]

export default function FacturacionPage() {
  const { usuario } = useAuth()
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFactura | ''>('')
  const params = estadoFiltro ? { estado: estadoFiltro } : undefined
  const { data, loading } = useFacturas(params)
  const facturas = data?.results ?? []

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Facturación electrónica"
        description="SS-CUFE · SS-SinAporte · Res. 948/2026 · Factus API"
        action={
          usuario?.permisos.puede_facturar ? (
            <Link href="/facturacion/nueva">
              <Button><Receipt className="w-4 h-4" />Nueva factura</Button>
            </Link>
          ) : undefined
        }
      />

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(['validada', 'enviada', 'error', 'borrador'] as EstadoFactura[]).map(e => {
          const est = ESTADO_FACTURA[e]
          const n = data?.results.filter(f => f.estado === e).length ?? 0
          return (
            <button
              key={e}
              onClick={() => setEstadoFiltro(estadoFiltro === e ? '' : e)}
              className={clsx(
                'p-3 rounded-xl border text-left transition-all',
                estadoFiltro === e
                  ? `${est.bg} border-current`
                  : 'bg-white border-slate-100 hover:border-slate-200'
              )}
            >
              <p className={clsx('text-xl font-bold', estadoFiltro === e ? est.color : 'text-slate-900')}>
                {loading ? '—' : data?.results.filter(f => f.estado === e).length ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{est.label}</p>
            </button>
          )
        })}
      </div>

      {/* Filtros de estado */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {ESTADOS.map(e => (
          <button
            key={e.value}
            onClick={() => setEstadoFiltro(e.value as EstadoFactura | '')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              estadoFiltro === e.value
                ? 'bg-halu-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <FacturaCardSkeleton key={i} />)
        ) : facturas.length === 0 ? (
          <EmptyState
            title="No hay facturas"
            description="Las facturas electrónicas aparecerán aquí una vez creadas"
            action={
              usuario?.permisos.puede_facturar ? (
                <Link href="/facturacion/nueva">
                  <Button><Receipt className="w-4 h-4" />Crear factura</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          facturas.map(f => <FacturaCard key={f.id} factura={f} />)
        )}
      </div>
    </div>
  )
}
