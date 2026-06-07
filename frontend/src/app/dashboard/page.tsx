'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { dashboardAPI, pacientesAPI, citasAPI, consultasAPI, facturasAPI } from '@/lib/api'
import {
  Users, CalendarDays, Receipt, ClipboardList,
  CheckCircle, AlertCircle, Clock, Stethoscope,
  FileText, Activity, TrendingUp, ArrowRight,
  UserPlus, Plus, BookOpen, FileSpreadsheet,
  BedDouble, UserCheck, AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'

const horaCol = () => new Date().toLocaleTimeString('es-CO', {
  timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
})

const saludar = (nombre: string) => {
  const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })).getHours()
  const s = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches'
  return `${s}, ${nombre.split(' ')[0]}`
}

const fechaHoy = () => new Date().toLocaleDateString('es-CO', {
  timeZone: 'America/Bogota', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})

interface DashStats {
  ingresos_activos: number
  citas_hoy: number
  nuevos_pacientes_hoy: number
  consultas_hoy: number
  ingresos_mes: number
  nuevos_pacientes_mes: number
  prefacturas_pendientes: number
  prefacturas_aprobadas: number
  total_pacientes: number
}

interface IngresoActivo {
  id: string
  paciente_nombre?: string
  paciente?: { nombre_completo?: string }
  servicio?: string
  fecha_ingreso: string
}

function SkeletonNum() {
  return <div className="h-9 bg-slate-100 animate-pulse rounded-lg w-16 mb-1" />
}

