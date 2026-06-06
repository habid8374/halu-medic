'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
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
      // Recarga limpia: garantiza que AuthProvider cargue el usuario desde
      // el token antes de montar el dashboard (evita rebote al login).
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      toast.error(msg || 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex relative">
      {/* Video de fondo — visible en móvil, oculto en desktop (lo maneja el panel izq) */}
      <video
        autoPlay loop muted playsInline
        className="lg:hidden fixed inset-0 w-full h-full object-cover -z-10"
        src="/login-bg.mp4"
      />
      {/* Overlay móvil */}
      <div className="lg:hidden fixed inset-0 bg-halu-900/70 -z-10" />

      {/* Panel izquierdo — video de fondo */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden">
        {/* Video de fondo */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="/login-bg.mp4"
        />
        {/* Overlay degradado para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-br from-halu-900/90 via-halu-800/80 to-teal-900/75" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-10 w-10 object-contain" />
          <span className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Nunito', sans-serif" }}>
            <span style={{ color: '#e0efff' }}>Halu</span><span style={{ color: '#5eead4' }}>Medic</span>
          </span>
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
              <div key={s.label} className="bg-white/10 rounded-xl p-4 border border-white/15 backdrop-blur-sm">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-300 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-slate-400 text-sm">
            © 2026 Axentia Technologies S.A.S. · Halu Group
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-16 lg:px-20 lg:bg-white py-10 lg:py-0">
        {/* Logo mobile — grande y prominente */}
        <div className="lg:hidden flex flex-col items-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-20 w-20 object-contain mb-3 drop-shadow-2xl" />
          <span
            className="text-4xl font-black tracking-tight"
            style={{
              fontFamily: "'Nunito', sans-serif",
              textShadow: '0 2px 20px rgba(0,0,0,0.5)',
            }}
          >
            <span style={{ color: '#ffffff' }}>Halu</span><span style={{ color: '#5eead4' }}>Medic</span>
          </span>
          <p className="text-slate-300 text-sm mt-2 tracking-wide" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
            Gestión clínica y facturación electrónica
          </p>
        </div>

        <div className="w-full max-w-sm mx-auto animate-slide-up
          lg:bg-transparent lg:shadow-none lg:border-0 lg:backdrop-blur-none lg:p-0
          bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-6 lg:p-0">
          <div className="mb-8">
            <h2 className="text-2xl font-bold lg:text-slate-900 text-white">Iniciar sesión</h2>
            <p className="lg:text-slate-500 text-slate-300 mt-1 text-sm">Accede a tu consultorio</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Usuario */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium lg:text-slate-700 text-slate-200">Usuario</label>
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
              <label className="text-sm font-medium lg:text-slate-700 text-slate-200">Contraseña</label>
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
          <div className="mt-8 p-4 lg:bg-slate-50 bg-white/10 rounded-xl lg:border-slate-100 border-white/20 border">
            <p className="text-xs font-medium lg:text-slate-500 text-slate-300 mb-2">Roles disponibles</p>
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
