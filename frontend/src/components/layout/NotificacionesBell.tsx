'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, Calendar, UserPlus, FlaskConical, Clock,
  FileText, Info, X, CheckCheck,
} from 'lucide-react'
import { notificacionesAPI } from '@/lib/api'

interface Notificacion {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  leida: boolean
  url: string
  creada_en: string
}

const tipoIcono: Record<string, React.ElementType> = {
  cita:      Calendar,
  ingreso:   UserPlus,
  resultado: FlaskConical,
  turno:     Clock,
  contrato:  FileText,
  sistema:   Info,
}

function tiempoRelativo(fechaStr: string): string {
  const ahora = Date.now()
  const diff = Math.floor((ahora - new Date(fechaStr).getTime()) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

export default function NotificacionesBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notificacion[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    try {
      const { data } = await notificacionesAPI.list()
      setNotifs(Array.isArray(data) ? data.slice(0, 10) : (data.results ?? []).slice(0, 10))
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    cargar()
    const id = setInterval(cargar, 60_000)
    return () => clearInterval(id)
  }, [cargar])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const sinLeer = notifs.filter(n => !n.leida).length

  const marcarLeida = async (notif: Notificacion) => {
    if (!notif.leida) {
      try {
        await notificacionesAPI.marcarLeida(notif.id)
        setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, leida: true } : n))
      } catch { /* silencioso */ }
    }
    if (notif.url) {
      setOpen(false)
      router.push(notif.url)
    }
  }

  const marcarTodasLeidas = async () => {
    try {
      await notificacionesAPI.marcarTodasLeidas()
      setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
    } catch { /* silencioso */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        title="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {sinLeer > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Cabecera */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">Notificaciones</span>
            <button onClick={() => setOpen(false)} className="p-0.5 text-slate-400 hover:text-slate-700 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {notifs.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No hay notificaciones
              </div>
            ) : (
              notifs.map(notif => {
                const Icono = tipoIcono[notif.tipo] ?? Info
                return (
                  <button
                    key={notif.id}
                    onClick={() => marcarLeida(notif)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${notif.leida ? 'bg-slate-50/50' : 'bg-white'}`}
                  >
                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${notif.leida ? 'bg-slate-100' : 'bg-halu-100'}`}>
                      <Icono className={`w-3.5 h-3.5 ${notif.leida ? 'text-slate-400' : 'text-halu-600'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold truncate ${notif.leida ? 'text-slate-500' : 'text-slate-800'}`}>
                        {notif.titulo}
                      </p>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{notif.mensaje}</p>
                      <p className="text-[10px] text-slate-300 mt-1">{tiempoRelativo(notif.creada_en)}</p>
                    </div>
                    {!notif.leida && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-halu-500 flex-shrink-0" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Pie */}
          {sinLeer > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5">
              <button
                onClick={marcarTodasLeidas}
                className="flex items-center gap-1.5 text-xs text-halu-600 hover:text-halu-800 font-medium transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas como leídas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
