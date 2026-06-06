'use client'
import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { mensajeError } from '@/lib/api'
import { PageHeader, Spinner } from '@/components/ui'
import toast from 'react-hot-toast'
import {
  BarChart3, Receipt, ClipboardList, Clock, AlertCircle,
  CheckCircle, Download, RefreshCw, TrendingUp, Users,
  FileText, Stethoscope, Activity, ShieldAlert,
} from 'lucide-react'
import clsx from 'clsx'
import api from '@/lib/api'

// ── helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}
function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function exportCSV(rows: Record<string, unknown>[], nombre: string) {
  if (!rows.length) { toast.error('Sin datos para exportar'); return }
  const cols = Object.keys(rows[0])
  const sep = ','
  const lines = [
    cols.join(sep),
    ...rows.map(r => cols.map(c => {
      const v = String(r[c] ?? '')
      return v.includes(sep) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
    }).join(sep)),
  ]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${nombre}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── tipos de reporte ────────────────────────────────────────────────────────
const REPORTES = [
  { id: 'resumen',            label: 'Resumen general',          icon: BarChart3 },
  { id: 'hc_facturacion',     label: 'HC vs Facturación',        icon: ClipboardList },
  { id: 'facturacion_periodo',label: 'Facturación por período',  icon: Receipt },
  { id: 'pendientes',         label: 'Pendientes de facturar',   icon: Clock },
  { id: 'por_aseguradora',    label: 'Por aseguradora (EPS)',    icon: Users },
  { id: 'glosas',             label: 'Glosas y errores',         icon: ShieldAlert },
  { id: 'top_diagnosticos',   label: 'Top diagnósticos CIE-10',  icon: Stethoscope },
  { id: 'top_procedimientos', label: 'Top procedimientos CUPS',  icon: Activity },
  { id: 'rips_estado',        label: 'Estado RIPS / CUV',        icon: FileText },
] as const

type ReporteId = typeof REPORTES[number]['id']

// ── subcomponentes de tabla ────────────────────────────────────────────────
function Tabla({ cols, rows }: { cols: { key: string; label: string; right?: boolean }[]; rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="text-sm text-slate-400 text-center py-8">Sin registros en el período</p>
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            {cols.map(c => (
              <th key={c.key} className={clsx('px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap', c.right ? 'text-right' : 'text-left')}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
              {cols.map(c => (
                <td key={c.key} className={clsx('px-3 py-2.5 text-slate-700', c.right ? 'text-right font-medium' : '')}>{String(r[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function KPICard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={clsx('text-3xl font-bold', color ?? 'text-slate-900')}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── renderizadores por tipo ────────────────────────────────────────────────
function ResumenGeneral({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Atenciones (HC)" value={String(data.total_hc ?? 0)} />
        <KPICard label="Facturadas" value={String(data.hc_facturadas ?? 0)} color="text-emerald-600" />
        <KPICard label="Pendientes" value={String(data.hc_pendientes ?? 0)} color="text-amber-600" />
        <KPICard label="Total facturado" value={fmt(Number(data.total_facturado ?? 0))} color="text-halu-700" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard label="Facturas validadas DIAN" value={String(data.facturas_validadas ?? 0)} sub="Estado: validada" color="text-emerald-600" />
        <KPICard label="Con error / glosa" value={String(data.facturas_error ?? 0)} sub="Requieren corrección" color="text-red-500" />
        <KPICard label="Pacientes atendidos" value={String(data.pacientes_unicos ?? 0)} sub="Únicos en el período" />
      </div>
    </div>
  )
}

function HCFacturacion({ data }: { data: { items?: Record<string, unknown>[] } }) {
  const rows = data.items ?? []
  return (
    <Tabla
      cols={[
        { key: 'numero_hc', label: 'HC' },
        { key: 'paciente', label: 'Paciente' },
        { key: 'fecha_atencion', label: 'Fecha atención' },
        { key: 'tipo_registro', label: 'Tipo' },
        { key: 'diagnostico', label: 'Diagnóstico' },
        { key: 'estado_factura', label: 'Estado factura' },
        { key: 'numero_factura', label: 'N° factura' },
        { key: 'valor_factura', label: 'Valor', right: true },
      ]}
      rows={rows}
    />
  )
}

function FacturacionPeriodo({ data }: { data: { items?: Record<string, unknown>[]; total?: number; count?: number } }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KPICard label="Total facturas" value={String(data.count ?? 0)} />
        <KPICard label="Monto total" value={fmt(Number(data.total ?? 0))} color="text-emerald-600" />
      </div>
      <Tabla
        cols={[
          { key: 'numero_factus', label: 'N° factura' },
          { key: 'fecha', label: 'Fecha' },
          { key: 'paciente', label: 'Paciente' },
          { key: 'numero_hc', label: 'HC' },
          { key: 'aseguradora', label: 'EPS / Particular' },
          { key: 'estado', label: 'Estado' },
          { key: 'total', label: 'Valor', right: true },
        ]}
        rows={data.items ?? []}
      />
    </div>
  )
}

function PendientesFacturar({ data }: { data: { items?: Record<string, unknown>[]; count?: number } }) {
  return (
    <div className="space-y-4">
      {(data.count ?? 0) > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">{data.count} historias clínicas sin facturar en el período</p>
        </div>
      )}
      <Tabla
        cols={[
          { key: 'numero_hc', label: 'HC' },
          { key: 'paciente', label: 'Paciente' },
          { key: 'documento', label: 'Documento' },
          { key: 'fecha_atencion', label: 'Fecha atención' },
          { key: 'tipo_registro', label: 'Tipo' },
          { key: 'diagnostico_principal', label: 'Diagnóstico' },
          { key: 'aseguradora', label: 'EPS' },
        ]}
        rows={data.items ?? []}
      />
    </div>
  )
}

function PorAseguradora({ data }: { data: { items?: Record<string, unknown>[] } }) {
  return (
    <Tabla
      cols={[
        { key: 'aseguradora', label: 'Aseguradora (EPS)' },
        { key: 'nit', label: 'NIT' },
        { key: 'facturas', label: 'Facturas', right: true },
        { key: 'validadas', label: 'Validadas', right: true },
        { key: 'pendientes', label: 'Pendientes HC', right: true },
        { key: 'glosas', label: 'Glosas', right: true },
        { key: 'total', label: 'Total facturado', right: true },
      ]}
      rows={data.items ?? []}
    />
  )
}

function GlosasErrores({ data }: { data: { items?: Record<string, unknown>[]; total_glosas?: number } }) {
  return (
    <div className="space-y-4">
      {(data.total_glosas ?? 0) > 0 && (
        <KPICard label="Total glosas / errores" value={String(data.total_glosas)} color="text-red-600" />
      )}
      <Tabla
        cols={[
          { key: 'numero_factura', label: 'N° factura' },
          { key: 'fecha', label: 'Fecha' },
          { key: 'paciente', label: 'Paciente' },
          { key: 'aseguradora', label: 'EPS' },
          { key: 'estado', label: 'Estado' },
          { key: 'error_detalle', label: 'Detalle error' },
          { key: 'total', label: 'Valor', right: true },
        ]}
        rows={data.items ?? []}
      />
    </div>
  )
}

function TopDiagnosticos({ data }: { data: { items?: Record<string, unknown>[] } }) {
  return (
    <Tabla
      cols={[
        { key: 'rank', label: '#', right: true },
        { key: 'cie10', label: 'CIE-10' },
        { key: 'descripcion', label: 'Diagnóstico' },
        { key: 'total', label: 'Atenciones', right: true },
        { key: 'facturadas', label: 'Facturadas', right: true },
      ]}
      rows={(data.items ?? []).map((r, i) => ({ rank: i + 1, ...r }))}
    />
  )
}

function TopProcedimientos({ data }: { data: { items?: Record<string, unknown>[] } }) {
  return (
    <Tabla
      cols={[
        { key: 'rank', label: '#', right: true },
        { key: 'cups', label: 'CUPS' },
        { key: 'descripcion', label: 'Procedimiento' },
        { key: 'total', label: 'Órdenes', right: true },
        { key: 'ejecutadas', label: 'Ejecutadas', right: true },
      ]}
      rows={(data.items ?? []).map((r, i) => ({ rank: i + 1, ...r }))}
    />
  )
}

function RIPSEstado({ data }: { data: { items?: Record<string, unknown>[]; cuv_pendientes?: number; cuv_validados?: number } }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <KPICard label="RIPS validados (CUV)" value={String(data.cuv_validados ?? 0)} color="text-emerald-600" />
        <KPICard label="RIPS pendientes" value={String(data.cuv_pendientes ?? 0)} color="text-amber-600" />
      </div>
      <Tabla
        cols={[
          { key: 'numero_factura', label: 'N° factura' },
          { key: 'fecha', label: 'Fecha' },
          { key: 'paciente', label: 'Paciente' },
          { key: 'cuv', label: 'CUV' },
          { key: 'estado_rips', label: 'Estado RIPS' },
          { key: 'cucon', label: 'CUCON' },
        ]}
        rows={data.items ?? []}
      />
    </div>
  )
}

// ── página principal ───────────────────────────────────────────────────────
export default function ReportesPage() {
  const { usuario } = useAuth()
  const hoy = new Date().toISOString().slice(0, 10)
  const primeroDeMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [tipoReporte, setTipoReporte] = useState<ReporteId>('resumen')
  const [fechaDesde, setFechaDesde] = useState(primeroDeMes)
  const [fechaHasta, setFechaHasta] = useState(hoy)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [generado, setGenerado] = useState(false)

  const generar = useCallback(async () => {
    setLoading(true)
    setGenerado(false)
    try {
      const params = new URLSearchParams({ tipo: tipoReporte })
      if (fechaDesde) params.set('fecha_desde', fechaDesde)
      if (fechaHasta) params.set('fecha_hasta', fechaHasta)
      const { data: res } = await api.get(`/api/reportes/?${params}`)
      setData(res)
      setGenerado(true)
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setLoading(false)
    }
  }, [tipoReporte, fechaDesde, fechaHasta])

  const exportar = () => {
    if (!data) return
    const items: Record<string, unknown>[] = (data as any).items ?? (Array.isArray(data) ? data : [])
    exportCSV(items, `reporte_${tipoReporte}_${fechaDesde}_${fechaHasta}`)
  }

  const reporte = REPORTES.find(r => r.id === tipoReporte)!

  const renderData = () => {
    if (!data) return null
    const d = data as any
    switch (tipoReporte) {
      case 'resumen':             return <ResumenGeneral data={d} />
      case 'hc_facturacion':      return <HCFacturacion data={d} />
      case 'facturacion_periodo': return <FacturacionPeriodo data={d} />
      case 'pendientes':          return <PendientesFacturar data={d} />
      case 'por_aseguradora':     return <PorAseguradora data={d} />
      case 'glosas':              return <GlosasErrores data={d} />
      case 'top_diagnosticos':    return <TopDiagnosticos data={d} />
      case 'top_procedimientos':  return <TopProcedimientos data={d} />
      case 'rips_estado':         return <RIPSEstado data={d} />
      default:                    return null
    }
  }

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Reportes"
        description="Análisis clínico y de facturación · Exportación CSV"
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Panel izquierdo: selector de reporte ───────────────────────── */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo de reporte</p>
            </div>
            <div className="p-2 space-y-0.5">
              {REPORTES.map(r => (
                <button
                  key={r.id}
                  onClick={() => { setTipoReporte(r.id); setData(null); setGenerado(false) }}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                    tipoReporte === r.id
                      ? 'bg-halu-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <r.icon className="w-4 h-4 flex-shrink-0" />
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Área principal ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filtros + acciones */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
                  <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
                  <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={generar}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-halu-600 text-white text-sm font-medium hover:bg-halu-700 disabled:opacity-50 transition-all"
                >
                  {loading ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
                  Generar
                </button>
                {generado && (
                  <button
                    onClick={exportar}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Resultado */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-50">
              <reporte.icon className="w-5 h-5 text-halu-600" />
              <h2 className="font-semibold text-slate-900">{reporte.label}</h2>
              {generado && (
                <span className="ml-auto text-xs text-slate-400">
                  {fechaDesde && fmtDate(fechaDesde)} — {fechaHasta && fmtDate(fechaHasta)}
                </span>
              )}
            </div>

            {loading && (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            )}

            {!loading && !generado && (
              <div className="text-center py-16">
                <TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Selecciona un rango de fechas y presiona <strong>Generar</strong></p>
              </div>
            )}

            {!loading && generado && renderData()}
          </div>

          {/* Nota normativa */}
          <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              Reportes basados en datos de HC (Res. 1995/1999), facturas electrónicas y RIPS (Res. 948/2026).
              Exportación UTF-8 BOM compatible con Excel Colombia.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
