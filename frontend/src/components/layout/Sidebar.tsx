'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { consultorioAPI } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, CalendarDays,
  ClipboardList, Receipt, BarChart3, Settings,
  LogOut, ChevronRight, ChevronDown, Building2, ShieldCheck,
  FileJson, ListTree, BookOpen, Stethoscope, FileSpreadsheet,
  Menu, X, UserCog, HeartPulse, BedDouble, Microscope, Scissors,
  Pill, FlaskConical, UserCheck, Wrench, Activity, Calculator,
} from 'lucide-react'
import clsx from 'clsx'
import NotificacionesBell from './NotificacionesBell'

interface SubItem {
  href: string
  label: string
}

interface NavItem {
  href?: string
  label: string
  icon: React.ElementType
  requiere?: string
  soloSuperadmin?: boolean
  children?: SubItem[]
}

const navItems: NavItem[] = [
  { href: '/dashboard',      label: 'Inicio',          icon: LayoutDashboard },
  { href: '/pacientes',      label: 'Pacientes',        icon: Users },
  { href: '/citas',          label: 'Agenda',           icon: CalendarDays,   requiere: 'puede_gestionar_citas' },
  {
    label: 'Salud',
    icon: HeartPulse,
    requiere: 'puede_ver_clinica',
    children: [
      { href: '/consultas',      label: 'Consultas' },
      { href: '/historia-clinica', label: 'Historia Clínica' },
      { href: '/salud/triage',     label: 'Triage / Urgencias' },
      { href: '/salud/censo',      label: 'Censo de pacientes' },
      { href: '/salud/cx',         label: 'Programación CX' },
      { href: '/salud/ayudas',     label: 'Ayudas diagnósticas' },
      { href: '/salud/enfermeria', label: 'Enfermería' },
      { href: '/salud/consentimientos', label: 'Consentimientos' },
      { href: '/salud/referencias', label: 'Referencia / Contrarreferencia' },
      { href: '/salud/rehabilitacion', label: 'Rehabilitación' },
      { href: '/salud/odontologia', label: 'Odontología' },
      { href: '/salud/telemedicina', label: 'Telemedicina' },
      { href: '/salud/uci', label: 'UCI / Cuidados intensivos' },
      { href: '/salud/banco-sangre', label: 'Banco de sangre' },
    ],
  },
  { href: '/farmacia',    label: 'Farmacia',     icon: Pill,         requiere: 'puede_ver_clinica' },
  { href: '/laboratorio', label: 'Laboratorio',  icon: FlaskConical, requiere: 'puede_ver_clinica' },
  {
    label: 'RRHH',
    icon: UserCheck,
    requiere: 'es_admin',
    children: [
      { href: '/rrhh',               label: 'Contratos y turnos' },
      { href: '/rrhh/incapacidades', label: 'Incapacidades' },
    ],
  },
  {
    label: 'Operaciones',
    icon: Wrench,
    requiere: 'es_admin',
    children: [
      { href: '/operaciones/esterilizacion', label: 'Esterilización' },
      { href: '/operaciones/mantenimiento',  label: 'Mantenimiento biomédico' },
      { href: '/operaciones/nutricion',      label: 'Nutrición y dietas' },
    ],
  },
  { href: '/epidemiologia', label: 'Epidemiología / SIVIGILA', icon: Activity, requiere: 'es_admin' },
  { href: '/contabilidad',  label: 'Contabilidad',             icon: Calculator, requiere: 'es_admin' },
  {
    label: 'Facturación',
    icon: Receipt,
    requiere: 'puede_facturar',
    children: [
      { href: '/facturacion',     label: 'Por evento (FEV)' },
      { href: '/facturacion/pgp', label: 'PGP / Capitado' },
    ],
  },
  { href: '/rips',           label: 'RIPS',             icon: FileJson,       requiere: 'puede_facturar' },
  { href: '/cups',           label: 'CUPS',             icon: ListTree },
  { href: '/cie10',          label: 'CIE-10',           icon: BookOpen },
  { href: '/reportes',       label: 'Reportes',         icon: BarChart3,      requiere: 'es_admin' },
  { href: '/usuarios',       label: 'Usuarios',         icon: UserCog,        requiere: 'es_admin' },
  { href: '/configuracion',  label: 'Configuración',    icon: Settings,       requiere: 'es_admin' },
  { href: '/superadmin',     label: 'Superadmin',       icon: ShieldCheck,    soloSuperadmin: true },
]