function KpiCard({
  label, value, icon: Icon, iconColor, iconBg, loading, alert,
}: {
  label: string
  value: number
  icon: React.ElementType
  iconColor: string
  iconBg: string
  loading: boolean
  alert?: boolean
}) {
  return (
    <div className={clsx(
      'bg-white rounded-2xl p-5 border transition-all hover:shadow-md',
      alert && value > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100',
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
          <Icon className={clsx('w-5 h-5', iconColor)} />
        </div>
        {alert && value > 0 && (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        )}
      </div>
      {loading ? <SkeletonNum /> : (
        <p className="text-3xl font-bold text-slate-900 mb-0.5">{value}</p>
      )}
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { usuario } = useAuth()
  const [stats, setStats] = useState<DashStats | null>(null)
  const [factEstados, setFactEstados] = useState({ validadas: 0, enviadas: 0, error: 0 })
  const [ingresos, setIngresos] = useState<IngresoActivo[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingIngresos, setLoadingIngresos] = useState(true)

  const hoyISO = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    const cargar = async () => {
      // Load real dashboard stats
      const [dashRes, factsRes] = await Promise.allSettled([
        dashboardAPI.stats(),
        facturasAPI.list({ page_size: 100 }),
      ])

      if (dashRes.status === 'fulfilled') {
        setStats(dashRes.value.data)
      }

      let validadas = 0, enviadas = 0, error = 0
      if (factsRes.status === 'fulfilled') {
        factsRes.value.data.results?.forEach((f: any) => {
          if (f.estado === 'validada') validadas++
          else if (f.estado === 'enviada') enviadas++
          else if (f.estado === 'error') error++
        })
      }
      setFactEstados({ validadas, enviadas, error })
      setLoadingStats(false)
    }
    cargar()
  }, [hoyISO])

  useEffect(() => {
    dashboardAPI.ingresosActivos()
      .then(r => setIngresos(r.data.results ?? []))
      .catch(() => {})
      .finally(() => setLoadingIngresos(false))
  }, [])

  const [hora, setHora] = useState(horaCol())
  useEffect(() => {
    const t = setInterval(() => setHora(horaCol()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!usuario) return null

  const p = usuario.permisos
  const s = stats

  const diasHospitalizados = (fechaIngreso: string) => {
    const diff = Date.now() - new Date(fechaIngreso).getTime()
    return Math.floor(diff / 86_400_000)
  }

  const accesos = [
    { label: 'Nuevo paciente',   href: '/pacientes/nuevo',                  icon: UserPlus,        color: 'bg-halu-600',    visible: p.puede_gestionar_citas },
    { label: 'Nueva cita',       href: '/citas/nueva',                      icon: CalendarDays,    color: 'bg-teal-600',    visible: p.puede_gestionar_citas },
    { label: 'Nueva consulta',   href: '/consultas/nueva',                  icon: Stethoscope,     color: 'bg-violet-600',  visible: p.puede_editar_clinica },
    { label: 'Nueva factura',    href: '/facturacion/nueva',                icon: Receipt,         color: 'bg-emerald-600', visible: p.puede_facturar },
    { label: 'Factura PGP',      href: '/facturacion/pgp/nueva',           icon: FileSpreadsheet, color: 'bg-cyan-600',    visible: p.puede_facturar },
    { label: 'Nuevo ingreso',    href: '/historia-clinica/ingresos/nuevo', icon: BookOpen,        color: 'bg-purple-600',  visible: p.puede_ver_clinica },
    { label: 'Ver reportes',     href: '/reportes',                         icon: TrendingUp,      color: 'bg-slate-600',   visible: p.puede_facturar },
    { label: 'Configuración',    href: '/configuracion',                    icon: FileText,        color: 'bg-orange-500',  visible: p.es_admin },
  ].filter(a => a.visible)

  return (
    <div className="page-padding animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{saludar(usuario.nombre)}</h1>
          <p className="text-slate-500 text-sm mt-0.5 capitalize">{fechaHoy()}</p>
          <p className="text-slate-400 text-xs mt-0.5 font-mono">{hora} · Colombia</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-100">
          <Activity className="w-3.5 h-3.5" />
          Sistema operativo
        </div>
      </div>

      {/* Row 1 — KPIs del día */}
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Hoy</p>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Ingresos activos"      value={s?.ingresos_activos ?? 0}    icon={BedDouble}    iconColor="text-blue-600"   iconBg="bg-blue-50"   loading={loadingStats} />
        <KpiCard label="Citas hoy"             value={s?.citas_hoy ?? 0}           icon={CalendarDays} iconColor="text-teal-600"   iconBg="bg-teal-50"   loading={loadingStats} />
        <KpiCard label="Consultas hoy"         value={s?.consultas_hoy ?? 0}       icon={Stethoscope}  iconColor="text-violet-600" iconBg="bg-violet-50" loading={loadingStats} />
        <KpiCard label="Nuevos pacientes hoy"  value={s?.nuevos_pacientes_hoy ?? 0} icon={UserPlus}    iconColor="text-amber-600"  iconBg="bg-amber-50"  loading={loadingStats} />
      </div>

      {/* Row 2 — KPIs del mes */}
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Este mes</p>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Ingresos del mes"       value={s?.ingresos_mes ?? 0}            icon={BedDouble}    iconColor="text-blue-600"    iconBg="bg-blue-50"    loading={loadingStats} />
        <KpiCard label="Pacientes nuevos mes"   value={s?.nuevos_pacientes_mes ?? 0}    icon={UserCheck}    iconColor="text-halu-600"    iconBg="bg-halu-50"    loading={loadingStats} />
        <KpiCard label="Prefacturas pendientes" value={s?.prefacturas_pendientes ?? 0}  icon={AlertCircle}  iconColor="text-amber-600"   iconBg="bg-amber-50"   loading={loadingStats} alert />
        <KpiCard label="Prefacturas aprobadas"  value={s?.prefacturas_aprobadas ?? 0}   icon={CheckCircle}  iconColor="text-emerald-600" iconBg="bg-emerald-50" loading={loadingStats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        {/* Actividad reciente — ingresos activos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-blue-600" />
              Ingresos activos recientes
            </span>
            <Link href="/historia-clinica/ingresos" className="text-xs text-halu-600 hover:underline flex items-center gap-1">
              Ver todo <ArrowRight className="w-3 h-3" />
            </Link>
          </h3>
          {loadingIngresos ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : ingresos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Sin ingresos activos</p>
          ) : (
            <div className="space-y-2">
              {ingresos.map((ing) => {
                const nombre = ing.paciente_nombre ?? ing.paciente?.nombre_completo ?? 'Paciente'
                const dias = diasHospitalizados(ing.fecha_ingreso)
                return (
                  <div key={ing.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <BedDouble className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{nombre}</p>
                        {ing.servicio && (
                          <p className="text-xs text-slate-500 truncate">{ing.servicio}</p>
                        )}
                      </div>
                    </div>
                    <span className={clsx(
                      'text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2',
                      dias >= 7 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700',
                    )}>
                      {dias}d
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Estado facturación DIAN + Normativa */}
        <div className="space-y-4">
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
            </div>
          )}

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
