'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, CalendarDays,
  ClipboardList, Receipt, BarChart3, Settings,
  LogOut, ChevronRight, ChevronDown, Building2, ShieldCheck,
  FileJson, ListTree, BookOpen, Stethoscope, FileSpreadsheet,
  Menu, X,
} from 'lucide-react'
import clsx from 'clsx'

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
  { href: '/consultas',      label: 'Consultas',        icon: ClipboardList,  requiere: 'puede_ver_clinica' },
  { href: '/historia-clinica', label: 'Historia Clínica', icon: Stethoscope,  requiere: 'puede_ver_clinica' },
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

  // Submenús abiertos — auto-abre si la ruta activa está dentro
  const isFacturacionActive = pathname.startsWith('/facturacion')
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Facturación: isFacturacionActive,
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
      <div className="h-16 flex items-center px-4 border-b border-slate-100 flex-shrink-0">
        <Link href="/dashboard" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Halu Medic"
            className="h-10 w-auto object-contain"
            style={{ mixBlendMode: 'multiply' }}
          />
        </Link>
      </div>

      {/* Consultorio activo */}
      <div className="mx-3 mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-7 h-7 bg-halu-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-3.5 h-3.5 text-halu-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate">Consultorio Demo</p>
          <p className="text-xs text-slate-400">demo.halumedic.co</p>
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
                      ? 'bg-halu-50 text-halu-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <item.icon className={clsx('w-4 h-4 flex-shrink-0 transition-colors',
                    anyChildActive ? 'text-halu-600' : 'text-slate-400 group-hover:text-slate-600'
                  )} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen
                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  }
                </button>
                {isOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-slate-100 pl-3">
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
                              ? 'bg-halu-50 text-halu-700 font-medium'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                          )}
                        >
                          <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0',
                            childActive ? 'bg-halu-500' : 'bg-slate-300'
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
                  ? 'bg-halu-50 text-halu-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <item.icon className={clsx('w-4 h-4 flex-shrink-0 transition-colors',
                active ? 'text-halu-600' : 'text-slate-400 group-hover:text-slate-600'
              )} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 text-halu-400" />}
            </Link>
          )
        })}
      </nav>

      {/* Usuario */}
      <div className="p-3 border-t border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
          <div className="w-8 h-8 bg-gradient-to-br from-halu-500 to-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {usuario.nombre.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate leading-none">
              {usuario.nombre}
            </p>
            <span className={clsx('text-xs px-1.5 py-0.5 rounded-md font-medium mt-1 inline-block',
              rolColor[usuario.rol] || 'bg-slate-100 text-slate-600'
            )}>
              {usuario.rol_label}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 bg-white rounded-xl shadow-sm border border-slate-200"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5 text-slate-700" />
      </button>

      {/* Overlay — solo móvil cuando open */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar móvil — drawer */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-[var(--sidebar-width)] bg-white border-r border-slate-100 transition-transform duration-300 lg:hidden',
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
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[var(--sidebar-width)] bg-white border-r border-slate-100 flex-col z-40">
        {sidebarContent}
      </aside>
    </>
  )
}
