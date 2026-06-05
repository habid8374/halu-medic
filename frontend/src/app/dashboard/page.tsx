'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { pacientesAPI, citasAPI, consultasAPI, facturasAPI } from '@/lib/api'
import {
  Users, CalendarDays, Receipt, ClipboardList,
  CheckCircle, AlertCircle, Clock, Stethoscope,
  FileText, Activity, TrendingUp, ArrowRight,
  UserPlus, Plus, BookOpen, FileSpreadsheet,
} from 'lucide-react'
import clsx from 'clsx'

const saludar = (nombre: string) => {
  const h = new Date().getHours()
  const s = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches'
  return `${s}, ${nombre.split(' ')[0]}`
}

const fechaHoy = () => new Date().toLocaleDateString('es-CO', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})

export default function DashboardPage() {
  const { usuario } = useAuth()
  const [stats, setStats] = useState({ pacientes: 0, citasHoy: 0, consultasAbiertas: 0, facturasPendientes: 0 })
  const [factEstados, setFactEstados] = useState({ validadas: 0, enviadas: 0, error: 0 })
  const [loadingStats, setLoadingStats] = useState(true)

  const hoyISO = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    const cargar = async () => {
      const [pac, citas, consultas, facts] = await Promise.allSettled([
        pacientesAPI.list({ page_size: 1 }),
        citasAPI.list({ fecha: hoyISO }),
        consultasAPI.list({ estado: 'abierta', page_size: 1 }),
        facturasAPI.list({ page_size: 100 }),
      ])

      const pacientes = pac.status === 'fulfilled' ? pac.value.data.count : 0
      const citasHoy  = citas.status === 'fulfilled'
        ? (citas.value.data.count ?? citas.value.data.results?.length ?? 0) : 0
      const consultasAbiertas = consultas.status === 'fulfilled' ? consultas.value.data.count : 0

      let validadas = 0, enviadas = 0, error = 0, pendientes = 0
      if (facts.status === 'fulfilled') {
        facts.value.data.results?.forEach((f: any) => {
          if (f.estado === 'validada') validadas++
          else if (f.estado === 'enviada') { enviadas++; pendientes++ }
          else if (f.estado === 'error')   { error++; pendientes++ }
          else if (f.estado === 'borrador') pendientes++
        })
      }

      setStats({ pacientes, citasHoy, consultasAbiertas, facturasPendientes: pendientes })
      setFactEstados({ validadas, enviadas, error })
      setLoadingStats(false)
    }
    cargar()
  }, [hoyISO])

  if (!usuario) return null

  const p = usuario.permisos

  const metricas = [
    { label: 'Pacientes activos',  valor: stats.pacientes,           icon: Users,         color: 'text-halu-600',    bg: 'bg-halu-50',    visible: true },
    { label: 'Citas hoy',          valor: stats.citasHoy,            icon: CalendarDays,  color: 'text-teal-600',    bg: 'bg-teal-50',    visible: p.puede_gestionar_citas },
    { label: 'Consultas abiertas', valor: stats.consultasAbiertas,   icon: ClipboardList, color: 'text-amber-600',   bg: 'bg-amber-50',   visible: p.puede_ver_clinica },
    { label: 'Facturas pendientes',valor: stats.facturasPendientes,  icon: Receipt,       color: 'text-emerald-600', bg: 'bg-emerald-50', visible: p.puede_facturar },
  ].filter(m => m.visible)

  const accesos = [
    { label: 'Nuevo paciente',   href: '/pacientes/nuevo',   icon: UserPlus,     color: 'bg-halu-600',    visible: p.puede_gestionar_citas },
    { label: 'Nueva cita',       href: '/citas/nueva',       icon: CalendarDays, color: 'bg-teal-600',    visible: p.puede_gestionar_citas },
    { label: 'Nueva consulta',   href: '/consultas/nueva',   icon: Stethoscope,  color: 'bg-violet-600',  visible: p.puede_editar_clinica },
    { label: 'Nueva factura',    href: '/facturacion/nueva',          icon: Receipt,          color: 'bg-emerald-600', visible: p.puede_facturar },
    { label: 'Factura PGP',      href: '/facturacion/pgp/nueva',      icon: FileSpreadsheet,  color: 'bg-cyan-600',    visible: p.puede_facturar },
    { label: 'Nuevo ingreso',    href: '/historia-clinica/ingresos/nuevo', icon: BookOpen,    color: 'bg-purple-600',  visible: p.puede_ver_clinica },
    { label: 'Ver reportes',     href: '/reportes',                   icon: TrendingUp,       color: 'bg-slate-600',   visible: p.puede_facturar },
    { label: 'Configuración',    href: '/configuracion',              icon: FileText,         color: 'bg-orange-500',  visible: p.es_admin },
  ].filter(a => a.visible)

  return (
    <div className="page-padding animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{saludar(usuario.nombre)}</h1>
          <p className="text-slate-500 text-sm mt-1 capitalize">{fechaHoy()}</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-100">
          <Activity className="w-3.5 h-3.5" />
          Sistema operativo
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {metricas.map((m) => (
          <div key={m.label} className="bg-white rounded-2xl p-5 border border-slate-100 hover:shadow-sm transition-all">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', m.bg)}>
              <m.icon className={clsx('w-5 h-5', m.color)} />
            </div>
            {loadingStats
              ? <div className="h-8 bg-slate-100 animate-pulse rounded-lg w-16 mb-1" />
              : <p className="text-3xl font-bold text-slate-900">{m.valor}</p>
            }
            <p className="text-sm text-slate-500 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Estado facturación DIAN */}
        {p.puede_facturar && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-halu-600" />
                Facturación DIAN
              </span>
              <Link href="/facturacion" className="text-xs text-halu-600 hover:underline flex items-center gap-1">
                Ver todo <ArrowRight className="w-3 h-3" />
              </Link>
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Validadas',   count: factEstados.validadas, icon: CheckCircle, color: 'text-emerald-600' },
                { label: 'En proceso',  count: factEstados.enviadas,  icon: Clock,       color: 'text-amber-600' },
                { label: 'Con errores', count: factEstados.error,     icon: AlertCircle, color: 'text-red-500' },
              ].map((e) => (
                <div key={e.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <e.icon className={clsx('w-4 h-4', e.color)} />
                    <span className="text-sm text-slate-700">{e.label}</span>
                  </div>
                  {loadingStats
                    ? <div className="h-4 w-6 bg-slate-100 animate-pulse rounded" />
                    : <span className="text-sm font-semibold text-slate-900">{e.count}</span>
                  }
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-halu-50 rounded-xl">
              <p className="text-xs text-halu-700 font-medium">SS-CUFE · SS-SinAporte · Res. 948/2026</p>
              <p className="text-xs text-halu-500 mt-0.5">Facturación sector salud activa</p>
            </div>
          </div>
        )}

        {/* Accesos rápidos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Accesos rápidos</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {accesos.map((a) => (
              <Link key={a.label} href={a.href}
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all group">
                <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', a.color)}>
                  <a.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-slate-600 text-center font-medium leading-tight">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Info normativa */}
        <div className="bg-gradient-to-br from-halu-900 to-halu-700 rounded-2xl p-5 text-white">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-300" />
            Normativa vigente
          </h3>
          <div className="space-y-3">
            {[
              { titulo: 'Res. 948/2026',  desc: 'RIPS JSON — CUCON obligatorio' },
              { titulo: 'SS-CUFE',        desc: 'Factus API activo' },
              { titulo: 'MUV MinSalud',   desc: 'Validación CUV habilitada' },
            ].map((item) => (
              <div key={item.titulo} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium">{item.titulo}</p>
                  <p className="text-xs text-halu-300">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
            <p className="text-xs text-halu-300">Actualizado: junio 2026</p>
            <Link href="/reportes" className="text-xs text-teal-300 hover:text-teal-200 flex items-center gap-1 transition-colors">
              Ver reportes <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Botón flotante nueva cita (móvil) */}
      {p.puede_gestionar_citas && (
        <Link href="/citas/nueva"
          className="fixed bottom-6 right-6 lg:hidden w-14 h-14 bg-halu-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-halu-700 transition-all active:scale-95 z-50">
          <Plus className="w-6 h-6" />
        </Link>
      )}
    </div>
  )
}
