'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { usuariosAPI, mensajeError } from '@/lib/api'
import { PageHeader, Badge, Button } from '@/components/ui'
import type { Rol } from '@/types'
import toast from 'react-hot-toast'
import {
  UserPlus, Pencil, Lock, Ban, CheckCircle, AlertCircle,
  User, Mail, Phone, Shield, Eye, EyeOff, RefreshCw, Search,
} from 'lucide-react'
import clsx from 'clsx'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface UsuarioItem {
  id: string
  username: string
  cedula: string
  first_name: string
  last_name: string
  nombre_completo: string
  email: string
  telefono: string
  rol: Rol
  rol_label: string
  activo_tenant: boolean
  date_joined: string
}

// ── Constantes ────────────────────────────────────────────────────────────────

const ROLES: { value: Rol; label: string; desc: string; color: string }[] = [
  { value: 'admin',         label: 'Administrador',  desc: 'Acceso total al consultorio',           color: 'text-violet-700 bg-violet-50 border-violet-200' },
  { value: 'medico',        label: 'Médico',         desc: 'Historia clínica, consultas y agenda',  color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'recepcionista', label: 'Recepcionista',  desc: 'Pacientes y agenda. Sin finanzas',       color: 'text-teal-700 bg-teal-50 border-teal-200' },
  { value: 'facturador',    label: 'Facturador',     desc: 'Facturación y RIPS. Sin clínica',        color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'auditor',       label: 'Auditor',        desc: 'Solo lectura en todo',                  color: 'text-slate-600 bg-slate-50 border-slate-200' },
]

const PERMISOS_POR_ROL: Record<Rol, string[]> = {
  superadmin:    ['Todo'],
  admin:         ['Dashboard', 'Pacientes', 'Agenda', 'Consultas', 'Historia Clínica', 'Facturación', 'RIPS', 'Reportes', 'Configuración'],
  medico:        ['Dashboard', 'Pacientes', 'Agenda', 'Consultas', 'Historia Clínica'],
  recepcionista: ['Dashboard', 'Pacientes', 'Agenda'],
  facturador:    ['Dashboard', 'Pacientes', 'Facturación', 'RIPS'],
  auditor:       ['Dashboard', 'Pacientes (lectura)', 'Consultas (lectura)', 'Historia (lectura)', 'Facturación (lectura)', 'Reportes'],
}

const ROL_BADGE: Record<Rol, string> = {
  superadmin:    'danger',
  admin:         'info',
  medico:        'success',
  recepcionista: 'default',
  facturador:    'warning',
  auditor:       'default',
}

