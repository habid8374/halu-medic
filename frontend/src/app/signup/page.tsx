'use client'
import { useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import {
  Building2, User, Mail, Phone, MapPin, Globe, Lock,
  Eye, EyeOff, CheckCircle2, ChevronRight, ChevronLeft,
  Stethoscope, Zap, ShieldCheck, Users,
} from 'lucide-react'

const PLANES = [
  {
    id: 'basico',
    nombre: 'Básico',
    precio: 'Desde $99.000/mes',
    descripcion: '1 médico · 100 facturas/mes',
    features: ['Historia clínica', 'Facturación electrónica', 'RIPS automático', 'Agenda básica'],
    color: 'border-slate-200 hover:border-halu-400',
    badge: '',
  },
  {
    id: 'pro',
    nombre: 'Pro',
    precio: 'Desde $249.000/mes',
    descripcion: 'Hasta 5 médicos · Facturas ilimitadas',
    features: ['Todo lo del Básico', 'Múltiples médicos', 'PGP / Capitado', 'Reportes avanzados'],
    color: 'border-halu-400 ring-2 ring-halu-200',
    badge: 'Más popular',
  },
  {
    id: 'clinica',
    nombre: 'Clínica',
    precio: 'Desde $499.000/mes',
    descripcion: 'Médicos ilimitados · API incluida',
    features: ['Todo lo del Pro', 'Médicos ilimitados', 'API REST', 'Soporte prioritario'],
    color: 'border-slate-200 hover:border-teal-400',
    badge: '',
  },
]

const STEPS = ['Plan', 'Consultorio', 'Administrador', 'Listo']

interface Form {
  plan: string
  nombre: string; nit: string; razon_social: string
  telefono: string; email: string; municipio_codigo: string; slug: string
  admin_nombre: string; admin_apellido: string; admin_cedula: string
  admin_username: string; admin_email: string; admin_password: string
}

export default function SignupPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [resultado, setResultado] = useState<{ subdominio: string; prueba_hasta: string } | null>(null)
  const [form, setForm] = useState<Form>({
    plan: 'pro',
    nombre: '', nit: '', razon_social: '', telefono: '', email: '',
    municipio_codigo: '11001', slug: '',
    admin_nombre: '', admin_apellido: '', admin_cedula: '',
    admin_username: '', admin_email: '', admin_password: '',
  })
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // Auto-generar slug desde nombre del consultorio
  const autoSlug = (nombre: string) =>
    nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)

  const onNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nombre = e.target.value
    setForm(f => ({
      ...f, nombre,
      slug: f.slug || autoSlug(nombre),
      admin_username: f.admin_username || autoSlug(nombre).replace(/-/g, '.'),
    }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/signup/', form)
      setResultado({ subdominio: data.subdominio, prueba_hasta: data.prueba_hasta })
      setStep(3)
    } catch (err: any) {
      const errors = err?.response?.data
      if (typeof errors === 'object') {
        const msgs = Object.entries(errors).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join(' | ')
        toast.error(msgs)
      } else {
        toast.error('Error al crear el consultorio')
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-halu-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <Link href="/login" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-xl font-extrabold" style={{ fontFamily: "'Nunito', sans-serif" }}>
            <span style={{ color: '#1a3a6b' }}>Halu</span><span style={{ color: '#00b5b5' }}>Medic</span>
          </span>
        </Link>
        <Link href="/login" className="text-sm text-slate-500 hover:text-slate-800">
          ¿Ya tienes cuenta? <span className="text-halu-600 font-medium">Ingresar</span>
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-8">
        <div className="w-full max-w-3xl">

          {/* Stepper */}
          {step < 3 && (
            <div className="flex items-center justify-center gap-2 mb-8">
              {STEPS.slice(0, 3).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    i === step ? 'bg-halu-600 text-white' :
                    i < step  ? 'bg-halu-100 text-halu-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
                    {s}
                  </div>
                  {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                </div>
              ))}
            </div>
          )}

          {/* ── PASO 0: Elegir plan ── */}
          {step === 0 && (
            <div>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Elige tu plan</h1>
                <p className="text-slate-500 mt-1">14 días de prueba gratuita · Sin tarjeta de crédito</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {PLANES.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => setForm(f => ({ ...f, plan: p.id }))}
                    className={`relative text-left p-5 rounded-2xl border-2 transition-all ${p.color} ${
                      form.plan === p.id ? 'bg-halu-50' : 'bg-white'
                    }`}>
                    {p.badge && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-halu-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                        {p.badge}
                      </span>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-900 text-base">{p.nombre}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{p.descripcion}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                        form.plan === p.id ? 'border-halu-600 bg-halu-600' : 'border-slate-300'
                      }`}>
                        {form.plan === p.id && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-halu-700 mb-3">{p.precio}</p>
                    <ul className="space-y-1.5">
                      {p.features.map(f => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-6 py-3 bg-halu-600 text-white font-semibold rounded-xl hover:bg-halu-700 transition-all">
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── PASO 1: Datos del consultorio ── */}
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-halu-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-halu-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Datos del consultorio</h2>
                  <p className="text-xs text-slate-500">Información de tu IPS o consultorio médico</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { k: 'nombre' as const, label: 'Nombre del consultorio *', placeholder: 'Consultorio Médico XYZ', icon: Building2, onChange: onNombreChange },
                  { k: 'nit' as const, label: 'NIT *', placeholder: '900.123.456-1', icon: ShieldCheck },
                  { k: 'razon_social' as const, label: 'Razón social', placeholder: 'Igual al nombre si no aplica', icon: Building2 },
                  { k: 'email' as const, label: 'Email del consultorio *', placeholder: 'info@consultorio.com', icon: Mail },
                  { k: 'telefono' as const, label: 'Teléfono', placeholder: '601 234 5678', icon: Phone },
                  { k: 'municipio_codigo' as const, label: 'Código DANE municipio', placeholder: '11001 = Bogotá', icon: MapPin },
                ].map(f => (
                  <div key={f.k}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                    <div className="relative">
                      <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" value={form[f.k]} onChange={f.onChange ?? set(f.k)}
                        placeholder={f.placeholder}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm
                          focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400 bg-slate-50" />
                    </div>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Subdominio * <span className="normal-case font-normal text-slate-400">— dirección de acceso al sistema</span>
                  </label>
                  <div className="flex items-center gap-0">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" value={form.slug}
                        onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                        placeholder="mi-consultorio"
                        className="w-full pl-10 pr-4 py-2.5 rounded-l-xl border border-r-0 border-slate-200 text-sm
                          focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400 bg-slate-50" />
                    </div>
                    <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-r-xl text-sm text-slate-500 whitespace-nowrap">
                      .halumedic.co
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(0)} className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-900 text-sm">
                  <ChevronLeft className="w-4 h-4" /> Atrás
                </button>
                <button onClick={() => {
                  if (!form.nombre || !form.nit || !form.email || !form.slug) {
                    toast.error('Completa los campos obligatorios'); return
                  }
                  setStep(2)
                }} className="flex items-center gap-2 px-6 py-2.5 bg-halu-600 text-white font-semibold rounded-xl hover:bg-halu-700">
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── PASO 2: Datos del administrador ── */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Administrador del consultorio</h2>
                  <p className="text-xs text-slate-500">Esta persona tendrá acceso total al sistema</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { k: 'admin_nombre' as const, label: 'Nombre *', placeholder: 'Juan', icon: User },
                  { k: 'admin_apellido' as const, label: 'Apellido', placeholder: 'Pérez', icon: User },
                  { k: 'admin_cedula' as const, label: 'Cédula *', placeholder: '1234567890', icon: ShieldCheck },
                  { k: 'admin_email' as const, label: 'Email *', placeholder: 'admin@consultorio.com', icon: Mail },
                  { k: 'admin_username' as const, label: 'Usuario *', placeholder: 'juan.perez', icon: User },
                ].map(f => (
                  <div key={f.k}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                    <div className="relative">
                      <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" value={form[f.k]} onChange={set(f.k)} placeholder={f.placeholder}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm
                          focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400 bg-slate-50" />
                    </div>
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Contraseña *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type={showPass ? 'text' : 'password'} value={form.admin_password} onChange={set('admin_password')}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm
                        focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400 bg-slate-50" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              {/* Resumen */}
              <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                <p className="font-semibold text-slate-700 mb-2">Resumen del registro</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <span>Plan: <strong>{PLANES.find(p => p.id === form.plan)?.nombre}</strong></span>
                  <span>Consultorio: <strong>{form.nombre}</strong></span>
                  <span>NIT: <strong>{form.nit}</strong></span>
                  <span>URL: <strong>{form.slug}.halumedic.co</strong></span>
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-900 text-sm">
                  <ChevronLeft className="w-4 h-4" /> Atrás
                </button>
                <button onClick={() => {
                  if (!form.admin_nombre || !form.admin_cedula || !form.admin_username || !form.admin_email || !form.admin_password) {
                    toast.error('Completa los campos obligatorios'); return
                  }
                  handleSubmit()
                }} disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-halu-600 to-halu-500
                    hover:from-halu-700 hover:to-halu-600 text-white font-semibold rounded-xl transition-all disabled:opacity-60">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando...</>
                    : <><CheckCircle2 className="w-4 h-4" />Crear consultorio</>}
                </button>
              </div>
            </div>
          )}

          {/* ── PASO 3: Éxito ── */}
          {step === 3 && resultado && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Consultorio creado!</h2>
              <p className="text-slate-500 mb-6">
                Tu periodo de prueba gratuita es válido hasta el{' '}
                <strong className="text-slate-800">{new Date(resultado.prueba_hasta).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
              </p>

              <div className="bg-halu-50 border border-halu-200 rounded-xl p-5 mb-6 text-left">
                <p className="text-xs font-semibold text-halu-600 uppercase tracking-wider mb-3">Tu acceso</p>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-halu-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-halu-800">{resultado.subdominio}</p>
                    <p className="text-xs text-halu-600">Ingresa con el usuario y contraseña que registraste</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { icon: Stethoscope, label: 'Historia clínica' },
                  { icon: Zap,         label: 'Facturación DIAN' },
                  { icon: Users,       label: 'Múltiples usuarios' },
                ].map(f => (
                  <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 bg-slate-50 rounded-xl">
                    <f.icon className="w-5 h-5 text-halu-500" />
                    <span className="text-xs text-slate-600 text-center">{f.label}</span>
                  </div>
                ))}
              </div>

              <Link href="/login">
                <button className="w-full py-3 bg-halu-600 hover:bg-halu-700 text-white font-semibold rounded-xl transition-all">
                  Ir al inicio de sesión
                </button>
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
