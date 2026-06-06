'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock, User, Stethoscope, ShieldCheck, Zap } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) { toast.error('Ingresa usuario y contraseña'); return }
    setLoading(true)
    try {
      await login(username, password)
      toast.success('Bienvenido a Halu Medic')
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Credenciales incorrectas')
    } finally { setLoading(false) }
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden">

      {/* ══════════════════════════════════════════════════
          MÓVIL
      ══════════════════════════════════════════════════ */}

      {/* Video hero — 42% de la pantalla, sin barras negras */}
      <div className="lg:hidden relative flex-shrink-0" style={{ height: '42vh' }}>
        <video
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="/login-bg.mp4"
        />
        {/* Gradiente inferior para transición suave hacia el blanco */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-white/60" />
        {/* Logo centrado */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-16 w-16 object-contain drop-shadow-2xl" />
          <span
            className="text-3xl font-black drop-shadow-lg"
            style={{ fontFamily: "'Nunito', sans-serif", textShadow: '0 2px 16px rgba(0,0,0,0.7)' }}
          >
            <span className="text-white">Halu</span>
            <span style={{ color: '#5eead4' }}>Medic</span>
          </span>
        </div>
      </div>

      {/* Formulario móvil — ocupa el resto exacto de la pantalla */}
      <div className="lg:hidden flex-1 bg-white rounded-t-3xl -mt-6 relative z-10 flex flex-col overflow-y-auto">
        <div className="flex-1 px-6 pt-7 pb-6">

          {/* Cabecera */}
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900">Iniciar sesión</h2>
            <p className="text-slate-400 mt-0.5 text-sm">Accede a tu consultorio</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="tu.usuario" autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400
                    bg-slate-50 placeholder:text-slate-300 transition-all" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400
                    bg-slate-50 placeholder:text-slate-300 transition-all" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-halu-600 to-halu-500 hover:from-halu-700 hover:to-halu-600
                disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-all
                flex items-center justify-center gap-2 shadow-lg shadow-halu-500/25 mt-1">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verificando...</>
                : 'Ingresar'}
            </button>
          </form>

          {/* Features */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { icon: Stethoscope, label: 'Historia clínica' },
              { icon: Zap,         label: 'DIAN + RIPS' },
              { icon: ShieldCheck, label: 'Res. 948/2026' },
            ].map(f => (
              <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <f.icon className="w-4 h-4 text-halu-500" />
                <span className="text-xs text-slate-500 text-center leading-tight">{f.label}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-300 mt-4">
            © 2026 Axentia Technologies · Halu Group
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          DESKTOP
      ══════════════════════════════════════════════════ */}

      {/* Panel izquierdo — video */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden">
        <video autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="/login-bg.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-halu-900/60 via-halu-800/45 to-teal-900/50" />

        <div className="relative z-10 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="" className="h-10 w-10 object-contain" />
          <span className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Nunito', sans-serif" }}>
            <span style={{ color: '#e0efff' }}>Halu</span><span style={{ color: '#5eead4' }}>Medic</span>
          </span>
        </div>

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
              Emite facturas SS-CUFE, genera RIPS conforme a Resolución 948/2026
              y administra tu consultorio desde un solo lugar.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Módulos clínicos', value: '6' },
              { label: 'Res. 948/2026',    value: '✓' },
              { label: 'DIAN + RIPS',      value: '✓' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-4 border border-white/15 backdrop-blur-sm">
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-300 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-slate-400 text-sm">© 2026 Axentia Technologies S.A.S. · Halu Group</p>
        </div>
      </div>

      {/* Panel derecho — formulario desktop */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-20 bg-white">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Iniciar sesión</h2>
            <p className="text-slate-500 mt-1 text-sm">Accede a tu consultorio</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="tu.usuario" autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400
                    bg-slate-50 placeholder:text-slate-400 transition-all" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-halu-500/30 focus:border-halu-400
                    bg-slate-50 placeholder:text-slate-400 transition-all" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-halu-600 to-halu-500
                hover:from-halu-700 hover:to-halu-600 disabled:opacity-60
                text-white font-semibold rounded-xl text-sm transition-all mt-2
                flex items-center justify-center gap-2 shadow-lg shadow-halu-500/20">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verificando...</>
                : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>

    </div>
  )
}