const rolColor: Record<string, string> = {
  superadmin:    'bg-purple-100 text-purple-700',
  admin:         'bg-halu-100 text-halu-700',
  medico:        'bg-teal-100 text-teal-700',
  recepcionista: 'bg-amber-100 text-amber-700',
  facturador:    'bg-emerald-100 text-emerald-700',
  auditor:       'bg-slate-100 text-slate-600',
}

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const pathname = usePathname()
  const router   = useRouter()
  const [open, setOpen] = useState(false)
  const [consultorioNombre, setConsultorioNombre] = useState('')
  const [consultorioDominio, setConsultorioDominio] = useState('')
  const [consultorioLogo, setConsultorioLogo] = useState('')

  useEffect(() => {
    consultorioAPI.get()
      .then(({ data }) => {
        setConsultorioNombre(data.nombre || '')
        setConsultorioDominio(data.dominio || '')
        setConsultorioLogo(data.logo_url || '')
      })
      .catch(() => {/* silencioso */})
  }, [])

  // Submenús abiertos — auto-abre si la ruta activa está dentro
  const isFacturacionActive = pathname.startsWith('/facturacion')
  const isSaludActive = pathname.startsWith('/salud') || pathname.startsWith('/historia-clinica') || pathname.startsWith('/consultas')
  const isRRHHActive = pathname.startsWith('/rrhh')
  const isOperacionesActive = pathname.startsWith('/operaciones')
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Facturación: isFacturacionActive,
    Salud: isSaludActive,
    RRHH: isRRHHActive,
    Operaciones: isOperacionesActive,
  })

  if (!usuario) return null

  const handleLogout = async () => {
    await logout()
    toast.success('Sesión cerrada')
    router.replace('/login')
  }

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const filteredNav = navItems.filter((item) => {
    if (item.soloSuperadmin) return usuario.permisos.es_superadmin
    if (item.requiere) return !!usuario.permisos[item.requiere as keyof typeof usuario.permisos]
    return true
  })

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-blue-800/50 flex-shrink-0">
        <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 flex-1 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-9 w-9 object-contain flex-shrink-0" />
          <span className="text-[1.35rem] font-extrabold tracking-tight leading-none" style={{ fontFamily: "'Nunito', 'Poppins', sans-serif" }}>
            <span style={{ color: '#1a3a6b' }}>Halu</span><span style={{ color: '#00b5b5' }}>Medic</span>
          </span>
        </Link>
        {/* Campana solo en desktop — en móvil está junto al hamburger */}
        <div className="hidden lg:block">
          <NotificacionesBell />
        </div>
      </div>

      {/* Consultorio activo */}
      <div className="mx-3 mt-3 p-3 bg-blue-800/40 rounded-xl border border-blue-700/40 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden shadow border border-white/30">
          {consultorioLogo
            ? <img src={consultorioLogo} alt="" className="w-full h-full object-contain" />
            : <Building2 className="w-4 h-4 text-blue-700" />
          }
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-blue-100 truncate">{consultorioNombre || 'Mi Consultorio'}</p>
          {consultorioDominio && <p className="text-xs text-blue-300">{consultorioDominio}</p>}
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {filteredNav.map((item) => {
          // Item con submenú
          if (item.children) {
            const isOpen = openMenus[item.label]
            const anyChildActive = item.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                    anyChildActive
                      ? 'bg-white/15 text-white'
                      : 'text-blue-200 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <item.icon className={clsx('w-4 h-4 flex-shrink-0 transition-colors',
                    anyChildActive ? 'text-white' : 'text-blue-300 group-hover:text-white'
                  )} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen
                    ? <ChevronDown className="w-3.5 h-3.5 text-blue-300" />
                    : <ChevronRight className="w-3.5 h-3.5 text-blue-300" />
                  }
                </button>
                {isOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-blue-700/50 pl-3">
                    {item.children.map(child => {
                      const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
                            childActive
                              ? 'bg-white/15 text-white font-medium'
                              : 'text-blue-300 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0',
                            childActive ? 'bg-white' : 'bg-blue-500'
                          )} />
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          // Item normal
          const active = pathname === item.href || pathname.startsWith(item.href! + '/')
          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className={clsx('w-4 h-4 flex-shrink-0 transition-colors',
                active ? 'text-white' : 'text-blue-300 group-hover:text-white'
              )} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 text-blue-300" />}
            </Link>
          )
        })}
      </nav>

      {/* Usuario */}
      <div className="p-3 border-t border-blue-800/50 flex-shrink-0">
        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 transition-colors">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-400 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {usuario.nombre.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate leading-none">
              {usuario.nombre}
            </p>
            <span className="text-xs text-blue-300 mt-0.5 inline-block">
              {usuario.rol_label}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 text-blue-300 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Botón hamburguesa — solo móvil */}
      <div className="fixed top-3 left-3 z-50 lg:hidden flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="p-2 bg-white rounded-xl shadow-sm border border-slate-200"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        <NotificacionesBell />
      </div>

      {/* Overlay — solo móvil cuando open */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar móvil — drawer */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-[var(--sidebar-width)] bg-[#0f2d5e] border-r border-blue-900 transition-transform duration-300 lg:hidden',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Sidebar desktop — siempre visible */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[var(--sidebar-width)] bg-[#0f2d5e] border-r border-blue-900 flex-col z-40">
        {sidebarContent}
      </aside>
    </>
  )
}
