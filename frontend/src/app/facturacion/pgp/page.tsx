'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { facturasPGPAPI, mensajeError } from '@/lib/api'
import { FacturaPGP, EstadoFactura } from '@/types'
import { PageHeader, Button, Badge, Spinner, EmptyState } from '@/components/ui'
import { ArrowLeft, PlusCircle, FileText, RefreshCw } from 'lucide-react'
import clsx from 'clsx'

const ESTADO_BADGE: Record<EstadoFactura, { label: string; color: string }> = {
  borrador:  { label: 'Borrador',  color: 'bg-slate-100 text-slate-700' },
  enviada:   { label: 'Enviada',   color: 'bg-blue-100 text-blue-700' },
  validada:  { label: 'Validada',  color: 'bg-green-100 text-green-700' },
  error:     { label: 'Error',     color: 'bg-red-100 text-red-700' },
  anulada:   { label: 'Anulada',   color: 'bg-gray-100 text-gray-500' },
}

const ESTADOS: { value: EstadoFactura | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'validada', label: 'Validadas' },
  { value: 'error',    label: 'Con error' },
  { value: 'anulada',  label: 'Anuladas' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

function fmtPeriodo(desde: string, hasta: string) {
  const d = new Date(desde + 'T12:00:00')
  const h = new Date(hasta + 'T12:00:00')
  return `${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} — ${h.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`
}

export default function FacturacionPGPPage() {
  const { usuario } = useAuth()
  const [facturas, setFacturas] = useState<FacturaPGP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFactura | ''>('')

  const cargar = () => {
    setLoading(true)
    const params = estadoFiltro ? { estado: estadoFiltro } : undefined
    facturasPGPAPI.list(params)
      .then(({ data }) => setFacturas(Array.isArray(data) ? data : data.results ?? []))
      .catch(err => setError(mensajeError(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [estadoFiltro])

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Facturación PGP / Capitado"
        description="Pago Global Prospectivo · Modalidad de pago global con RIPS en cero"
        action={
          usuario?.permisos.puede_facturar ? (
            <Link href="/facturacion/pgp/nueva">
              <Button><PlusCircle className="w-4 h-4" />Nueva Factura PGP</Button>
            </Link>
          ) : undefined
        }
      />

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-6">
        {ESTADOS.map(e => (
          <button
            key={e.value}
            onClick={() => setEstadoFiltro(e.value)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              estadoFiltro === e.value
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            {e.label}
          </button>
        ))}
        <button onClick={cargar} className="ml-auto p-1.5 text-slate-400 hover:text-slate-600">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading && <div className="flex justify-center py-20"><Spinner size="lg" /></div>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!loading && facturas.length === 0 && (
        <EmptyState
          icon={<FileText className="w-8 h-8" />}
          title="Sin facturas PGP"
          description="Crea la primera factura por Pago Global Prospectivo"
        />
      )}

      <div className="space-y-3">
        {facturas.map(f => {
          const est = ESTADO_BADGE[f.estado] ?? ESTADO_BADGE.borrador
          return (
            <Link key={f.id} href={`/facturacion/pgp/${f.id}`}>
              <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', est.color)}>{est.label}</span>
                    {f.numero_factus && (
                      <span className="text-sm font-mono font-bold text-slate-900">{f.numero_factus}</span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-slate-900">{fmt(f.valor_total)}</span>
                </div>
                <div className="text-sm text-slate-700 font-medium">{f.convenio_info?.aseguradora_nombre}</div>
                <div className="text-xs text-slate-500">{fmtPeriodo(f.periodo_desde, f.periodo_hasta)}</div>
                <div className="text-xs text-slate-400 line-clamp-1">{f.descripcion_contrato}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
