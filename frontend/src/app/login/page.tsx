'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const router    = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Ingresa usuario y contraseña')
      return
    }
    setLoading(true)
    try {
      await login(username, password)
      toast.success('Bienvenido a Halu Medic')
      router.replace('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast.error(msg || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-halu-900 via-halu-800 to-halu-700 flex-col justify-between p-12 relative overflow-hidden">
        {/* Círculos decorativos */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-teal-500/10" />
        <div className="absolute bottom-12 left-1/4 w-48 h-48 rounded-full bg-halu-600/30" />

        {/* Logo */}
        <div className="relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Halu Medic" width={160} height={45} className="object-contain brightness-0 invert opacity-90" />
        </div>

        {/* Contenido central */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 text-sm font-medium px-3 py-1.5 rounded-full border border-teal-400/20">
              <div className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
              Sector salud · Facturación DIAN
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Gestión clínica y<br />
              <span className="text-teal-300">facturación electrónica</span><br />
              para especialistas
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed max-w-md">
              Emite facturas SS-CUFE y SS-SinAporte, genera RIPS automático
              conforme a Resolución 948/2026, y administra tu consultorio desde un solo lugar.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Módulos clínicos', value: '6' },
              { label: 'Res. 948/2026', value: '✓' },
              { label: 'DIAN + RIPS', value: '✓' },
            ].map((s) => (
              <div key={s.label} className="bg-white/8 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-slate-500 text-sm">
            © 2026 Axentia Technologies S.A.S. · Halu Group
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-20 bg-white">
        {/* Logo mobile */}
        <div className="lg:hidden flex items-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Halu Medic" width={130} height={38} className="object-contain" />
        </div>

        <div className="w-full max-w-sm mx-auto animate-slide-up">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
            <p className="text-slate-500 mt-1 text-sm">Accede a tu consultorio</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Usuario */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="tu.usuario"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400
                    bg-slate-50 placeholder:text-slate-400 transition-all"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400
                    bg-slate-50 placeholder:text-slate-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-halu-600 hover:bg-halu-700 disabled:bg-halu-400
                text-white font-medium rounded-xl text-sm transition-all
                focus:outline-none focus:ring-2 focus:ring-halu-500/30
                flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </>
              ) : 'Ingresar'}
            </button>
          </form>

          {/* Info roles */}
          <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Roles disponibles</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { rol: 'Superadmin', color: 'bg-purple-100 text-purple-700' },
                { rol: 'Administrador', color: 'bg-halu-100 text-halu-700' },
                { rol: 'Médico', color: 'bg-teal-100 text-teal-700' },
                { rol: 'Recepcionista', color: 'bg-amber-100 text-amber-700' },
                { rol: 'Facturador', color: 'bg-emerald-100 text-emerald-700' },
                { rol: 'Auditor', color: 'bg-slate-100 text-slate-600' },
              ].map((r) => (
                <span key={r.rol} className={`text-xs px-2 py-1 rounded-lg font-medium ${r.color}`}>
                  {r.rol}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
