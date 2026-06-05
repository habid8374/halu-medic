'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { facturasAPI, consultasAPI, pacientesAPI, citasAPI, mensajeError } from '@/lib/api'
import { PageHeader, Badge } from '@/components/ui'
import toast from 'react-hot-toast'
import {
  TrendingUp, Receipt, Users, CalendarDays, ClipboardList,
  CheckCircle, AlertCircle, Clock, XCircle, BarChart3,
  ArrowUp, DollarSign, FileText,
} from 'lucide-react'
import { formatCOP } from '@/components/facturacion/helpers'
import clsx from 'clsx'

interface Resumen {
  totalPacientes: number
  citasHoy: number
  consultasAbiertas: number
  facturas: { validadas: number; enviadas: number; error: number; anuladas: number; total: number }
  ingresosMes: number
  copagosMes: number
}

const hoy = new Date().toISOString().slice(0, 10)

export default function ReportesPage() {
  const { usuario } = useAuth()
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodoLabel] = useState(() => {
    const d = new Date()
    return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  })

  useEffect(() => {
    const cargar = async () => {
      try {
        const [pac, citasRes, consultasRes, factRes] = await Promise.allSettled([
          pacientesAPI.list({ page_size: 1 }),
          citasAPI.list({ fecha: hoy }),
          consultasAPI.list({ estado: 'abierta', page_size: 1 }),
          facturasAPI.list({ page_size: 200 }),
        ])

        const totalPacientes = pac.status === 'fulfilled' ? pac.value.data.count : 0
        const citasHoy = citasRes.status === 'fulfilled' ? citasRes.value.data.count || citasRes.value.data.results?.length || 0 : 0
        const consultasAbiertas = consultasRes.status === 'fulfilled' ? consultasRes.value.data.count : 0

        let validadas = 0, enviadas = 0, error = 0, anuladas = 0
        let ingresosMes = 0, copagosMes = 0
        const mesActual = new Date().toISOString().slice(0, 7)

        if (factRes.status === 'fulfilled') {
          const facts = factRes.value.data.results || []
          facts.forEach((f: any) => {
            if (f.estado === 'validada') validadas++
            else if (f.estado === 'enviada') enviadas++
            else if (f.estado === 'error') error++
            else if (f.estado === 'anulada') anuladas++

            if (f.estado === 'validada' && f.creado_en?.startsWith(mesActual)) {
              ingresosMes += parseFloat(f.total || 0)
              copagosMes  += parseFloat(f.valor_copago || 0)
            }
          })
        }

        setResumen({
          totalPacientes, citasHoy, consultasAbiertas,
          facturas: { validadas, enviadas, error, anuladas, total: validadas + enviadas + error + anuladas },
          ingresosMes, copagosMes,
        })
      } catch (err) {
        toast.error(mensajeError(err))
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  if (loading) return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-100 rounded-xl w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-64 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    </div>
  )

  const r = resumen!

  return (
    <div className="p-8 animate-fade-in">
      <PageHeader
        title="Reportes"
        description={`Resumen del consultorio · ${periodoLabel}`}
      />

      {/* ── KPIs principales ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pacientes activos', valor: r.totalPacientes, icon: Users, color: 'text-halu-600', bg: 'bg-halu-50', visible: true },
          { label: 'Citas hoy', valor: r.citasHoy, icon: CalendarDays, color: 'text-teal-600', bg: 'bg-teal-50', visible: usuario?.permisos.puede_gestionar_citas },
          { label: 'Consultas abiertas', valor: r.consultasAbiertas, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', visible: usuario?.permisos.puede_ver_clinica },
          { label: 'Facturas emitidas', valor: r.facturas.total, icon: Receipt, color: 'text-emerald-600', bg: 'bg-emerald-50', visible: usuario?.permisos.puede_facturar },
        ].filter(k => k.visible).map((k) => (
          <div key={k.label} className="bg-white rounded-2xl p-5 border border-slate-100 hover:shadow-sm transition-all">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', k.bg)}>
              <k.icon className={clsx('w-5 h-5', k.color)} />
            </div>
            <p className="text-3xl font-bold text-slate-900">{k.valor}</p>
            <p className="text-sm text-slate-500 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* ── Estado de facturación ─────────────────────────────────────── */}
        {usuario?.permisos.puede_facturar && (
          <div className="bg-white rounded-2xl p-6 border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-5 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-halu-600" />
              Estado de facturas
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Validadas por DIAN', count: r.facturas.validadas, icon: CheckCircle, color: 'text-emerald-600', bar: 'bg-emerald-500' },
                { label: 'En proceso / Enviadas', count: r.facturas.enviadas, icon: Clock,        color: 'text-amber-600',  bar: 'bg-amber-400' },
                { label: 'Con errores',           count: r.facturas.error,    icon: AlertCircle,  color: 'text-red-500',    bar: 'bg-red-400' },
                { label: 'Anuladas',              count: r.facturas.anuladas, icon: XCircle,      color: 'text-slate-400',  bar: 'bg-slate-200' },
              ].map((item) => {
                const pct = r.facturas.total > 0 ? (item.count / r.facturas.total) * 100 : 0
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <item.icon className={clsx('w-4 h-4', item.color)} />
                        <span className="text-sm text-slate-700">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{item.count}</span>
                        <span className="text-xs text-slate-400">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={clsx('h-full rounded-full transition-all', item.bar)}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Ingresos del mes ──────────────────────────────────────────── */}
        {usuario?.permisos.puede_facturar && (
          <div className="bg-gradient-to-br from-halu-900 to-halu-700 rounded-2xl p-6 text-white">
            <h3 className="font-semibold text-sm mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-300" />
              Ingresos del mes ({periodoLabel})
            </h3>
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-teal-400" />
                  <p className="text-xs text-halu-300">Total facturado (validado DIAN)</p>
                </div>
                <p className="text-4xl font-bold tracking-tight">{formatCOP(r.ingresosMes)}</p>
              </div>
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUp className="w-4 h-4 text-amber-300" />
                  <p className="text-xs text-halu-300">Copagos recaudados</p>
                </div>
                <p className="text-2xl font-semibold">{formatCOP(r.copagosMes)}</p>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-xl p-3">
                <FileText className="w-4 h-4 text-teal-300 flex-shrink-0" />
                <p className="text-xs text-halu-200">
                  Datos basados en facturas validadas por la DIAN en el mes actual.
                  Normativa: Res. 948/2026 — SS-CUFE / SS-SinAporte
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Indicador normativo ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Estado normativo del sistema
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Resolución 948/2026', desc: 'RIPS JSON como soporte FEV',      ok: true },
            { label: 'CUCON activo',        desc: 'SHA-256 en convenios EPS',         ok: true },
            { label: 'SS-CUFE / SS-SinAporte', desc: 'Factus API habilitado',         ok: true },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
