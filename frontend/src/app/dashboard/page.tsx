'use client'
import { useAuth } from '@/lib/auth-context'
import {
  Users, CalendarDays, Receipt, ClipboardList,
  TrendingUp, CheckCircle, AlertCircle, Clock,
  Stethoscope, FileText, Activity,
} from 'lucide-react'
import clsx from 'clsx'

const bienvenida = (nombre: string) => {
  const h = new Date().getHours()
  const saludo = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches'
  return `${saludo}, ${nombre.split(' ')[0]}`
}

const fecha = () => new Date().toLocaleDateString('es-CO', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
})

// Cards de métricas — en producción se cargan desde la API
const metricas = [
  { label: 'Pacientes activos', valor: '—', icono: Users,         color: 'text-halu-600',   bg: 'bg-halu-50',   requiere: null },
  { label: 'Citas hoy',         valor: '—', icono: CalendarDays,  color: 'text-teal-600',   bg: 'bg-teal-50',   requiere: 'puede_gestionar_citas' },
  { label: 'Consultas abiertas',valor: '—', icono: ClipboardList, color: 'text-amber-600',  bg: 'bg-amber-50',  requiere: 'puede_ver_clinica' },
  { label: 'Facturas pendientes',valor: '—', icono: Receipt,      color: 'text-emerald-600',bg: 'bg-emerald-50',requiere: 'puede_facturar' },
]

const estadoFacturas = [
  { label: 'Validadas DIAN', count: '—', icon: CheckCircle, color: 'text-emerald-600' },
  { label: 'En proceso',     count: '—', icon: Clock,       color: 'text-amber-600' },
  { label: 'Con errores',    count: '—', icon: AlertCircle, color: 'text-red-500' },
]

const accesosRapidos = [
  { label: 'Nueva cita',      href: '/citas/nueva',       icono: CalendarDays,  color: 'bg-halu-600',   requiere: 'puede_gestionar_citas' },
  { label: 'Nueva consulta',  href: '/consultas/nueva',   icono: Stethoscope,   color: 'bg-teal-600',   requiere: 'puede_editar_clinica' },
  { label: 'Nueva factura',   href: '/facturacion/nueva', icono: Receipt,       color: 'bg-emerald-600',requiere: 'puede_facturar' },
  { label: 'Ver RIPS',        href: '/rips',               icono: FileText,      color: 'bg-slate-600',  requiere: 'puede_facturar' },
]

export default function DashboardPage() {
  const { usuario } = useAuth()
  if (!usuario) return null

  const metricasFiltradas = metricas.filter(m =>
    !m.requiere || usuario.permisos[m.requiere as keyof typeof usuario.permisos]
  )
  const accesosFiltrados = accesosRapidos.filter(a =>
    !a.requiere || usuario.permisos[a.requiere as keyof typeof usuario.permisos]
  )

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{bienvenida(usuario.nombre)}</h1>
          <p className="text-slate-500 text-sm mt-1 capitalize">{fecha()}</p>
        </div>
        <div className="flex items-center gap-2 bg-teal-50 text-teal-700 text-xs font-medium px-3 py-1.5 rounded-full border border-teal-100">
          <Activity className="w-3.5 h-3.5" />
          Sistema operativo
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {metricasFiltradas.map((m) => (
          <div key={m.label} className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-slate-200 transition-all hover:shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', m.bg)}>
                <m.icono className={clsx('w-5 h-5', m.color)} />
              </div>
              <TrendingUp className="w-4 h-4 text-slate-300" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{m.valor}</p>
            <p className="text-sm text-slate-500 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Estado facturación */}
        {usuario.permisos.puede_facturar && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <h3 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-halu-600" />
              Facturación DIAN
            </h3>
            <div className="space-y-3">
              {estadoFacturas.map((e) => (
                <div key={e.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <e.icon className={clsx('w-4 h-4', e.color)} />
                    <span className="text-sm text-slate-700">{e.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{e.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-halu-50 rounded-xl">
              <p className="text-xs text-halu-700 font-medium">SS-CUFE · SS-SinAporte · Res. 948/2026</p>
              <p className="text-xs text-halu-500 mt-0.5">Facturación sector salud habilitada</p>
            </div>
          </div>
        )}

        {/* Accesos rápidos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm mb-4">Accesos rápidos</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {accesosFiltrados.map((a) => (
              <a
                key={a.label}
                href={a.href}
                className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all group"
              >
                <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', a.color)}>
                  <a.icono className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-slate-600 text-center font-medium leading-tight">{a.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Info normativa */}
        <div className="bg-gradient-to-br from-halu-900 to-halu-700 rounded-2xl p-5 text-white">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-300" />
            Normativa vigente
          </h3>
          <div className="space-y-2.5">
            {[
              { titulo: 'Res. 948/2026', desc: 'RIPS JSON — CUCON obligatorio', ok: true },
              { titulo: 'SS-CUFE',       desc: 'Factus API activado', ok: true },
              { titulo: 'MUV MinSalud',  desc: 'Validación CUV activa', ok: true },
            ].map((item) => (
              <div key={item.titulo} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-white">{item.titulo}</p>
                  <p className="text-xs text-halu-300">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-xs text-halu-300">Actualizado: junio 2026</p>
          </div>
        </div>
      </div>
    </div>
  )
}