const FORM_VACIO = {
  first_name: '', last_name: '', username: '', cedula: '',
  email: '', telefono: '', rol: 'medico' as Rol,
  password: '', password2: '',
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { usuario: yo } = useAuth()
  const [usuarios, setUsuarios]     = useState<UsuarioItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [buscar, setBuscar]         = useState('')
  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState<UsuarioItem | null>(null)
  const [modalPass, setModalPass]   = useState<UsuarioItem | null>(null)
  const [guardando, setGuardando]   = useState(false)
  const [form, setForm]             = useState({ ...FORM_VACIO })
  const [showPass, setShowPass]     = useState(false)
  const [passForm, setPassForm]     = useState({ nuevo: '', nuevo2: '' })
  const [verPermisos, setVerPermisos] = useState<Rol | null>(null)

  const esAdmin = yo?.permisos.es_admin

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await usuariosAPI.list()
      setUsuarios(data.results ?? data)
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setLoading(false) }
  }

  const filtrados = usuarios.filter(u => {
    if (!buscar) return true
    const q = buscar.toLowerCase()
    return (
      u.nombre_completo.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.cedula.includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  })

  // ── Crear ──────────────────────────────────────────────────────────────────

  const crear = async () => {
    if (!form.first_name || !form.username || !form.cedula || !form.password) {
      toast.error('Nombre, usuario, cédula y contraseña son obligatorios')
      return
    }
    if (form.password !== form.password2) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setGuardando(true)
    try {
      await usuariosAPI.create(form as unknown as Record<string, unknown>)
      toast.success('Usuario creado exitosamente')
      setModalCrear(false)
      setForm({ ...FORM_VACIO })
      cargar()
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setGuardando(false) }
  }

  // ── Editar ─────────────────────────────────────────────────────────────────

  const abrirEditar = (u: UsuarioItem) => {
    setForm({
      first_name: u.first_name, last_name: u.last_name,
      username: u.username, cedula: u.cedula,
      email: u.email, telefono: u.telefono,
      rol: u.rol, password: '', password2: '',
    })
    setModalEditar(u)
  }

  const editar = async () => {
    if (!modalEditar) return
    setGuardando(true)
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name, last_name: form.last_name,
        email: form.email, telefono: form.telefono, rol: form.rol,
      }
      await usuariosAPI.update(modalEditar.id, payload)
      toast.success('Usuario actualizado')
      setModalEditar(null)
      cargar()
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setGuardando(false) }
  }

  // ── Cambiar contraseña ─────────────────────────────────────────────────────

  const cambiarPassword = async () => {
    if (!modalPass) return
    if (!passForm.nuevo || passForm.nuevo.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (passForm.nuevo !== passForm.nuevo2) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setGuardando(true)
    try {
      await usuariosAPI.cambiarPassword(modalPass.id, {
        password_actual: '',
        password_nuevo: passForm.nuevo,
        password_nuevo2: passForm.nuevo2,
      })
      toast.success('Contraseña actualizada')
      setModalPass(null)
      setPassForm({ nuevo: '', nuevo2: '' })
    } catch (err) { toast.error(mensajeError(err)) }
    finally { setGuardando(false) }
  }

  // ── Activar / Desactivar ───────────────────────────────────────────────────

  const toggleActivo = async (u: UsuarioItem) => {
    try {
      if (u.activo_tenant) {
        await usuariosAPI.desactivar(u.id)
        toast.success(`${u.nombre_completo} desactivado`)
      } else {
        await usuariosAPI.activar(u.id)
        toast.success(`${u.nombre_completo} activado`)
      }
      cargar()
    } catch (err) { toast.error(mensajeError(err)) }
  }

  if (!esAdmin) return (
    <div className="page-padding flex flex-col items-center justify-center min-h-[400px]">
      <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
      <p className="text-slate-600 font-medium">Solo administradores pueden gestionar usuarios.</p>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-padding animate-fade-in">
      <PageHeader
        title="Usuarios"
        description="Gestión de accesos y permisos del consultorio"
        action={
          <div className="flex gap-2">
            <Button onClick={() => { setForm({ ...FORM_VACIO }); setModalCrear(true) }}>
              <UserPlus className="w-4 h-4" />Nuevo usuario
            </Button>
            <Button variant="secondary" onClick={cargar}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* Buscador */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar por nombre, usuario o cédula…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30 bg-white"
        />
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />)}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-12 text-center">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No hay usuarios{buscar ? ' que coincidan' : ' en este consultorio aún'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Usuario</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Contacto</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Rol / Permisos</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtrados.map(u => (
                  <tr key={u.id} className={clsx('hover:bg-slate-50/60 transition-colors', !u.activo_tenant && 'opacity-50')}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-halu-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-halu-700 font-bold text-sm">
                            {u.first_name?.[0]?.toUpperCase()}{u.last_name?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{u.nombre_completo}</p>
                          <p className="text-xs text-slate-400">@{u.username} · C.C. {u.cedula}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="space-y-0.5">
                        {u.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</p>}
                        {u.telefono && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{u.telefono}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={ROL_BADGE[u.rol] as any}>{u.rol_label}</Badge>
                        <button
                          onClick={() => setVerPermisos(verPermisos === u.rol ? null : u.rol)}
                          className="text-xs text-halu-600 hover:underline flex items-center gap-0.5"
                        >
                          <Eye className="w-3 h-3" />
                          {verPermisos === u.rol ? 'Ocultar' : 'Ver accesos'}
                        </button>
                      </div>
                      {verPermisos === u.rol && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(PERMISOS_POR_ROL[u.rol] ?? []).map(p => (
                            <span key={p} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {u.activo_tenant
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium"><CheckCircle className="w-3 h-3" />Activo</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-medium"><Ban className="w-3 h-3" />Inactivo</span>
                      }
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => abrirEditar(u)} title="Editar"
                          className="p-2 rounded-lg text-slate-400 hover:text-halu-600 hover:bg-halu-50 transition-all">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setModalPass(u)} title="Cambiar contraseña"
                          className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all">
                          <Lock className="w-4 h-4" />
                        </button>
                        {u.id !== yo?.id && (
                          <button onClick={() => toggleActivo(u)} title={u.activo_tenant ? 'Desactivar' : 'Activar'}
                            className={clsx('p-2 rounded-lg transition-all',
                              u.activo_tenant
                                ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            )}>
                            {u.activo_tenant ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel de roles */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-halu-600" />
          Roles disponibles y sus accesos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map(r => (
            <div key={r.value} className={clsx('rounded-xl border p-4', r.color)}>
              <p className="font-semibold text-sm">{r.label}</p>
              <p className="text-xs mt-1 opacity-80">{r.desc}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {(PERMISOS_POR_ROL[r.value] ?? []).map(p => (
                  <span key={p} className="text-xs bg-white/60 px-2 py-0.5 rounded-full">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal Crear / Editar ─────────────────────────────────────────────── */}
      {(modalCrear || modalEditar) && (
        <ModalUsuario
          titulo={modalCrear ? 'Nuevo usuario' : 'Editar usuario'}
          form={form}
          setForm={setForm}
          showPass={showPass}
          setShowPass={setShowPass}
          esNuevo={!!modalCrear}
          guardando={guardando}
          onGuardar={modalCrear ? crear : editar}
          onCerrar={() => { setModalCrear(false); setModalEditar(null) }}
        />
      )}

      {/* ── Modal Cambiar Contraseña ─────────────────────────────────────────── */}
      {modalPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Cambiar contraseña</h3>
                <p className="text-sm text-slate-500 mt-0.5">{modalPass.nombre_completo}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <CampoPass label="Nueva contraseña *" value={passForm.nuevo} onChange={v => setPassForm(p => ({ ...p, nuevo: v }))} />
              <CampoPass label="Confirmar contraseña *" value={passForm.nuevo2} onChange={v => setPassForm(p => ({ ...p, nuevo2: v }))} />
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <Button variant="secondary" onClick={() => setModalPass(null)}>Cancelar</Button>
              <Button onClick={cambiarPassword} loading={guardando}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function CampoPass({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

function ModalUsuario({
  titulo, form, setForm, showPass, setShowPass, esNuevo, guardando, onGuardar, onCerrar
}: {
  titulo: string
  form: typeof FORM_VACIO
  setForm: React.Dispatch<React.SetStateAction<typeof FORM_VACIO>>
  showPass: boolean
  setShowPass: (v: boolean) => void
  esNuevo: boolean
  guardando: boolean
  onGuardar: () => void
  onCerrar: () => void
}) {
  const set = (k: keyof typeof FORM_VACIO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{titulo}</h3>
        </div>
        <div className="p-6 space-y-4">

          {/* Nombre y apellido */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
              <input value={form.first_name} onChange={set('first_name')} autoFocus
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Apellido</label>
              <input value={form.last_name} onChange={set('last_name')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
            </div>
          </div>

          {/* Cédula y usuario */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cédula *</label>
              <input value={form.cedula} onChange={set('cedula')} disabled={!esNuevo}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30 disabled:bg-slate-50 disabled:text-slate-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Usuario *</label>
              <input value={form.username} onChange={set('username')} disabled={!esNuevo}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30 disabled:bg-slate-50 disabled:text-slate-400" />
            </div>
          </div>

          {/* Email y teléfono */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={set('email')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={set('telefono')}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
            </div>
          </div>

          {/* Rol */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rol y accesos *</label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map(r => (
                <label key={r.value}
                  className={clsx(
                    'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    form.rol === r.value
                      ? 'border-halu-400 bg-halu-50 ring-2 ring-halu-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  )}>
                  <input type="radio" name="rol" value={r.value} checked={form.rol === r.value}
                    onChange={set('rol')} className="mt-0.5 accent-halu-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{r.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(PERMISOS_POR_ROL[r.value] ?? []).map(p => (
                        <span key={p} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p}</span>
                      ))}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Contraseña solo al crear */}
          {esNuevo && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contraseña *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={set('password')}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Confirmar *</label>
                <input type={showPass ? 'text' : 'password'} value={form.password2}
                  onChange={set('password2')}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-halu-500/30" />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <Button variant="secondary" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={onGuardar} loading={guardando}>
            {esNuevo ? <><UserPlus className="w-4 h-4" />Crear usuario</> : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  )
}
