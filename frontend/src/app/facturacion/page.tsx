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
    <div className="page-padding animate-fade-in">
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

      {/* Acceso rápido PGP */}
      <div className="mb-4">
        <Link href="/facturacion/pgp">
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 flex items-center justify-between hover:bg-cyan-100 transition-colors cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-cyan-800">Facturación PGP / Capitado</p>
              <p className="text-xs text-cyan-600 mt-0.5">Pago Global Prospectivo · Modalidad capitada · RIPS en cero</p>
            </div>
            <span className="text-cyan-500 text-xs font-medium">Ver facturas PGP →</span>
          </div>
        </Link>
      </div>

      {/* Acceso rápido Nota Crédito / Débito */}
      <div className="mb-4">
        <Link href="/facturacion/notas">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between hover:bg-red-100 transition-colors cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-red-800">Notas crédito / débito</p>
              <p className="text-xs text-red-600 mt-0.5">NC: reducen valor · ND: aumentan valor · Referencia CUFE original · DIAN via Factus</p>
            </div>
            <span className="text-red-500 text-xs font-medium">Ver notas →</span>
          </div>
        </Link>
      </div>

      {/* Acceso rápido Prefactura */}
      <div className="mb-4">
        <Link href="/facturacion/prefacturas">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between hover:bg-violet-100 transition-colors cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-violet-800">Prefacturas / Preliquidación</p>
              <p className="text-xs text-violet-600 mt-0.5">Revisión y aprobación antes de generar FEV · Ajuste de ítems no facturables</p>
            </div>
            <span className="text-violet-500 text-xs font-medium">Ver prefacturas →</span>
          </div>
        </Link>
      </div>

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
